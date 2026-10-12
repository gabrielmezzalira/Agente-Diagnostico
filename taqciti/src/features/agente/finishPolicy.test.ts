/**
 * Política do encerramento da sessão do Agente (Fase 8, B4-b, plano 08-16). Os testes FIXAM o valor de
 * produção de cada tempo: ninguém troca um número sem decisão do time (o teste quebra junto).
 */
import { describe, expect, it } from 'vitest';
import {
  AGENTE_FINISH_ALARM_PREFIX,
  AGENTE_FINISH_DRAIN_CHECK_MS,
  AGENTE_FINISH_DRAIN_GRACE_MS,
  AGENTE_FINISH_MAX_TRIES,
  AGENTE_FINISH_POLL_MS,
  AGENTE_STALLED_SEND_CLOSE_MS,
  AgenteFinishError,
  backoffAfterFailure,
  nextCheckAt,
} from './finishPolicy';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

describe('finishPolicy / constantes de produção (decisão B4-b, 2026-10-12)', () => {
  it('AGENTE_STALLED_SEND_CLOSE_MS vale cinco minutos (decisão B4-b: "espera de 5 minutos")', () => {
    expect(AGENTE_STALLED_SEND_CLOSE_MS).toBe(5 * MINUTE);
    expect(AGENTE_STALLED_SEND_CLOSE_MS).toBe(300_000);
  });

  it('reconferência a cada 30 s; 10 s de graça para a última fala em voo; checagem a cada 1 s', () => {
    expect(AGENTE_FINISH_POLL_MS).toBe(30_000);
    expect(AGENTE_FINISH_DRAIN_GRACE_MS).toBe(10_000);
    expect(AGENTE_FINISH_DRAIN_CHECK_MS).toBe(1_000);
  });

  it('11 tentativas no máximo e prefixo próprio do alarme', () => {
    expect(AGENTE_FINISH_MAX_TRIES).toBe(11);
    expect(AGENTE_FINISH_ALARM_PREFIX).toBe('agente-finish:');
  });
});

describe('finishPolicy / backoffAfterFailure (limitado, sem laço infinito)', () => {
  it('tabela inteira: 30 s, 1, 2, 4, 8 min, depois 30 min, 1, 2, 4, 8 h', () => {
    const table = Array.from({ length: 10 }, (_, index) => backoffAfterFailure(index + 1));
    expect(table).toEqual([
      30_000,
      MINUTE,
      2 * MINUTE,
      4 * MINUTE,
      8 * MINUTE,
      30 * MINUTE,
      HOUR,
      2 * HOUR,
      4 * HOUR,
      8 * HOUR,
    ]);
  });

  it('a 11ª falha (e qualquer depois) desiste: null', () => {
    expect(backoffAfterFailure(AGENTE_FINISH_MAX_TRIES)).toBeNull();
    expect(backoffAfterFailure(12)).toBeNull();
    expect(backoffAfterFailure(1_000)).toBeNull();
  });

  it('o total das esperas fica perto de 16 h', () => {
    const total = Array.from({ length: 10 }, (_, index) => backoffAfterFailure(index + 1) ?? 0).reduce(
      (sum, wait) => sum + wait,
      0,
    );
    expect(total).toBe(15.5 * HOUR + 15.5 * MINUTE);
  });
});

describe('finishPolicy / nextCheckAt', () => {
  it('prazo longe: reconfere em now + 30 s', () => {
    expect(nextCheckAt(1_000, 1_000 + 5 * MINUTE)).toBe(1_000 + AGENTE_FINISH_POLL_MS);
  });

  it('prazo perto: o prazo vence a reconferência', () => {
    expect(nextCheckAt(1_000, 1_000 + 10_000)).toBe(11_000);
  });

  it('prazo já vencido: devolve o próprio prazo (passado)', () => {
    expect(nextCheckAt(10_000, 4_000)).toBe(4_000);
  });
});

describe('finishPolicy / AgenteFinishError', () => {
  it('carrega retryable e httpStatus', () => {
    const error = new AgenteFinishError('falhou', { retryable: true, httpStatus: 503 });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('AgenteFinishError');
    expect(error.retryable).toBe(true);
    expect(error.httpStatus).toBe(503);
  });

  it('sem status HTTP (rede) o httpStatus é null', () => {
    const error = new AgenteFinishError('rede', { retryable: true });
    expect(error.httpStatus).toBeNull();
  });
});
