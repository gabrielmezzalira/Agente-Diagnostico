/**
 * Orquestração do streaming ao vivo para o backend do Agente Diagnóstico
 * (Fase 7, TAQ-01; janela por fala do gap G-07-1/G-07-2, plano 07-04, D-06
 * refinado). Plugado em `flushState()` (sessionController.ts, D-06 — ponto de
 * plugagem intacto): cada flush agrupado passa por aqui, que decide (via
 * `planStreamStep`) o texto novo por segmento, acumula numa fala (via
 * `phraseBatcher.ts`) e só dispara o envio quando a fala fica em silêncio,
 * atinge o teto de espera, ou a reunião sai de 'recording' — fire-and-forget,
 * nunca atrasa `writeSession`/`broadcast()` nem trava a captura do Meet.
 *
 * Injeção de dependência (`AgenteStreamerDeps`): o módulo nunca fala com
 * `fetch`/config diretamente fora do `send`/`loadConfig` injetados — é o que
 * permite testar com `vi.stubGlobal('fetch', ...)` sem tocar rede de verdade.
 */
import type { MeetingState } from '@/shared/types/domain';
import {
  AGENTE_PHRASE_MAX_WAIT_MS,
  AGENTE_PHRASE_QUIET_MS,
  AGENTE_REQUEST_TIMEOUT_MS,
  buildExtensionChunkRequest,
  isStreamingReady,
  type AgenteConfig,
  type ExtensionChunkRequest,
} from '@/shared/config/agenteConfig';
import { createAgenteConfigReader } from '@/shared/config/agenteConfigStore';
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

export interface AgenteStreamerDeps {
  loadConfig: () => Promise<AgenteConfig>;
  send: (request: ExtensionChunkRequest) => Promise<Response>;
}

function defaultSend(request: ExtensionChunkRequest): Promise<Response> {
  return fetch(request.url, {
    ...request.init,
    signal: AbortSignal.timeout(AGENTE_REQUEST_TIMEOUT_MS),
  });
}

const PHRASE_TIMING: PhraseTiming = {
  quietMs: AGENTE_PHRASE_QUIET_MS,
  maxWaitMs: AGENTE_PHRASE_MAX_WAIT_MS,
};

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

  /** Fila serializada única — flush e timer da janela SEMPRE passam por aqui. */
  function enqueue(run: () => Promise<void>): Promise<void> {
    queue = queue.then(run).catch((error: unknown) => {
      logger.error('passo do streamer do Agente falhou', error);
    });
    return queue;
  }

  function sendPhrases(config: AgenteConfig, phrases: readonly PendingPhrase[]): void {
    for (const phrase of phrases) {
      const request = buildExtensionChunkRequest(
        { ...config, agenteSessionId: phrase.sessionId },
        { text: phrase.text, speaker: phrase.speaker },
      );
      void deps
        .send(request)
        .then((response) => {
          if (!response.ok) {
            logger.warn('Agente recusou o trecho', { status: response.status });
          }
        })
        .catch((error: unknown) => {
          logger.error('envio ao Agente falhou', error);
        });
    }
  }

  /** Desliga na hora: nada sai depois disto, inclusive o que estava pendente (D-09). */
  function discard(): void {
    pending = EMPTY_PHRASE_BUFFER;
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  /** Rearma o único timer da janela para o próximo prazo do buffer atual. */
  function rearm(now: number): void {
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
    const config = await deps.loadConfig();
    if (!isStreamingReady(config)) {
      discard();
      return;
    }
    drain(config, Date.now(), false);
  }

  function onSessionFlushed(state: MeetingState): Promise<void> {
    return enqueue(() => step(state));
  }

  return { onSessionFlushed, dispose: discard };
}

/**
 * Padrão de produção (Fase 7, plano 02, D-08): lê a config salva em
 * `chrome.storage.local` (`agenteConfigStore.ts`), com cache — não o valor
 * fixo `DEFAULT_AGENTE_CONFIG` do plano 01, que mantinha o streaming sempre
 * desligado até este plano ligar a leitura em runtime. `createAgenteConfigReader()`
 * é preguiçoso: só toca o storage na primeira chamada de `loadConfig`, então
 * importar este módulo continua sem efeito colateral.
 */
let activeDeps: AgenteStreamerDeps = {
  loadConfig: createAgenteConfigReader(),
  send: defaultSend,
};
let activeStreamer = createAgenteStreamer(activeDeps);

/**
 * Seam de composição/teste: mescla deps parciais nas atuais e recria a
 * instância ativa (cursor novo, fila nova, buffer/timer novos) — descarta a
 * instância anterior antes (nenhum timer órfão continua vivo).
 */
export function configureAgenteStreamer(partial: Partial<AgenteStreamerDeps>): void {
  activeDeps = { ...activeDeps, ...partial };
  activeStreamer.dispose();
  activeStreamer = createAgenteStreamer(activeDeps);
}

/** Delegação para a instância ativa — é isto que `sessionController.ts` chama. */
export function onSessionFlushed(state: MeetingState): Promise<void> {
  return activeStreamer.onSessionFlushed(state);
}
