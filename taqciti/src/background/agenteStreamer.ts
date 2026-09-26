/**
 * Orquestração do streaming ao vivo para o backend do Agente Diagnóstico
 * (Fase 7, TAQ-01). Plugado em `flushState()` (sessionController.ts, D-06):
 * cada flush agrupado passa por aqui, que decide (via `planStreamStep`) o
 * texto novo por segmento e dispara o envio — fire-and-forget, nunca atrasa
 * `writeSession`/`broadcast()` nem trava a captura do Meet.
 *
 * Injeção de dependência (`AgenteStreamerDeps`): o módulo nunca fala com
 * `fetch`/config diretamente fora do `send`/`loadConfig` injetados — é o que
 * permite testar com `vi.stubGlobal('fetch', ...)` sem tocar rede de verdade.
 */
import type { MeetingState } from '@/shared/types/domain';
import {
  AGENTE_REQUEST_TIMEOUT_MS,
  DEFAULT_AGENTE_CONFIG,
  buildExtensionChunkRequest,
  isStreamingReady,
  type AgenteConfig,
  type ExtensionChunkRequest,
} from '@/shared/config/agenteConfig';
import { planStreamStep, type StreamBinding, type StreamCursor } from '@/features/agente/wordDelta';
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

/**
 * Cria uma instância do streamer: cursor em memória + fila de promessas (cada
 * passo espera o anterior terminar antes de reler o cursor — sem isso, dois
 * flushes concorrentes calculariam o delta a partir do MESMO estado anterior
 * e enviariam as mesmas palavras duas vezes).
 */
export function createAgenteStreamer(deps: AgenteStreamerDeps) {
  let cursor: StreamCursor | null = null;
  let queue: Promise<void> = Promise.resolve();

  async function step(state: MeetingState): Promise<void> {
    const config = await deps.loadConfig();
    const binding: StreamBinding | null = isStreamingReady(config)
      ? { sessionId: config.agenteSessionId }
      : null;

    const result = planStreamStep(cursor, state.session, binding);
    cursor = result.cursor;

    for (const delta of result.deltas) {
      const request = buildExtensionChunkRequest(config, {
        text: delta.text,
        speaker: delta.speaker,
      });
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

  function onSessionFlushed(state: MeetingState): Promise<void> {
    queue = queue.then(() => step(state)).catch((error: unknown) => {
      logger.error('passo do streamer do Agente falhou', error);
    });
    return queue;
  }

  return { onSessionFlushed };
}

let activeDeps: AgenteStreamerDeps = {
  loadConfig: () => Promise.resolve(DEFAULT_AGENTE_CONFIG),
  send: defaultSend,
};
let activeStreamer = createAgenteStreamer(activeDeps);

/**
 * Seam de composição/teste: mescla deps parciais nas atuais e recria a
 * instância ativa (cursor novo, fila nova) — nunca muta o streamer em uso.
 */
export function configureAgenteStreamer(partial: Partial<AgenteStreamerDeps>): void {
  activeDeps = { ...activeDeps, ...partial };
  activeStreamer = createAgenteStreamer(activeDeps);
}

/** Delegação para a instância ativa — é isto que `sessionController.ts` chama. */
export function onSessionFlushed(state: MeetingState): Promise<void> {
  return activeStreamer.onSessionFlushed(state);
}
