/**
 * O laço de tentativas de UM trecho (Fase 7, WR-01), extraído do sender para ele caber em 200 linhas:
 * envia, classifica a resposta pela `sendRetryPolicy.ts`, espera 1 s / 2 s / 4 s entre as novas
 * tentativas e reporta cada resultado. Cada tentativa confere a "geração" (`isCurrent`), então um
 * `cancelAll()` do sender interrompe o trecho que estiver esperando.
 */
import type { ExtensionChunkRequest } from '@/shared/config/agenteConfig';
import type { AgenteSendOutcome } from '@/shared/config/agenteStatus';
import {
  AGENTE_SEND_MAX_RETRIES,
  classifySendAttempt,
  retryDelayMs,
  type SendAttemptResult,
} from '@/features/agente/sendRetryPolicy';
import { logger } from '@/shared/services/log';

export interface AttemptEnv {
  send: (request: ExtensionChunkRequest) => Promise<Response>;
  sleep: (ms: number) => Promise<void>;
  report: (outcome: AgenteSendOutcome, httpStatus: number | null) => void;
  isCurrent: (gen: number) => boolean;
}

export function createRequestDeliverer(env: AttemptEnv) {
  async function attempt(request: ExtensionChunkRequest): Promise<SendAttemptResult> {
    try {
      // `await` dentro do try: um `send` que lança de forma síncrona vira
      // erro de rede em vez de derrubar a fila (IN-10).
      const response = await env.send(request);
      return { kind: 'response', ok: response.ok, status: response.status };
    } catch (error) {
      logger.error('envio ao Agente falhou', error);
      return { kind: 'network-error' };
    }
  }

  return async function deliver(request: ExtensionChunkRequest, gen: number): Promise<void> {
    for (let retry = 0; env.isCurrent(gen); retry += 1) {
      const result = await attempt(request);
      if (!env.isCurrent(gen)) return;
      const verdict = classifySendAttempt(result);
      const status = result.kind === 'response' ? result.status : null;
      if (verdict === 'delivered') {
        env.report('sent', status);
        return;
      }
      if (verdict === 'rejected') {
        logger.warn('Agente recusou o trecho', { status });
        env.report('rejected', status);
        return;
      }
      if (retry >= AGENTE_SEND_MAX_RETRIES) {
        logger.error('envio ao Agente falhou depois das novas tentativas', { status });
        env.report('failed', status);
        return;
      }
      env.report('retrying', status);
      await env.sleep(retryDelayMs(retry));
    }
  };
}
