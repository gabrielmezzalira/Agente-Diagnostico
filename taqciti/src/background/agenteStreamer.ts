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
  }

  return { onSessionFlushed, dispose, whenIdle };
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
 * instância anterior antes. `dispose()` é terminal (WR-13): um passo já
 * enfileirado na instância antiga vira no-op em vez de rearmar timer ou
 * enviar com o `deps` descartado.
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

/** Só para testes (WR-10) — ver comentário de `whenIdle` acima. */
export function whenAgenteStreamerIdle(): Promise<void> {
  return activeStreamer.whenIdle();
}
