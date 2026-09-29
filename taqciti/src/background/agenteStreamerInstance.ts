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
  isStreamingReady,
  type AgenteConfig,
} from '@/shared/config/agenteConfig';
import { planStreamStep, primeCursor, type StreamCursor } from '@/features/agente/wordDelta';
import {
  appendDeltas,
  buildPhraseRequests,
  EMPTY_PHRASE_BUFFER,
  nextPhraseDeadline,
  takeReadyPhrases,
  type PhraseBuffer,
  type PhraseTiming,
} from '@/features/agente/phraseBatcher';
import { logger } from '@/shared/services/log';
import type { AgenteStreamerDeps } from './agenteStreamerDeps';
import { createAgenteSender } from './agenteSender';
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
  const status = createStatusReporter(deps.reportStatus);
  const sender = createAgenteSender({ send: deps.send, onOutcome: status.sendOutcome });
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
   * Desliga na hora: nada sai depois disto, inclusive o que estava pendente
   * na janela e o que esperava nova tentativa na fila de envio (D-09).
   */
  function discard(): void {
    pending = EMPTY_PHRASE_BUFFER;
    sender.cancelAll();
    windowTimer.cancel();
  }

  /** Streaming desligado: descarta tudo e esquece o cursor (step, tick e mudança de config iguais). */
  function stopStreaming(): void {
    discard();
    cursor = null;
    lastDestinationKey = null;
    status.waitingForMeeting(null);
  }

  /**
   * WR-01: trocar URL, sessão ou chave invalida a fila de envio — os trechos já
   * liberados foram montados para o destino antigo e não podem segurar (nem
   * pintar o status de) os novos. Mesma regra da janela (IN-11).
   */
  function syncDestination(config: AgenteConfig): void {
    const key = `${config.agenteBackendUrl}
${config.agenteSessionId}
${config.agenteApiKey}`;
    if (lastDestinationKey !== null && key !== lastDestinationKey) sender.cancelAll();
    lastDestinationKey = key;
  }

  /** Rearma o único timer da janela para o próximo prazo do buffer atual. */
  function rearm(now: number): void {
    if (disposed) return;
    windowTimer.armAt(nextPhraseDeadline(pending, PHRASE_TIMING), now);
  }

  function drain(config: AgenteConfig, now: number, flushAll: boolean): void {
    const result = takeReadyPhrases(pending, now, PHRASE_TIMING, flushAll);
    pending = result.buffer;
    sender.submit(buildPhraseRequests(config, result.ready));
    rearm(now);
  }

  async function step(state: MeetingState): Promise<void> {
    const config = await deps.loadConfig();
    if (disposed) return; // instância descartada enquanto esperava (WR-13)
    lastState = state;
    if (!isStreamingReady(config)) {
      stopStreaming();
      return;
    }
    syncDestination(config);
    advance(config, state);
  }

  function advance(config: AgenteConfig, state: MeetingState): void {
    const binding = {
      sessionId: config.agenteSessionId,
      confirmedMeetingId: config.confirmedMeetingId,
    };
    const result = planStreamStep(cursor, state.session, binding);
    cursor = result.cursor;
    status.waitingForMeeting(result.waitingForNewMeeting ? (state.session?.meetingId ?? null) : null);

    const now = Date.now();
    const destination = { backendUrl: config.agenteBackendUrl, sessionId: binding.sessionId };
    pending = appendDeltas(pending, result.deltas, destination, now);
    drain(config, now, state.phase !== 'recording');
  }

  /** Callback do timer da janela: relê a config (pode ter mudado) antes de mandar. */
  async function tick(): Promise<void> {
    if (disposed) return; // instância já descartada (WR-13) — nada a fazer
    try {
      const config = await deps.loadConfig();
      if (disposed) return; // descartada enquanto esperava loadConfig (WR-13)
      if (!isStreamingReady(config)) {
        stopStreaming();
        return;
      }
      syncDestination(config);
      drain(config, Date.now(), false);
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
    if (!isStreamingReady(config)) {
      status.resetSendOutcome(); // WR-07
      stopStreaming();
      return;
    }
    // WR-01: cancela ANTES de zerar o status — assim um trecho antigo não repinta o erro.
    syncDestination(config);
    status.resetSendOutcome(); // WR-07
    if (lastState === null) return;
    if (cursor === null) {
      // WR-02: religar começa a contar DESTE instante. Sem isto, o próximo
      // flush fazia o prime já com o trecho novo aplicado, e ele se perdia.
      if (lastState.session !== null) cursor = primeCursor(lastState.session, config.agenteSessionId);
      return;
    }
    // CR-01: confirmar a reunião nova (ou trocar o session_id) libera na hora,
    // sem esperar alguém voltar a falar.
    advance(config, lastState);
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

  /** Boot do service worker (WR-02): restaura o snapshot sem esperar o próximo flush. */
  function resume(): Promise<void> {
    ensureSubscribed();
    return enqueueStep(() => Promise.resolve());
  }

  /** Só para asserções de ausência em teste (WR-10): espera a fila, sem enfileirar nada. */
  function whenIdle(): Promise<void> {
    return queue;
  }

  /** Terminal (WR-13): todo ponto de entrada (`step`/`tick`/`rearm`) passa a virar no-op. */
  function dispose(): void {
    disposed = true;
    discard();
    sender.dispose();
    unsubscribeConfig?.();
    unsubscribeConfig = null;
  }

  return { onSessionFlushed, resume, dispose, whenIdle };
}
