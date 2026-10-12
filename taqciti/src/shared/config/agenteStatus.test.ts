/** Status de runtime do envio ao Agente e o texto que a tela mostra (Fase 7, WR-07). */
import { describe, expect, it } from 'vitest';
import { EMPTY_DROP_TRACE, type AgenteDropTrace } from './agenteDeliveryStore';
import {
  describeAgenteStreaming,
  describeDropTrace,
  EMPTY_AGENTE_STATUS,
  normalizeAgenteStatus,
  type AgenteStreamingStatus,
} from './agenteStatus';

const clock = () => '14:03:12';
const status = (overrides: Partial<AgenteStreamingStatus>): AgenteStreamingStatus => ({
  ...EMPTY_AGENTE_STATUS,
  ...overrides,
});

describe('agenteStatus / describeAgenteStreaming', () => {
  it('config não pronta: mostra o motivo da config, ignorando o status de runtime', () => {
    const view = describeAgenteStreaming('disabled', status({ lastOutcome: 'rejected', lastHttpStatus: 401 }), clock);
    expect(view).toEqual({ tone: 'muted', text: 'Desligado — nada é enviado ao Agente.' });
  });

  it('pronto e nada enviado ainda: não promete entrega', () => {
    expect(describeAgenteStreaming('ready', EMPTY_AGENTE_STATUS, clock)).toEqual({
      tone: 'muted',
      text: 'Ligado — pronto para enviar. O envio começa quando alguém falar.',
    });
  });

  it('último envio ok: mostra a hora', () => {
    const view = describeAgenteStreaming('ready', status({ lastOutcome: 'sent', lastHttpStatus: 202, lastAttemptAt: 1 }), clock);
    expect(view).toEqual({ tone: 'muted', text: 'Ligado — último envio às 14:03:12.' });
  });

  it('401: chave recusada', () => {
    const view = describeAgenteStreaming('ready', status({ lastOutcome: 'rejected', lastHttpStatus: 401 }), clock);
    expect(view.tone).toBe('danger');
    expect(view.text).toContain('chave de autenticação não foi aceita (HTTP 401)');
  });

  it('404/422: aponta para o ID da sessão', () => {
    const view = describeAgenteStreaming('ready', status({ lastOutcome: 'rejected', lastHttpStatus: 422 }), clock);
    expect(view.text).toContain('confira o ID da sessão');
  });

  it('tentando de novo sem conexão: aviso, não erro', () => {
    const view = describeAgenteStreaming('ready', status({ lastOutcome: 'retrying', lastHttpStatus: null }), clock);
    expect(view).toEqual({
      tone: 'warning',
      text: 'Falha ao enviar (sem conexão com o backend) — tentando de novo…',
    });
  });

  it('falhou depois das novas tentativas: erro com o motivo', () => {
    const view = describeAgenteStreaming('ready', status({ lastOutcome: 'failed', lastHttpStatus: 503 }), clock);
    expect(view.tone).toBe('danger');
    expect(view.text).toContain('HTTP 503');
    expect(view.text).toContain('não chegou ao Agente');
  });
});

describe('agenteStatus / envio interrompido por reinício (WR-04)', () => {
  it('não afirma que as tentativas se esgotaram, nem inventa um motivo HTTP', () => {
    const view = describeAgenteStreaming(
      'ready',
      status({ lastOutcome: 'interrupted', lastHttpStatus: 503 }),
      clock,
    );
    expect(view.tone).toBe('danger');
    expect(view.text).toContain('interrompido');
    expect(view.text).toContain('pode não ter chegado ao Agente');
    expect(view.text).not.toContain('503');
    expect(view.text).not.toContain('novas tentativas');
  });

  it('normalize aceita "interrupted" (e continua recusando valor desconhecido)', () => {
    expect(normalizeAgenteStatus({ lastOutcome: 'interrupted' }).lastOutcome).toBe('interrupted');
    expect(normalizeAgenteStatus({ lastOutcome: 'qualquer' as never }).lastOutcome).toBeNull();
  });
});

describe('agenteStatus / describeDropTrace (rastro de falas descartadas, Fase 8)', () => {
  const when = (epochMs: number) => `em-${epochMs}`;
  const SESSION = '1a2b3c4d-1111-1111-1111-111111111111';
  const trace = (overrides: Partial<AgenteDropTrace>): AgenteDropTrace => ({
    sessionId: SESSION,
    count: 1,
    lastAt: 7,
    lastReason: 'rejected',
    lastHttpStatus: 500,
    ...overrides,
  });

  it('sem rastro (contagem 0): não há nota', () => {
    expect(describeDropTrace(EMPTY_DROP_TRACE, when)).toBeNull();
  });

  it('uma fala recusada: singular, 8 primeiros caracteres da sessão e o HTTP', () => {
    expect(describeDropTrace(trace({}), when)).toBe(
      '1 fala da sessão 1a2b3c4d… não chegou ao Agente — a última em em-7 (recusada pelo Agente, HTTP 500).',
    );
  });

  it('duas falas sem conexão: plural e motivo "sem conexão com o backend"', () => {
    expect(describeDropTrace(trace({ count: 2, lastReason: 'failed', lastHttpStatus: null }), when)).toBe(
      '2 falas da sessão 1a2b3c4d… não chegaram ao Agente — a última em em-7 (sem conexão com o backend).',
    );
  });

  it('falha com HTTP e fila cheia têm motivo próprio', () => {
    expect(describeDropTrace(trace({ lastReason: 'failed', lastHttpStatus: 503 }), when)).toContain('(HTTP 503)');
    expect(describeDropTrace(trace({ lastReason: 'overflow', lastHttpStatus: null }), when)).toContain('(fila cheia)');
  });
});

describe('agenteStatus / normalizeAgenteStatus', () => {
  it('ausente ou lixo vira o status vazio', () => {
    expect(normalizeAgenteStatus(null)).toEqual(EMPTY_AGENTE_STATUS);
    expect(
      normalizeAgenteStatus({ lastOutcome: 'qualquer' as never, lastHttpStatus: '401' as never }),
    ).toEqual(EMPTY_AGENTE_STATUS);
  });
});
