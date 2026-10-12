/** Política pura de reenvio ao Agente (Fase 7, WR-01). */
import { describe, expect, it } from 'vitest';
import {
  AGENTE_SEND_MAX_RETRIES,
  classifyExhausted,
  classifySendAttempt,
  retryDelayMs,
} from './sendRetryPolicy';

describe('sendRetryPolicy / classifySendAttempt', () => {
  it('resposta ok é entregue', () => {
    expect(classifySendAttempt({ kind: 'response', ok: true, status: 202 })).toBe('delivered');
  });

  it('erro de rede, 5xx e 429 são reenviáveis', () => {
    expect(classifySendAttempt({ kind: 'network-error' })).toBe('retryable');
    expect(classifySendAttempt({ kind: 'response', ok: false, status: 500 })).toBe('retryable');
    expect(classifySendAttempt({ kind: 'response', ok: false, status: 503 })).toBe('retryable');
    expect(classifySendAttempt({ kind: 'response', ok: false, status: 429 })).toBe('retryable');
  });

  it('outros 4xx são definitivos (chave recusada, sessão inválida)', () => {
    expect(classifySendAttempt({ kind: 'response', ok: false, status: 401 })).toBe('rejected');
    expect(classifySendAttempt({ kind: 'response', ok: false, status: 404 })).toBe('rejected');
    expect(classifySendAttempt({ kind: 'response', ok: false, status: 422 })).toBe('rejected');
  });
});

describe('sendRetryPolicy / retryDelayMs', () => {
  it('espera 1 s, 2 s e 4 s nas 3 novas tentativas', () => {
    expect(AGENTE_SEND_MAX_RETRIES).toBe(3);
    expect([0, 1, 2].map(retryDelayMs)).toEqual([1_000, 2_000, 4_000]);
  });
});

describe('sendRetryPolicy / classifyExhausted (D-18, B3-b)', () => {
  const base = { resendEnabled: true, attemptStatuses: [500, 500, 500, 500], ageMs: 180_000, serverErrorMaxAgeMs: 120_000 };

  it('reenvio desligado: desiste (Fase 7), qualquer que seja o motivo', () => {
    expect(classifyExhausted({ ...base, resendEnabled: false })).toBe('drop-failed');
    expect(classifyExhausted({ ...base, resendEnabled: false, attemptStatuses: [null, null] })).toBe('drop-failed');
  });

  it('limite numérico: só 500 em todas as tentativas e item mais velho que o limite é retirado', () => {
    expect(classifyExhausted(base)).toBe('drop-server-rejected');
    expect(classifyExhausted({ ...base, ageMs: 30_000 })).toBe('hold');
    expect(classifyExhausted({ ...base, attemptStatuses: [500, 503, 500, 500] })).toBe('hold');
  });

  it('rede, 429, 502, 503 e 504 nunca retiram; limite null (retirada-nunca) também não', () => {
    for (const status of [null, 429, 502, 503, 504]) {
      expect(classifyExhausted({ ...base, attemptStatuses: [status, status, status, status] })).toBe('hold');
    }
    expect(classifyExhausted({ ...base, serverErrorMaxAgeMs: null })).toBe('hold');
  });
});
