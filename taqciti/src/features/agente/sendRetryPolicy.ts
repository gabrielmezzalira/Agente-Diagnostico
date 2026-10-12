/**
 * Política pura de reenvio ao Agente (Fase 7, WR-01, decisão do time em
 * 2026-09-27): fila ordenada + até 3 novas tentativas com espera crescente
 * (1 s, 2 s, 4 s) em erro de rede, 5xx e 429. Qualquer outro 4xx (chave
 * recusada, sessão inválida) é definitivo — tentar de novo não muda nada.
 *
 * Fase 8 (D-18): a fila é durável e nada antigo é descartado por teto. Esgotadas as novas tentativas,
 * `classifyExhausted` decide o destino do item: com o reenvio desligado vale a Fase 7 (desiste e a fila
 * segue); com ele ligado o item fica no topo ("fora do ar") e a fila só anda quando o Agente volta.
 *
 * RISCO ACEITO (D-19): reenviar pode duplicar uma fala no backend se o envio deu timeout DEPOIS de o
 * backend já ter gravado. A defesa é o `chunk_id` por fala (migração do plano 08-09); o reenvio só liga
 * pela decisão B3, no plano 08-19 — até lá `AGENTE_OUTBOX_RESEND_ENABLED` fica desligado.
 *
 * Sem `fetch`, `setTimeout` nem `chrome` — só funções puras.
 */

/** Novas tentativas depois da primeira (total de até 4 envios por trecho). */
export const AGENTE_SEND_MAX_RETRIES = 3;

/** Espera antes da 1ª nova tentativa; dobra a cada uma (1 s, 2 s, 4 s). */
export const AGENTE_SEND_RETRY_BASE_MS = 1_000;

/**
 * Decisão B3-b do time (checkpoint do plano 08-09, registrada em 08-09-SUMMARY.md, 2026-10-12):
 * `retirada-nunca` — nenhuma fala é descartada por HTTP 500; o item fica no topo ("fora do ar"). Foi o
 * padrão por falta de resposta do time ("sem resposta do time"), que é o D-18 literal.
 * Valores possíveis: `retirada-500-2min` → 120_000; `retirada-500-ajustada` → minutos × 60_000; `null`.
 * Efeito colateral de um número: o webhook devolve 500 para QUALQUER erro de banco
 * (`backend/app/routers/webhook.py`), então uma queda de banco maior que o limite descartaria falas ao vivo
 * (elas ficam no rastro `taq:agenteDropTrace`). Para mudar a regra, troque só este valor e o teste que o fixa.
 */
export const AGENTE_OUTBOX_SERVER_ERROR_MAX_AGE_MS: number | null = null;

export type SendAttemptResult =
  { kind: 'response'; ok: boolean; status: number } | { kind: 'network-error' };

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

export type ExhaustedVerdict = 'drop-failed' | 'drop-server-rejected' | 'hold';

export interface ExhaustedInput {
  resendEnabled: boolean;
  /** HTTP de cada tentativa do ciclo; `null` = erro de rede. */
  attemptStatuses: readonly (number | null)[];
  /** Há quanto tempo o item está na fila (`now - enqueuedAt`). */
  ageMs: number;
  serverErrorMaxAgeMs: number | null;
}

/**
 * O que fazer com o item depois de esgotadas as novas tentativas por queda do Agente. Reenvio desligado:
 * desiste (Fase 7). Ligado: só retira por HTTP 500 quando a B3-b mandou um limite numérico, TODAS as
 * tentativas do ciclo foram exatamente 500 e o item é mais velho que o limite; rede, 429, 502, 503 e 504
 * nunca retiram — o item fica no topo.
 */
export function classifyExhausted(input: ExhaustedInput): ExhaustedVerdict {
  if (!input.resendEnabled) return 'drop-failed';
  const limit = input.serverErrorMaxAgeMs;
  const allServerErrors =
    input.attemptStatuses.length > 0 && input.attemptStatuses.every((s) => s === 500);
  return limit !== null && allServerErrors && input.ageMs > limit
    ? 'drop-server-rejected'
    : 'hold';
}
