/**
 * Instância do streamer ao vivo para o backend do Agente Diagnóstico (Fase 7,
 * TAQ-01; janela por fala do gap G-07-1/G-07-2, plano 07-04, D-06 refinado).
 * Cada flush agrupado de `flushState()` (sessionController.ts) passa por aqui,
 * que decide (via `planStreamStep`) o texto novo por segmento, acumula numa
 * fala (via `phraseBatcher.ts`) e só dispara o envio quando a fala fica em
 * silêncio, atinge o teto de espera, ou a reunião sai de 'recording' —
 * fire-and-forget, nunca atrasa `writeSession`/`broadcast()` nem trava a
 * captura do Meet.
 *
 * Injeção de dependência (`AgenteStreamerDeps`): o módulo nunca fala com
 * `fetch`/config diretamente fora do `send`/`loadConfig` injetados. A raiz de
 * composição (deps de produção + instância ativa) mora em `agenteStreamer.ts`.
 */
import type { MeetingState } from '@/shared/types/domain';
import {
  AGENTE_PHRASE_MAX_WAIT_MS,
  AGENTE_PHRASE_QUIET_MS,
  buildExtensionChunkRequest,
  isStreamingReady,
  type AgenteConfig,
  type ExtensionChunkRequest,
} from '@/shared/config/agenteConfig';
import { planStreamStep, type StreamBinding, type StreamCursor } from '@/features/agente/wordDelta';
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

export interface AgenteStreamerDeps {
  loadConfig: () => Promise<AgenteConfig>;
  send: (request: ExtensionChunkRequest) => Promise<Response>;
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
  let timer: ReturnType<typeof setTimeout> | null = null;
  /*
   * WR-13: um `step`/`tick` já enfileirado (ex.: esperando `loadConfig`)
   * quando `dispose()` roda NÃO para sozinho — sem este flag, ele continua,
   * rearma timer ou envia com o `deps` desta instância descartada.
   */
  let disposed = false;
  /** Fila de envio ordenada, com novas tentativas (WR-01). */
  const sender = createAgenteSender({ send: deps.send });

  /** Fila serializada única — flush e timer da janela SEMPRE passam por aqui. */
  function enqueue(run: () => Promise<void>): Promise<void> {
    queue = queue.then(run).catch((error: unknown) => {
      logger.error('passo do streamer do Agente falhou', error);
    });
    return queue;
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
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  /** Rearma o único timer da janela para o próximo prazo do buffer atual. */
  function rearm(now: number): void {
    if (disposed) return;
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    const deadline = nextPhraseDeadline(pending, PHRASE_TIMING);
    if (deadline !== null) {
      timer = setTimeout(() => {
        timer = null;
        void enqueue(tick);
      }, Math.max(0, deadline - now));
    }
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
    const binding: StreamBinding | null = isStreamingReady(config)
      ? { sessionId: config.agenteSessionId }
      : null;

    const result = planStreamStep(cursor, state.session, binding);
    cursor = result.cursor;

    if (binding === null) {
      discard();
      return;
    }

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
        discard();
        return;
      }
      drain(config, Date.now(), false);
    } finally {
      // WR-12: se loadConfig() falhar, nunca chega em drain/rearm — sem
      // isto, uma fala pendente ficava sem timer até alguém falar de novo
      // (ou se perdia). Atraso mínimo pra não virar laço apertado.
      if (!disposed && timer === null && pending.length > 0) {
        timer = setTimeout(() => {
          timer = null;
          void enqueue(tick);
        }, RETRY_MIN_MS);
      }
    }
  }

  function onSessionFlushed(state: MeetingState): Promise<void> {
    return enqueue(() => step(state));
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
  }

  return { onSessionFlushed, dispose, whenIdle };
}
