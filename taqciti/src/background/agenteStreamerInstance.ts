/**
 * Instância do streamer ao vivo para o Agente Diagnóstico (Fase 7, TAQ-01;
 * janela por fala do plano 07-04). Cada flush de `flushState()` passa por
 * aqui: `planStreamStep` decide o texto novo por segmento, `phraseBatcher`
 * acumula numa fala, e o envio só sai no silêncio, no teto de espera ou quando
 * a reunião sai de 'recording' — sem nunca atrasar a gravação local. Tudo que
 * toca rede/storage vem injetado (`AgenteStreamerDeps`); a raiz de composição
 * mora em `agenteStreamer.ts`.
 */
import type { MeetingSessionState, MeetingState } from '@/shared/types/domain';
import {
  AGENTE_PHRASE_MAX_WAIT_MS,
  AGENTE_PHRASE_QUIET_MS,
  buildExtensionChunkRequest,
  isStreamingReady,
  type AgenteConfig,
  type ExtensionChunkRequest,
} from '@/shared/config/agenteConfig';
import {
  planStreamStep,
  primeCursor,
  type StreamBinding,
  type StreamCursor,
} from '@/features/agente/wordDelta';
import {
  appendDeltas,
  EMPTY_PHRASE_BUFFER,
  nextPhraseDeadline,
  takeReadyPhrases,
  type PendingPhrase,
  type PhraseBuffer,
  type PhraseTiming,
} from '@/features/agente/phraseBatcher';
import { logger } from '@/shared/services/log';
import { createAgenteSender } from './agenteSender';
import { createPhraseWindowTimer } from './phraseWindowTimer';
import { createSnapshotPersister, type AgenteStreamerSnapshotStore } from './agenteStreamerSnapshot';

export interface AgenteStreamerDeps {
  loadConfig: () => Promise<AgenteConfig>;
  send: (request: ExtensionChunkRequest) => Promise<Response>;
  /** Mudanças de config, para reagir na hora ao toggle (WR-11). */
  onConfigChange?: (listener: (config: AgenteConfig) => void) => () => void;
  /** Onde cursor e falas pendentes sobrevivem ao reinício do service worker (WR-02). */
  snapshot?: AgenteStreamerSnapshotStore;
}

const PHRASE_TIMING: PhraseTiming = {
  quietMs: AGENTE_PHRASE_QUIET_MS,
  maxWaitMs: AGENTE_PHRASE_MAX_WAIT_MS,
};

/** Atraso do timer de retry defensivo do `tick` (WR-12) — nunca laço apertado. */
const RETRY_MIN_MS = 1_000;

/**
 * Cria uma instância do streamer: cursor em memória + buffer de falas
 * pendentes + timer único da janela + fila de promessas (cada passo espera o
 * anterior terminar antes de reler o cursor — sem isso, dois flushes
 * concorrentes calculariam o delta a partir do MESMO estado anterior e
 * enviariam as mesmas palavras duas vezes).
 */
