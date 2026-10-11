/** Política pura de reenvio ao Agente (Fase 7, WR-01). */
import { describe, expect, it } from 'vitest';
import { AGENTE_SEND_MAX_RETRIES, classifySendAttempt, retryDelayMs } from './sendRetryPolicy';

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
