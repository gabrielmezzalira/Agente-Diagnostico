/**
 * Instância do streamer ao vivo para o Agente Diagnóstico (Fase 7, TAQ-01;
 * janela por fala do plano 07-04). Cada flush de `flushState()` passa por
 * aqui: `planStreamStep` decide o texto novo por segmento, `phraseBatcher`
 * acumula numa fala, e o envio só sai no silêncio, no teto de espera ou quando
 * a reunião sai de 'recording' — sem nunca atrasar a gravação local. Tudo que
 * toca rede/storage vem injetado (`AgenteStreamerDeps`); a raiz de composição
 * mora em `agenteStreamer.ts`.
 */
import type { MeetingState } from '@/shared/types/domain';
import {
  AGENTE_PHRASE_MAX_WAIT_MS,
  AGENTE_PHRASE_QUIET_MS,
  type AgenteConfig,
} from '@/shared/config/agenteConfig';
import { planStreamStep, type StreamCursor } from '@/features/agente/wordDelta';
import {
  appendDeltas,
  EMPTY_PHRASE_BUFFER,
  nextPhraseDeadline,
  takeReadyPhrases,
  type PhraseBuffer,
  type PhraseTiming,
} from '@/features/agente/phraseBatcher';
import { phrasesToOutboxItems } from '@/features/agente/outbox';
import { logger } from '@/shared/services/log';
import type { AgenteStreamerDeps } from './agenteStreamerDeps';
import { createStreamerSender } from './agenteStreamerSender';
import { configDestination, cursorFromSeed, type StreamTarget } from './agenteStreamDestination';
import { createBindingRecorder } from './agenteStreamerBindingRecorder';
import { createPhraseWindowTimer } from './phraseWindowTimer';
import { createSnapshotPersister } from './agenteStreamerSnapshot';
import { createStatusReporter } from './agenteStatusReporter';

export type { AgenteStreamerDeps } from './agenteStreamerDeps';

const PHRASE_TIMING: PhraseTiming = {
  quietMs: AGENTE_PHRASE_QUIET_MS,
  maxWaitMs: AGENTE_PHRASE_MAX_WAIT_MS,
};

/** Atraso do timer de retry defensivo do `tick` (WR-12) — nunca laço apertado. */
const RETRY_MIN_MS = 1_000;

/**
 * Cria uma instância do streamer: cursor + falas pendentes + timer único da
 * janela + fila de promessas (cada passo espera o anterior terminar antes de
 * reler o cursor — sem isso, dois flushes concorrentes calculariam o delta a
 * partir do MESMO estado anterior e enviariam as mesmas palavras duas vezes).
 */
