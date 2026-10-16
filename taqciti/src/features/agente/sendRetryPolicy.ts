/**
 * Política pura de reenvio ao Agente (Fase 7, WR-01, decisão do time em
 * 2026-09-27): fila ordenada + até 3 novas tentativas com espera crescente
 * (1 s, 2 s, 4 s) em erro de rede, 5xx e 429. Qualquer outro 4xx (chave
 * recusada, sessão inválida) é definitivo — tentar de novo não muda nada.
 *
 * RISCO ACEITO: `backend/app/routers/webhook.py::extension_webhook` não tem
 * idempotência. Se um envio der timeout DEPOIS de o backend já ter gravado, a
 * nova tentativa grava o mesmo trecho de novo (duplicata na transcrição). Se
 * duplicatas aparecerem na prática, a saída é um id de trecho reaproveitado
 * nas tentativas + o backend ignorar id repetido (mudança de contrato).
 *
 * Sem `fetch`, `setTimeout` nem `chrome` — só funções puras.
 */

/** Novas tentativas depois da primeira (total de até 4 envios por trecho). */
export const AGENTE_SEND_MAX_RETRIES = 3;

/** Espera antes da 1ª nova tentativa; dobra a cada uma (1 s, 2 s, 4 s). */
export const AGENTE_SEND_RETRY_BASE_MS = 1_000;

/**
 * Teto de trechos esperando na fila. Com o backend fora do ar, cada trecho
 * pode segurar a fila por dezenas de segundos (timeout × tentativas) — sem
 * teto, a fila cresceria sem limite na memória do service worker.
 */
export const AGENTE_SEND_MAX_QUEUED = 50;

export type SendAttemptResult =
  | { kind: 'response'; ok: boolean; status: number }
  | { kind: 'network-error' };

export type SendVerdict = 'delivered' | 'rejected' | 'retryable';

export function classifySendAttempt(result: SendAttemptResult): SendVerdict {
  if (result.kind === 'network-error') return 'retryable';
  if (result.ok) return 'delivered';
  if (result.status === 429 || result.status >= 500) return 'retryable';
  return 'rejected';
}

/** Espera antes da nova tentativa de índice `retryIndex` (0 = a primeira). */
export function retryDelayMs(retryIndex: number): number {
  return AGENTE_SEND_RETRY_BASE_MS * 2 ** retryIndex;
}
