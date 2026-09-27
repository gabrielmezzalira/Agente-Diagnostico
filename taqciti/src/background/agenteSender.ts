/**
 * Fila de envio ao Agente (Fase 7, WR-01): os trechos saem um de cada vez, na
 * ordem em que foram liberados pela janela por fala, com as novas tentativas
 * da `sendRetryPolicy.ts`. Nunca bloqueia o streamer — `submit` só enfileira.
 *
 * `cancelAll()` é o que mantém o D-09 com o retry: desligar o streaming
 * descarta a fila E interrompe um trecho que esteja esperando nova tentativa
 * (cada tentativa confere a "geração" antes de sair).
 */
import type { ExtensionChunkRequest } from '@/shared/config/agenteConfig';
import type { AgenteSendOutcome } from '@/shared/config/agenteStatus';
import {
  AGENTE_SEND_MAX_QUEUED,
  AGENTE_SEND_MAX_RETRIES,
  classifySendAttempt,
  retryDelayMs,
  type SendAttemptResult,
} from '@/features/agente/sendRetryPolicy';
import { logger } from '@/shared/services/log';

export interface AgenteSenderDeps {
  send: (request: ExtensionChunkRequest) => Promise<Response>;
  /** Injetável só para teste; o padrão é `setTimeout`. */
  sleep?: (ms: number) => Promise<void>;
  /** Resultado de cada tentativa, para a tela mostrar a verdade (WR-07). `null` = erro de rede. */
  onOutcome?: (outcome: AgenteSendOutcome, httpStatus: number | null) => void;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createAgenteSender(deps: AgenteSenderDeps) {
  const sleep = deps.sleep ?? defaultSleep;
  const report = (outcome: AgenteSendOutcome, httpStatus: number | null) =>
    deps.onOutcome?.(outcome, httpStatus);
  const waiting: ExtensionChunkRequest[] = [];
  let running = false;
  let idle: Promise<void> = Promise.resolve();
  let generation = 0;
  let disposed = false;

  const isCurrent = (gen: number) => !disposed && gen === generation;

  async function attempt(request: ExtensionChunkRequest): Promise<SendAttemptResult> {
    try {
      // `await` dentro do try: um `send` que lança de forma síncrona vira
      // erro de rede em vez de derrubar a fila (IN-10).
      const response = await deps.send(request);
      return { kind: 'response', ok: response.ok, status: response.status };
    } catch (error) {
      logger.error('envio ao Agente falhou', error);
      return { kind: 'network-error' };
    }
  }

  async function deliver(request: ExtensionChunkRequest, gen: number): Promise<void> {
    for (let retry = 0; isCurrent(gen); retry += 1) {
      const result = await attempt(request);
      if (!isCurrent(gen)) return;
      const verdict = classifySendAttempt(result);
      const status = result.kind === 'response' ? result.status : null;
      if (verdict === 'delivered') {
        report('sent', status);
        return;
      }
      if (verdict === 'rejected') {
        logger.warn('Agente recusou o trecho', { status });
        report('rejected', status);
        return;
      }
      if (retry >= AGENTE_SEND_MAX_RETRIES) {
        logger.error('envio ao Agente falhou depois das novas tentativas', { status });
        report('failed', status);
        return;
      }
      report('retrying', status);
      await sleep(retryDelayMs(retry));
    }
  }

  async function run(): Promise<void> {
    try {
      while (waiting.length > 0 && !disposed) {
        const request = waiting.shift()!;
        await deliver(request, generation);
      }
    } finally {
      running = false;
    }
  }

  /** Enfileira na ordem recebida. Acima do teto, descarta o mais antigo. */
  function submit(requests: readonly ExtensionChunkRequest[]): void {
    if (disposed || requests.length === 0) return;
    for (const request of requests) {
      waiting.push(request);
      if (waiting.length > AGENTE_SEND_MAX_QUEUED) {
        waiting.shift();
        logger.warn('fila de envio ao Agente cheia — trecho mais antigo descartado');
      }
    }
    if (!running) {
      running = true;
      idle = run();
    }
  }

  /** Descarta a fila e interrompe o trecho que estiver esperando nova tentativa. */
  function cancelAll(): void {
    generation += 1;
    waiting.length = 0;
  }

  function dispose(): void {
    disposed = true;
    cancelAll();
  }

  /** Só para testes: espera a fila atual terminar (inclui as esperas de retry). */
  function whenIdle(): Promise<void> {
    return idle;
  }

  return { submit, cancelAll, dispose, whenIdle };
}

export type AgenteSender = ReturnType<typeof createAgenteSender>;
