/**
 * O que fazer com o topo da fila depois de uma rodada de tentativas (Fase 8, D-18): entregue sai da fila
 * e vira "ok"; recusa definitiva (4xx) sai da fila e é avisada; esgotado por queda segue
 * `classifyExhausted` — Fase 7 (reenvio desligado: desiste), retirada por HTTP 500 só como a B3-b mandou,
 * ou fica no topo esperando o Agente voltar. Toda fala que sai sem entrega vai para o rastro
 * (`tracker.dropped`). Extraído do sender para ele caber em 200 linhas.
 */
import type { OutboxItem } from '@/features/agente/outbox';
import { AGENTE_OUTBOX_RESEND_ENABLED } from '@/features/agente/outbox';
import {
  AGENTE_OUTBOX_SERVER_ERROR_MAX_AGE_MS,
  classifyExhausted,
} from '@/features/agente/sendRetryPolicy';
import type { AgenteSendOutcome } from '@/shared/config/agenteStatus';
import { logger } from '@/shared/services/log';
import type { Cycle } from './agenteSendAttempts';
import type { DeliveryTracker } from './agenteDeliveryTracker';
import type { SendQueuePort } from './agenteSendQueue';

export interface SettleEnv {
  queue: SendQueuePort;
  tracker: DeliveryTracker;
  report: (outcome: AgenteSendOutcome, httpStatus: number | null) => void;
  /** Ausente = `AGENTE_OUTBOX_RESEND_ENABLED` (ligado, B3). */
  resendEnabled?: boolean;
  /** Ausente = `AGENTE_OUTBOX_SERVER_ERROR_MAX_AGE_MS` (B3-b); `null` = nunca retira. */
  serverErrorMaxAgeMs?: number | null;
  now: () => number;
}

/** `'hold'` = o topo ficou esperando o Agente voltar e o laço deve parar; `'next'` = a fila segue. */
export type Settled = 'next' | 'hold';

export function createCycleSettler(env: SettleEnv) {
  const { queue, tracker, report } = env;

  async function settleExhausted(item: OutboxItem, statuses: (number | null)[], remaining: number): Promise<Settled> {
    const last = statuses.at(-1) ?? null;
    const verdict = classifyExhausted({
      resendEnabled: env.resendEnabled ?? AGENTE_OUTBOX_RESEND_ENABLED,
      attemptStatuses: statuses,
      ageMs: env.now() - item.enqueuedAt,
      serverErrorMaxAgeMs:
        env.serverErrorMaxAgeMs === undefined
          ? AGENTE_OUTBOX_SERVER_ERROR_MAX_AGE_MS
          : env.serverErrorMaxAgeMs,
    });
    if (verdict === 'hold') {
      report('retrying', last);
      tracker.offline(remaining, last);
      return 'hold';
    }
    logger.error('envio ao Agente falhou depois das novas tentativas', { status: last });
    await queue.remove(item.chunkId);
    const reason = verdict === 'drop-failed' ? 'failed' : 'rejected';
    report(reason, last);
    tracker.dropped(item, reason, last, remaining - 1);
    return 'next';
  }

  return async function settle(item: OutboxItem, cycle: Cycle, remaining: number): Promise<Settled> {
    if (cycle.kind === 'cancelled') return 'next';
    if (cycle.kind === 'exhausted') return settleExhausted(item, cycle.statuses, remaining);
    await queue.remove(item.chunkId);
    if (cycle.kind === 'delivered') {
      report('sent', cycle.status);
      tracker.delivered(remaining - 1, cycle.status);
    } else {
      logger.warn('Agente recusou o trecho', { status: cycle.status });
      report('rejected', cycle.status);
      tracker.dropped(item, 'rejected', cycle.status, remaining - 1);
    }
    return 'next';
  };
}
