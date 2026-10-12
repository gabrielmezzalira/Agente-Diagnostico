/**
 * Status de entrega e rastro de falas descartadas (Fase 8, plano 08-11, Task 2): ambos em
 * `chrome.storage.local` (o content script do Meet não lê `storage.session`, Pitfall 3), cada um na
 * sua chave com um único dono — nenhuma gravação de status apaga o rastro (T-08-44), nada de
 * segredo no storage (T-08-20). Cada teste recarrega o módulo (`resetModules`).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeStorageMock } from '@/test/chromeStorageMock';
import { STORAGE_KEYS } from './constants';

const DELIVERY_KEY = STORAGE_KEYS.agenteDelivery;
const TRACE_KEY = STORAGE_KEYS.agenteDropTrace;
const S1 = '11111111-1111-1111-1111-111111111111';
const S2 = '22222222-2222-2222-2222-222222222222';

async function loadStore(local: Record<string, unknown> = {}) {
  const mock = installChromeStorageMock({ local });
  const store = await import('./agenteDeliveryStore');
  return { mock, store };
}

beforeEach(() => {
  vi.resetModules();
});

describe('status de entrega', () => {
  it('sem valor gravado, loadDelivery devolve EMPTY_DELIVERY', async () => {
    const { store } = await loadStore();
    expect(await store.loadDelivery()).toEqual(store.EMPTY_DELIVERY);
    expect(store.EMPTY_DELIVERY).toEqual({
      status: 'ok',
      queued: 0,
      overflow: 0,
      httpStatus: null,
      recoveredAt: null,
    });
  });

  it('writeDelivery grava o valor inteiro em taq:agenteDelivery (storage.local)', async () => {
    const { mock, store } = await loadStore();
    const record = { status: 'offline', queued: 5, overflow: 0, httpStatus: null, recoveredAt: null } as const;
    await store.writeDelivery(record);
    expect(mock.local.values[DELIVERY_KEY]).toEqual(record);
    expect(mock.session.set).not.toHaveBeenCalled();
    expect(await store.loadDelivery()).toEqual(record);
  });

  it('normalizeDelivery descarta campo desconhecido e status fora da lista vira EMPTY_DELIVERY', async () => {
    const { store } = await loadStore();
    const clean = store.normalizeDelivery({
      status: 'failed',
      queued: 2,
      overflow: 1,
      httpStatus: 503,
      recoveredAt: 9,
      agenteApiKey: 's3cr3t',
    });
    expect(clean).toEqual({ status: 'failed', queued: 2, overflow: 1, httpStatus: 503, recoveredAt: 9 });
    expect(store.normalizeDelivery({ status: 'qualquer', queued: 4 })).toEqual(store.EMPTY_DELIVERY);
    expect(store.normalizeDelivery(null)).toEqual(store.EMPTY_DELIVERY);
  });

  it('o JSON cru de taq:agenteDelivery nunca contém a chave', async () => {
    const { mock, store } = await loadStore();
    await store.writeDelivery({
      status: 'rejected',
      queued: 0,
      overflow: 0,
      httpStatus: 401,
      recoveredAt: null,
      agenteApiKey: 's3cr3t',
    } as never);
    expect(JSON.stringify(mock.local.values[DELIVERY_KEY])).not.toContain('s3cr3t');
  });

  it('subscribeDelivery entrega o valor atual e depois cada mudança, normalizado', async () => {
    const { mock, store } = await loadStore({
      [DELIVERY_KEY]: { status: 'offline', queued: 3, overflow: 0, httpStatus: null, recoveredAt: null },
    });
    const seen: unknown[] = [];
    const stop = store.subscribeDelivery((value) => seen.push(value));
    await vi.waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]).toMatchObject({ status: 'offline', queued: 3 });

    await mock.local.set({ [DELIVERY_KEY]: { status: 'lixo' } });
    expect(seen[1]).toEqual(store.EMPTY_DELIVERY);
    stop();
    await mock.local.set({ [DELIVERY_KEY]: { status: 'failed' } });
    expect(seen).toHaveLength(2);
  });
});

describe('rastro de falas descartadas', () => {
  const drop = { sessionId: S1, count: 1, reason: 'rejected', httpStatus: 500, at: 1000 } as const;

  it('sem nada gravado, loadDropTrace devolve EMPTY_DROP_TRACE', async () => {
    const { store } = await loadStore();
    expect(await store.loadDropTrace()).toEqual(store.EMPTY_DROP_TRACE);
    expect(store.EMPTY_DROP_TRACE).toEqual({
      sessionId: null,
      count: 0,
      lastAt: null,
      lastReason: null,
      lastHttpStatus: null,
    });
  });

  it('um status "ok" gravado depois NÃO apaga o rastro (T-08-44)', async () => {
    const { mock, store } = await loadStore();
    await store.recordDroppedUtterances(drop);
    await store.writeDelivery({ status: 'ok', queued: 0, overflow: 0, httpStatus: 202, recoveredAt: 2000 });
    expect(await store.loadDropTrace()).toEqual({
      sessionId: S1,
      count: 1,
      lastAt: 1000,
      lastReason: 'rejected',
      lastHttpStatus: 500,
    });
    expect(mock.local.values[TRACE_KEY]).toBeDefined();
  });

  it('duas quedas concorrentes na mesma sessão somam (fila serializada)', async () => {
    const { store } = await loadStore();
    await Promise.all([
      store.recordDroppedUtterances({ ...drop, count: 1, at: 1000 }),
      store.recordDroppedUtterances({ ...drop, count: 2, reason: 'failed', httpStatus: null, at: 2000 }),
    ]);
    expect(await store.loadDropTrace()).toEqual({
      sessionId: S1,
      count: 3,
      lastAt: 2000,
      lastReason: 'failed',
      lastHttpStatus: null,
    });
  });

  it('queda em outra sessão recomeça a contagem', async () => {
    const { store } = await loadStore();
    await store.recordDroppedUtterances({ ...drop, count: 3 });
    await store.recordDroppedUtterances({ ...drop, sessionId: S2, count: 1, reason: 'overflow', httpStatus: null, at: 3000 });
    expect(await store.loadDropTrace()).toEqual({
      sessionId: S2,
      count: 1,
      lastAt: 3000,
      lastReason: 'overflow',
      lastHttpStatus: null,
    });
  });

  it('sobrevive a um reinício (módulo recarregado lê do storage.local)', async () => {
    const first = await loadStore();
    await first.store.recordDroppedUtterances(drop);
    vi.resetModules();
    const store = await import('./agenteDeliveryStore');
    expect((await store.loadDropTrace()).count).toBe(1);
  });

  it('o JSON cru não contém a chave nem texto de fala; campo desconhecido é descartado', async () => {
    const { mock, store } = await loadStore();
    await store.recordDroppedUtterances({ ...drop, text: 'fala secreta', agenteApiKey: 's3cr3t' } as never);
    const raw = JSON.stringify(mock.local.values[TRACE_KEY]);
    expect(raw).not.toContain('s3cr3t');
    expect(raw).not.toContain('fala secreta');
    expect(
      store.normalizeDropTrace({
        sessionId: S1,
        count: 2,
        lastAt: 5,
        lastReason: 'failed',
        lastHttpStatus: 502,
        text: 'x',
      }),
    ).toEqual({ sessionId: S1, count: 2, lastAt: 5, lastReason: 'failed', lastHttpStatus: 502 });
  });

  it('queda com contagem inválida não grava nada', async () => {
    const { mock, store } = await loadStore();
    await store.recordDroppedUtterances({ ...drop, count: 0 });
    expect(mock.local.set).not.toHaveBeenCalled();
  });

  it('subscribeDropTrace entrega o valor atual e depois cada mudança', async () => {
    const { mock, store } = await loadStore();
    const seen: unknown[] = [];
    const stop = store.subscribeDropTrace((value) => seen.push(value));
    await vi.waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]).toEqual(store.EMPTY_DROP_TRACE);
    await store.recordDroppedUtterances(drop);
    expect(seen.at(-1)).toMatchObject({ sessionId: S1, count: 1 });
    stop();
    expect(mock.listeners.size).toBe(0);
  });
});
