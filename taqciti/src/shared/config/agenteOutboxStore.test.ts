/**
 * Store da fila durável (Fase 8, plano 08-11, Task 1): escritor único com fila serializada e valor
 * inteiro (Pitfall 2), teto sem descartar o antigo e nenhuma chave no storage (T-08-20). Cada teste
 * recarrega o módulo (`resetModules`) porque o store guarda um cache em memória, como o service
 * worker a cada boot.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OutboxItem } from '@/features/agente/outbox';
import { installChromeStorageMock } from '@/test/chromeStorageMock';
import { STORAGE_KEYS } from './constants';

const KEY = STORAGE_KEYS.agenteOutbox;
const S1 = '11111111-1111-1111-1111-111111111111';
const S2 = '22222222-2222-2222-2222-222222222222';

function item(n: number, extra: Partial<OutboxItem> = {}): OutboxItem {
  return {
    chunkId: `c${n}`,
    backendUrl: 'https://agente.test',
    sessionId: S1,
    text: `fala ${n}`,
    speaker: null,
    enqueuedAt: n,
    ...extra,
  };
}

async function loadStore(local: Record<string, unknown> = {}) {
  const mock = installChromeStorageMock({ local });
  const store = await import('./agenteOutboxStore');
  return { mock, store };
}

beforeEach(() => {
  vi.resetModules();
});

describe('chave própria', () => {
  it('usa taq:agenteOutbox e não reaproveita a chave legada taq:outbox', () => {
    expect(KEY).toBe('taq:agenteOutbox');
    expect(KEY).not.toBe(STORAGE_KEYS.outbox);
  });
});

describe('appendToOutbox', () => {
  it('duas escritas concorrentes mantêm os itens das duas, em ordem (Pitfall 2)', async () => {
    const { mock, store } = await loadStore();
    const [first, second] = await Promise.all([
      store.appendToOutbox([item(1)]),
      store.appendToOutbox([item(2)]),
    ]);
    expect(first.queue.map((i) => i.chunkId)).toEqual(['c1']);
    expect(second.queue.map((i) => i.chunkId)).toEqual(['c1', 'c2']);
    expect((mock.local.values[KEY] as OutboxItem[]).map((i) => i.chunkId)).toEqual(['c1', 'c2']);
    expect(mock.local.set).toHaveBeenCalledTimes(2);
  });

  it('acima do teto recusa só o excedente novo e devolve o overflow', async () => {
    const { mock, store } = await loadStore({ [KEY]: [item(1), item(2)] });
    const result = await store.appendToOutbox([item(3), item(4)], 3);
    expect(result.overflowed).toBe(1);
    expect(result.queue.map((i) => i.chunkId)).toEqual(['c1', 'c2', 'c3']);
    expect((mock.local.values[KEY] as OutboxItem[]).map((i) => i.chunkId)).toEqual(['c1', 'c2', 'c3']);
  });

  it('sem nada a acrescentar não grava', async () => {
    const { mock, store } = await loadStore({ [KEY]: [item(1)] });
    const result = await store.appendToOutbox([]);
    expect(result).toEqual({ queue: [item(1)], overflowed: 0 });
    expect(mock.local.set).not.toHaveBeenCalled();
  });

  it('o JSON cru do storage nunca contém a chave nem headers (T-08-20)', async () => {
    const { mock, store } = await loadStore();
    const dirty = { ...item(1), headers: { 'x-agente-key': 's3cr3t' } } as OutboxItem;
    await store.appendToOutbox([dirty]);
    const raw = JSON.stringify(mock.local.values[KEY]);
    expect(raw).not.toContain('s3cr3t');
    expect(raw).not.toContain('x-agente-key');
  });
});

describe('remoção, limpeza e contagem', () => {
  it('removeOutboxItem remove só o item pedido', async () => {
    const { mock, store } = await loadStore({ [KEY]: [item(1), item(2), item(3)] });
    await store.removeOutboxItem('c2');
    expect((mock.local.values[KEY] as OutboxItem[]).map((i) => i.chunkId)).toEqual(['c1', 'c3']);
  });

  it('remover um id que não existe não grava', async () => {
    const { mock, store } = await loadStore({ [KEY]: [item(1)] });
    await store.removeOutboxItem('nao-existe');
    expect(mock.local.set).not.toHaveBeenCalled();
  });

  it('clearOutbox esvazia a fila', async () => {
    const { mock, store } = await loadStore({ [KEY]: [item(1), item(2)] });
    await store.clearOutbox();
    expect(mock.local.values[KEY]).toEqual([]);
    expect(await store.loadOutbox()).toEqual([]);
  });

  it('countOutboxItemsForSession conta só a sessão pedida', async () => {
    const { store } = await loadStore({ [KEY]: [item(1), item(2, { sessionId: S2 }), item(3)] });
    expect(await store.countOutboxItemsForSession(S1)).toBe(2);
    expect(await store.countOutboxItemsForSession(S2)).toBe(1);
  });

  it('loadOutbox normaliza o que veio do storage (lixo vira lista vazia)', async () => {
    const { store } = await loadStore({ [KEY]: 'lixo' });
    expect(await store.loadOutbox()).toEqual([]);
  });
});