export function createAgenteStreamer(deps: AgenteStreamerDeps) {
  let cursor: StreamCursor | null = null;
  let queue: Promise<void> = Promise.resolve();
  let pending: PhraseBuffer = EMPTY_PHRASE_BUFFER;
  /*
   * WR-13: um `step`/`tick` já enfileirado (ex.: esperando `loadConfig`)
   * quando `dispose()` roda NÃO para sozinho — sem este flag, ele continua,
   * rearma timer ou envia com o `deps` desta instância descartada.
   */
  let disposed = false;
  /** Fila de envio ordenada, com novas tentativas (WR-01). */
  const sender = createAgenteSender({ send: deps.send });
  const windowTimer = createPhraseWindowTimer(() => void enqueueStep(tick));
  /** Cancela a assinatura de config; `null` até o primeiro passo (preguiçosa). */
  let unsubscribeConfig: (() => void) | null = null;
  const persister = deps.snapshot ? createSnapshotPersister(deps.snapshot) : null;
  let restored = false;
  /** Última sessão vista num flush — é dali que religar o toggle começa a contar (WR-02). */
  let lastSession: MeetingSessionState | null = null;

  /** Fila serializada única — flush e timer da janela SEMPRE passam por aqui. */
  function enqueue(run: () => Promise<void>): Promise<void> {
    queue = queue.then(run).catch((error: unknown) => {
      logger.error('passo do streamer do Agente falhou', error);
    });
    return queue;
  }

  /**
   * Todo passo (flush, timer, mudança de config) restaura o snapshot na
   * primeira vez e persiste o resultado depois (WR-02).
   */
  function enqueueStep(run: () => Promise<void>): Promise<void> {
    return enqueue(async () => {
      await restoreOnce();
      if (disposed) return;
      await run();
      if (!disposed) await persister?.persist(cursor, pending);
    });
  }

  async function restoreOnce(): Promise<void> {
    if (restored || persister === null) return;
    restored = true;
    const snapshot = await persister.restore();
    if (disposed || snapshot === null) return;
    cursor = snapshot.cursor;
    pending = snapshot.pending;
    rearm(Date.now());
  }

  function sendPhrases(config: AgenteConfig, phrases: readonly PendingPhrase[]): void {
    sender.submit(
      phrases.map((phrase) =>
        buildExtensionChunkRequest(
          { ...config, agenteSessionId: phrase.sessionId },
          { text: phrase.text, speaker: phrase.speaker },
        ),
      ),
    );
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
  }

  /** Rearma o único timer da janela para o próximo prazo do buffer atual. */
  function rearm(now: number): void {
    if (disposed) return;
    windowTimer.armAt(nextPhraseDeadline(pending, PHRASE_TIMING), now);
  }

  function drain(config: AgenteConfig, now: number, flushAll: boolean): void {
    const result = takeReadyPhrases(pending, now, PHRASE_TIMING, flushAll);
    pending = result.buffer;
    sendPhrases(config, result.ready);
    rearm(now);
  }

  async function step(state: MeetingState): Promise<void> {
    const config = await deps.loadConfig();
    if (disposed) return; // instância descartada enquanto esperava (WR-13)
    lastSession = state.session;
    const binding: StreamBinding | null = isStreamingReady(config)
      ? { sessionId: config.agenteSessionId }
      : null;

    if (binding === null) {
      stopStreaming();
      return;
    }

    const result = planStreamStep(cursor, state.session, binding);
    cursor = result.cursor;

    const now = Date.now();
    pending = appendDeltas(pending, result.deltas, binding.sessionId, now);
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
      stopStreaming();
      return;
    }
    // WR-02: religar começa a contar DESTE instante. Sem isto, o próximo
    // flush fazia o prime já com o trecho novo aplicado, e ele se perdia.
    if (cursor === null && lastSession !== null) {
      cursor = primeCursor(lastSession, config.agenteSessionId);
    }
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
   * Boot do service worker (WR-02): restaura o snapshot sem esperar o
   * próximo flush — uma fala que estava na janela volta a ter timer.
   */
  function resume(): Promise<void> {
    ensureSubscribed();
    return enqueueStep(() => Promise.resolve());
  }

  /** Observador sem efeito colateral (WR-10): espera a fila terminar, sem
   * enfileirar nenhum passo novo — só para asserções de ausência em teste. */
  function whenIdle(): Promise<void> {
    return queue;
  }

  /** Terminal (WR-13): marca a instância como descartada ANTES de limpar —
   * todo ponto de entrada (`step`/`tick`/`rearm`) passa a virar no-op. */
  function dispose(): void {
    disposed = true;
    discard();
    sender.dispose();
    unsubscribeConfig?.();
    unsubscribeConfig = null;
  }

  return { onSessionFlushed, resume, dispose, whenIdle };
}
