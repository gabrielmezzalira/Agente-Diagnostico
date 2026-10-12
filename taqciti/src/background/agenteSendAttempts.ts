/**
 * O laço de tentativas de UM trecho (Fase 7, WR-01), extraído do sender para ele caber em 200 linhas:
 * envia, classifica a resposta pela `sendRetryPolicy.ts` e espera 1 s / 2 s / 4 s entre as novas
 * tentativas, reportando cada uma como "tentando de novo". Cada tentativa confere a "geração"
 * (`isCurrent`), então um `cancelAll()` do sender interrompe o trecho que estiver esperando.
 *
 * Fase 8: não decide mais o destino do trecho — devolve o `Cycle` (entregue, recusado, esgotado ou
 * cancelado) e quem decide é `agenteSendSettle.ts`; as falhas por HTTP de cada tentativa vão no ciclo
 * esgotado para a regra da B3-b.
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

/** Resultado de uma rodada de tentativas para um trecho. `statuses`: HTTP de cada tentativa (`null` = rede). */
export type Cycle =
  | { kind: 'delivered' | 'rejected'; status: number }
  | { kind: 'exhausted'; statuses: (number | null)[] }
  | { kind: 'cancelled' };

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

  return async function deliver(request: ExtensionChunkRequest, gen: number): Promise<Cycle> {
    const statuses: (number | null)[] = [];
    for (let retry = 0; env.isCurrent(gen); retry += 1) {
      const result = await attempt(request);
      if (!env.isCurrent(gen)) break;
      const verdict = classifySendAttempt(result);
      const status = result.kind === 'response' ? result.status : null;
      if (verdict === 'delivered') return { kind: 'delivered', status: status ?? 0 };
      if (verdict === 'rejected') return { kind: 'rejected', status: status ?? 0 };
      statuses.push(status);
      if (retry >= AGENTE_SEND_MAX_RETRIES) return { kind: 'exhausted', statuses };
      env.report('retrying', status);
      await env.sleep(retryDelayMs(retry));
    }
    return { kind: 'cancelled' };
  };
}