export function createAgenteStreamer(deps: AgenteStreamerDeps) {
  let cursor: StreamCursor | null = null;
  let queue: Promise<void> = Promise.resolve();
  let pending: PhraseBuffer = EMPTY_PHRASE_BUFFER;
  /** WR-13: um passo já enfileirado quando `dispose()` roda vira no-op em vez de continuar. */
  let disposed = false;
  /** Último estado visto num flush — é dali que religar o toggle começa a contar (WR-02). */
  let lastState: MeetingState | null = null;
  /** Cancela a assinatura de config; `null` até o primeiro passo (preguiçosa). */
  let unsubscribeConfig: (() => void) | null = null;
  /** WR-01: destino (URL + sessão + chave) dos trechos que estão na fila de envio; `null` = nada visto. */
  let lastDestinationKey: string | null = null;
  /** CR-01/WR-01: memória do vínculo sessão → última reunião (extraída para não passar de 300 linhas). */
  const bindingRecorder = createBindingRecorder(deps);
  /** Fase 8 (D-01): a regra "para onde vai a fala"; sem política injetada vale a da Fase 7. */
  const destination = deps.destination ?? configDestination;
  const status = createStatusReporter(deps.reportStatus);
  const sender = createStreamerSender(deps, status);
  const windowTimer = createPhraseWindowTimer(() => void enqueueStep(tick));
  const persister = deps.snapshot ? createSnapshotPersister(deps.snapshot) : null;

  /** Fila serializada única — flush, timer e mudança de config SEMPRE passam por aqui. */
  function enqueue(run: () => Promise<void>): Promise<void> {
    queue = queue.then(run).catch((error: unknown) => {
      logger.error('passo do streamer do Agente falhou', error);
    });
    return queue;
  }

  /** Todo passo restaura o snapshot na primeira vez e persiste o resultado depois (WR-02). */
  function enqueueStep(run: () => Promise<void>): Promise<void> {
    return enqueue(async () => {
      const snapshot = await persister?.restoreOnce();
      if (disposed) return;
      if (snapshot) {
        cursor = snapshot.cursor;
        pending = snapshot.pending;
        rearm(Date.now());
      }
      await run();
      if (!disposed) await persister?.persist(cursor, pending);
    });
  }

  /**
   * Streaming desligado (step, tick, resume e mudança de config iguais): nada sai depois disto — nem o que
   * estava pendente na janela, nem o que esperava na fila de envio, inclusive a durável (D-09); esquece o cursor.
   */
  function stopStreaming(): void {
    pending = EMPTY_PHRASE_BUFFER;
    sender.cancelAll();
    windowTimer.cancel();
    cursor = null;
    lastDestinationKey = null;
    bindingRecorder.reset();
    status.waitingForMeeting(null);
  }

  /**
   * WR-01: trocar URL, sessão ou chave invalida a fila de envio — os trechos já
   * liberados foram montados para o destino antigo e não podem segurar (nem
   * pintar o status de) os novos. Mesma regra da janela (IN-11).
   */
  function syncDestination(config: AgenteConfig): void {
    const key = destination.queueKey(config);
    if (lastDestinationKey !== null && key !== lastDestinationKey) sender.cancelAll();
    lastDestinationKey = key;
  }

  /** Rearma o único timer da janela para o próximo prazo do buffer atual. */
  function rearm(now: number): void {
    if (disposed) return;
    windowTimer.armAt(nextPhraseDeadline(pending, PHRASE_TIMING), now);
  }

  function drain(now: number, flushAll: boolean): void {
    const result = takeReadyPhrases(pending, now, PHRASE_TIMING, flushAll);
    pending = result.buffer;
    sender.submit(phrasesToOutboxItems(result.ready, () => crypto.randomUUID(), now));
    rearm(now);
  }

  async function step(state: MeetingState): Promise<void> {
    const config = await deps.loadConfig();
    if (disposed) return; // instância descartada enquanto esperava (WR-13)
    lastState = state;
    const meetingId = state.session?.meetingId ?? null;
    const target = await destination.resolve(config, meetingId);
    if (disposed) return;
    const sendConfig = await settleTarget(target, meetingId);
    if (sendConfig === null) return;
    await advance(sendConfig, state);
    sender.kick(); // Fase 8: sem falas novas, é este passo que retoma a fila parada esperando o Agente
  }

  /**
   * Traduz o alvo da política em ação; devolve a config de envio ou `null` (este passo não envia).
   * `idle` zera só o cursor da reunião atual (D-09 da Fase 7 vale só para `disabled`); `hold` não mexe
   * em nada. A semente vira o cursor inicial (`{}` conta) e é persistida ANTES de consumida.
   */
  async function settleTarget(target: StreamTarget, meetingId: string | null): Promise<AgenteConfig | null> {
    if (target.kind === 'disabled') {
      stopStreaming();
      return null;
    }
    if (target.kind === 'hold') return null;
    if (target.kind === 'idle') {
      cursor = null;
      status.waitingForMeeting(null);
      return null;
    }
    syncDestination(target.config);
    if (target.seed !== null && meetingId !== null) {
      cursor = cursorFromSeed(cursor, meetingId, target.config.agenteSessionId, target.seed) ?? cursor;
      await persister?.persist(cursor, pending);
      await destination.consumeSeed(meetingId).catch((error: unknown) => {
        logger.error('consumir a semente do vínculo falhou', error);
      });
    }
    return target.config;
  }

  async function advance(config: AgenteConfig, state: MeetingState): Promise<void> {
    const boundMeetingId = destination.usesMeetingBinding
      ? await bindingRecorder.boundMeetingFor(config.agenteSessionId)
      : '';
    const binding = {
      sessionId: config.agenteSessionId,
      confirmedMeetingId: config.confirmedMeetingId,
      boundMeetingId,
    };
    const result = planStreamStep(cursor, state.session, binding);
    cursor = result.cursor;
    status.waitingForMeeting(result.waitingForNewMeeting ? (state.session?.meetingId ?? null) : null);

    const now = Date.now();
    const phraseDestination = { backendUrl: config.agenteBackendUrl, sessionId: binding.sessionId };
    pending = appendDeltas(pending, result.deltas, phraseDestination, now);
    drain(now, state.phase !== 'recording');
    if (destination.usesMeetingBinding) {
      await bindingRecorder.record(config.agenteSessionId, cursor?.meetingId ?? null, boundMeetingId);
    }
  }

  /** Callback do timer da janela: relê a config (pode ter mudado) antes de mandar. */
  async function tick(): Promise<void> {
    if (disposed) return; // instância já descartada (WR-13) — nada a fazer
    try {
      const config = await deps.loadConfig();
      if (disposed) return; // descartada enquanto esperava loadConfig (WR-13)
      if (!destination.canDrain(config)) {
        stopStreaming();
        return;
      }
      syncDestination(config);
      drain(Date.now(), false);
      sender.kick();
    } finally {
      // WR-12: se loadConfig() falhar, nunca chega em drain/rearm — sem
      // isto, uma fala pendente ficava sem timer até alguém falar de novo
      // (ou se perdia). Atraso mínimo pra não virar laço apertado.
      if (!disposed && pending.length > 0) windowTimer.armIfIdle(RETRY_MIN_MS);
    }
  }

  /** Reage na hora a uma mudança de config, dentro da mesma fila (WR-11). */
  async function applyConfigChange(config: AgenteConfig): Promise<void> {
    if (disposed) return;
    const meetingId = lastState?.session?.meetingId ?? null;
    const target = await destination.resolve(config, meetingId);
    if (disposed) return;
    const sendConfig = await settleTarget(target, meetingId);
    // WR-01: o cancelAll (settleTarget) vem ANTES de zerar o status — assim um trecho antigo não repinta o erro.
    status.resetSendOutcome(); // WR-07
    if (sendConfig === null || lastState === null) return;
    // WR-02: religar (cursor nulo) numa reunião que não é de outro vínculo começa a contar DESTE
    // instante — o prime ancora no estado atual, então o próximo flush não perde o trecho novo.
    // CR-01: se a sessão estava vinculada a OUTRA reunião, o mesmo passo ESPERA em vez de ancorar.
    // Decisão do time (2026-10-10): confirmar essa reunião a libera DESDE O INÍCIO — inclusive o
    // que foi dito com o toggle desligado —, porque a pessoa decidiu mandá-la inteira para a sessão.
    // Confirmar (ou trocar o session_id) libera na hora, sem esperar alguém voltar a falar.
    await advance(sendConfig, lastState);
  }

  /** Assina as mudanças de config no primeiro passo — importar continua sem efeito colateral. */
  function ensureSubscribed(): void {
    if (unsubscribeConfig !== null || disposed || !deps.onConfigChange) return;
    unsubscribeConfig = deps.onConfigChange((config) => {
      void enqueueStep(() => applyConfigChange(config));
    });
  }

  function onSessionFlushed(state: MeetingState): Promise<void> {
    ensureSubscribed();
    return enqueueStep(() => step(state));
  }

  /**
   * Boot do service worker (WR-02): restaura o snapshot sem esperar o próximo flush e desfaz o "tentando de
   * novo…" que o service worker anterior deixou (WR-04). Fase 8 (D-18): retoma a fila durável pelo MESMO
   * portão de `step`/`tick` — envio desligado ou config não pronta limpa a fila (D-09) e não manda nada.
   */
  function resume(): Promise<void> {
    ensureSubscribed();
    return enqueueStep(async () => {
      await deps.settleStatusAfterRestart?.().catch((error: unknown) => {
        logger.error('acertar o status do Agente depois do reinício falhou', error);
      });
      const config = await deps.loadConfig();
      if (disposed) return;
      if (!destination.canDrain(config)) {
        stopStreaming();
        return;
      }
      syncDestination(config);
      await sender.resume();
    });
  }

  /**
   * Fase 8: um passo com o último estado visto, pela mesma fila — chamado logo depois de `link-completed`
   * para o que veio depois da semente sair mesmo sem flush novo. Sem estado visto, no-op.
   */
  function reevaluate(): Promise<void> {
    ensureSubscribed();
    return enqueueStep(async () => {
      if (lastState !== null) await step(lastState);
    });
  }

  /** Só para asserções em teste (WR-10): espera a fila e o sender despachar (guardar + 1º envio). */
  async function whenIdle(): Promise<void> {
    await queue;
    await sender.settled();
  }

  /** Terminal (WR-13): todo ponto de entrada (`step`/`tick`/`rearm`) passa a virar no-op. */
  function dispose(): void {
    disposed = true;
    // Descartar a instância NÃO é desligar o envio (Fase 8): a fila durável fica para a instância seguinte.
    pending = EMPTY_PHRASE_BUFFER;
    windowTimer.cancel();
    sender.dispose();
    unsubscribeConfig?.();
    unsubscribeConfig = null;
  }

  return { onSessionFlushed, resume, reevaluate, dispose, whenIdle, kick: sender.kick };
}
