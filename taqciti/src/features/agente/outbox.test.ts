/**
 * Fila durável do reenvio (Fase 8, plano 08-11, Task 1): funções puras — item só com 6 campos
 * (T-08-20), teto que recusa só o excedente NOVO (nunca descarta o mais antigo) e request remontado
 * com a chave da config atual.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_AGENTE_CONFIG, type AgenteConfig } from '@/shared/config/agenteConfig';
import type { PendingPhrase } from './phraseBatcher';
import {
  AGENTE_OUTBOX_MAX_ITEMS,
  AGENTE_OUTBOX_RESEND_ENABLED,
  AGENTE_OUTBOX_RETRY_INTERVAL_MS,
  appendItems,
  buildOutboxRequest,
  countForSession,
  normalizeOutbox,
  phrasesToOutboxItems,
  type OutboxItem,
} from './outbox';

const URL_A = 'https://agente.test';
const S1 = '11111111-1111-1111-1111-111111111111';
const S2 = '22222222-2222-2222-2222-222222222222';

function phrase(text: string, extra: Partial<PendingPhrase> = {}): PendingPhrase {
  return {
    sessionId: S1,
    backendUrl: URL_A,
    segmentKey: 'seg',
    speaker: 'Ana',
    text,
    firstAt: 1,
    lastAt: 2,
    ...extra,
  };
}

function item(n: number, extra: Partial<OutboxItem> = {}): OutboxItem {
  return {
    chunkId: `c${n}`,
    backendUrl: URL_A,
    sessionId: S1,
    text: `fala ${n}`,
    speaker: null,
    enqueuedAt: n,
    ...extra,
  };
}

function config(extra: Partial<AgenteConfig> = {}): AgenteConfig {
  return { ...DEFAULT_AGENTE_CONFIG, agenteBackendUrl: URL_A, ...extra };
}

describe('constantes', () => {
  it('teto de 1000, intervalo de 15 s e reenvio automático nasce desligado (B3)', () => {
    expect(AGENTE_OUTBOX_MAX_ITEMS).toBe(1000);
    expect(AGENTE_OUTBOX_RETRY_INTERVAL_MS).toBe(15_000);
    expect(AGENTE_OUTBOX_RESEND_ENABLED).toBe(false);
  });
});

describe('phrasesToOutboxItems', () => {
  it('uma fala vira um item, na ordem, com chunkId de makeId e enqueuedAt', () => {
    let n = 0;
    const items = phrasesToOutboxItems(
      [phrase('um'), phrase('dois', { speaker: null, sessionId: S2 })],
      () => `id-${++n}`,
      1000,
    );
    expect(items).toEqual([
      { chunkId: 'id-1', backendUrl: URL_A, sessionId: S1, text: 'um', speaker: 'Ana', enqueuedAt: 1000 },
      { chunkId: 'id-2', backendUrl: URL_A, sessionId: S2, text: 'dois', speaker: null, enqueuedAt: 1000 },
    ]);
  });
});

describe('appendItems: teto sem descartar o mais antigo', () => {
  it('999 + 3 novos com teto 1000: os 999 intactos, 1 novo entra e 2 estouram', () => {
    const queue = Array.from({ length: 999 }, (_, i) => item(i));
    const incoming = [item(1001), item(1002), item(1003)];
    const result = appendItems(queue, incoming, 1000);
    expect(result.queue).toHaveLength(1000);
    expect(result.queue.slice(0, 999)).toEqual(queue);
    expect(result.queue[999]).toEqual(incoming[0]);
    expect(result.overflowed).toBe(2);
  });

  it('abaixo do teto: tudo entra, em ordem, e nada estoura', () => {
    const result = appendItems([item(1)], [item(2), item(3)], 1000);
    expect(result.queue.map((i) => i.chunkId)).toEqual(['c1', 'c2', 'c3']);
    expect(result.overflowed).toBe(0);
  });

  it('fila já cheia: recusa todos os novos e não mexe na fila', () => {
    const queue = [item(1), item(2)];
    const result = appendItems(queue, [item(3)], 2);
    expect(result.queue).toEqual(queue);
    expect(result.overflowed).toBe(1);
  });
});

describe('normalizeOutbox: lista branca (T-08-20)', () => {
  it('descarta headers/campos extras e mantém só os 6 campos', () => {
    const raw = [{ ...item(1), headers: { 'x-agente-key': 's3cr3t' }, extra: 1 }];
    const [only] = normalizeOutbox(raw);
    expect(only).toEqual(item(1));
    expect(JSON.stringify(normalizeOutbox(raw))).not.toContain('s3cr3t');
  });

  it('descarta entradas sem chunkId, backendUrl, sessionId ou text; lixo vira fila vazia', () => {
    const valid = item(1);
    const raw = [
      valid,
      { ...item(2), chunkId: undefined },
      { ...item(3), backendUrl: 5 },
      { ...item(4), sessionId: '' },
      { ...item(5), text: undefined },
      null,
      'x',
    ];
    expect(normalizeOutbox(raw)).toEqual([valid]);
    expect(normalizeOutbox(null)).toEqual([]);
    expect(normalizeOutbox({ not: 'a list' })).toEqual([]);
  });
});

describe('buildOutboxRequest', () => {
  it('monta o request para a URL da config com o session_id do item e a chave ATUAL', () => {
    const request = buildOutboxRequest(config({ agenteApiKey: 's3cr3t', agenteSessionId: S2 }), item(1, { speaker: 'Ana' }));
    expect(request?.url).toBe(`${URL_A}/webhook/extension`);
    expect(JSON.parse(String(request?.init.body))).toEqual({ session_id: S1, text: 'fala 1', speaker: 'Ana' });
    expect((request?.init.headers as Record<string, string>)['x-agente-key']).toBe('s3cr3t');
  });

  it('item de outro backend não é enviado (a chave do backend novo não vai para o antigo)', () => {
    expect(buildOutboxRequest(config(), item(1, { backendUrl: 'https://outro.test' }))).toBeNull();
  });
});

describe('countForSession', () => {
  it('conta só os itens da sessão pedida', () => {
    const queue = [item(1), item(2, { sessionId: S2 }), item(3)];
    expect(countForSession(queue, S1)).toBe(2);
    expect(countForSession(queue, S2)).toBe(1);
    expect(countForSession(queue, 'nenhuma')).toBe(0);
  });
});
