/**
 * Store das associações reunião → sessão (Fase 8, plano 08-01, Task 2): fila serializada de
 * escrita (T-08-03), lista branca de campos (T-08-02), semente `{}` preservada, remoção pontual e
 * assinatura para os painéis. Cada teste carrega o módulo do zero (`resetModules`) porque o store
 * mantém um cache em memória, como o service worker real a cada boot.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeStorageMock } from '@/test/chromeStorageMock';
import { STORAGE_KEYS } from './constants';
import type { MeetingAssociation } from '@/features/agente/association';

const KEY = STORAGE_KEYS.agenteAssociations;
const SID = '22222222-2222-2222-2222-222222222222';

async function loadStore(local: Record<string, unknown> = {}) {
  const mock = installChromeStorageMock({ local });
  const store = await import('./agenteAssociationStore');
  return { mock, store };
}

function entry(meetingId: string, extra: Partial<MeetingAssociation> = {}): MeetingAssociation {
  return { meetingId, state: 'pending', ...extra };
}

beforeEach(() => {
  vi.resetModules();
});

describe('fila serializada de escrita (T-08-03)', () => {
  it('duas aplicações concorrentes na mesma reunião: a segunda vê o resultado da primeira', async () => {
    const { mock, store } = await loadStore({ [KEY]: { m1: entry('m1') } });

    const [first, second] = await Promise.all([
      store.applyAssociationEvent('m1', { type: 'opened' }),
      store.applyAssociationEvent('m1', { type: 'deferred' }),
    ]);

    expect(first).toMatchObject({ applied: true, association: { state: 'choosing' } });
    expect(second).toMatchObject({ applied: true, association: { state: 'deferred' } });
    expect((mock.local.values[KEY] as Record<string, MeetingAssociation>).m1?.state).toBe('deferred');
    expect(mock.local.set).toHaveBeenCalledTimes(2);
  });

  it('reunião diferente em paralelo: nenhuma escrita apaga a outra', async () => {
    const { mock, store } = await loadStore();
    await Promise.all([
      store.applyAssociationEvent('m1', { type: 'created' }),
      store.applyAssociationEvent('m2', { type: 'created' }),
    ]);
    expect(Object.keys(mock.local.values[KEY] as object).sort()).toEqual(['m1', 'm2']);
  });

  it('evento ilegal não grava nada', async () => {
    const { mock, store } = await loadStore({ [KEY]: { m1: entry('m1') } });
    const result = await store.applyAssociationEvent('m1', { type: 'seed-consumed' });
    expect(result.applied).toBe(false);
    expect(mock.local.set).not.toHaveBeenCalled();
  });
});

describe('normalizeAssociations: lista branca (T-08-02)', () => {
  it('descarta campos desconhecidos (headers, apiKey) e estados fora da lista', async () => {
    const { store } = await loadStore();
    const map = store.normalizeAssociations({
      m1: {
        meetingId: 'm1',
        state: 'linked',
        sessionId: SID,
        origin: 'picker',
        headers: { 'x-agente-key': 's3cr3t' },
        apiKey: 's3cr3t',
      },
      m2: { meetingId: 'm2', state: 'inventado' },
      m3: { meetingId: 'outro-id', state: 'pending' },
      m4: 'lixo',
    });

    expect(Object.keys(map)).toEqual(['m1']);
    expect(map.m1).toEqual({ meetingId: 'm1', state: 'linked', sessionId: SID, origin: 'picker' });
    expect(JSON.stringify(map)).not.toContain('s3cr3t');
  });

  it('seedSent {} sobrevive à normalização; contagens inválidas são descartadas', async () => {
    const { store } = await loadStore();
    const map = store.normalizeAssociations({
      m1: { meetingId: 'm1', state: 'linked', sessionId: SID, seedSent: {} },
      m2: { meetingId: 'm2', state: 'linked', sessionId: SID, seedSent: { '0:c1': 3, '1:c2': -1, '2:c3': 'x' } },
      m3: { meetingId: 'm3', state: 'linked', sessionId: SID, seedSent: 'nada' },
    });
    expect(map.m1?.seedSent).toEqual({});
    expect(map.m2?.seedSent).toEqual({ '0:c1': 3 });
    expect(map.m3).not.toHaveProperty('seedSent');
  });

  it('os campos do encerramento (B4-b) sobrevivem; valores inválidos são ignorados', async () => {
    const { store } = await loadStore();
    const map = store.normalizeAssociations({
      m1: {
        meetingId: 'm1',
        state: 'linked',
        sessionId: SID,
        sessionFinished: true,
        finishBy: 1_700_000_000_000,
        finishTries: 3,
        finishGaveUp: true,
      },
      m2: {
        meetingId: 'm2',
        state: 'linked',
        sessionId: SID,
        sessionFinished: false,
        finishBy: 'amanhã',
        finishTries: -1,
        finishGaveUp: 'sim',
      },
    });
    expect(map.m1).toEqual({
      meetingId: 'm1',
      state: 'linked',
      sessionId: SID,
      sessionFinished: true,
      finishBy: 1_700_000_000_000,
      finishTries: 3,
      finishGaveUp: true,
    });
    expect(map.m2).toEqual({ meetingId: 'm2', state: 'linked', sessionId: SID });
  });

  it('prazo, tentativas e desistência gravados voltam iguais depois de um reinício', async () => {
    const { store } = await loadStore();
    await store.applyAssociationEvent('m1', { type: 'created' });
    await store.applyAssociationEvent('m1', { type: 'link-started', origin: 'picker', clientName: 'ACME', sessionId: SID });
    await store.applyAssociationEvent('m1', { type: 'link-completed', seedSent: {} });
    await store.applyAssociationEvent('m1', { type: 'finish-armed', by: 1_700_000_000_000 });
    await store.applyAssociationEvent('m1', { type: 'finish-failed' });
    await store.applyAssociationEvent('m1', { type: 'finish-failed', definitive: true });
    await store.clearSeed('m1');

    vi.resetModules();
    const reloaded = await import('./agenteAssociationStore');
    expect(await reloaded.getAssociation('m1')).toMatchObject({
      state: 'linked',
      finishBy: 1_700_000_000_000,
      finishTries: 2,
      finishGaveUp: true,
    });
  });

  it('a marca "sessão encerrada" volta depois de um reinício', async () => {
    const { store } = await loadStore();
    await store.applyAssociationEvent('m1', { type: 'created' });
    await store.applyAssociationEvent('m1', { type: 'link-started', origin: 'picker', clientName: 'ACME', sessionId: SID });
    await store.applyAssociationEvent('m1', { type: 'link-completed', seedSent: {} });
    await store.applyAssociationEvent('m1', { type: 'session-finished' });

    vi.resetModules();
    const reloaded = await import('./agenteAssociationStore');
    expect(await reloaded.getAssociation('m1')).toMatchObject({ sessionFinished: true });
  });

  it('valor ausente ou que não é objeto vira mapa vazio', async () => {
    const { store } = await loadStore();
    expect(store.normalizeAssociations(null)).toEqual({});
    expect(store.normalizeAssociations([1, 2])).toEqual({});
  });

  it('a semente {} gravada volta como semente depois de um reinício (leitura do storage)', async () => {
    const { store } = await loadStore();
    await store.applyAssociationEvent('m1', { type: 'created' });
    await store.applyAssociationEvent('m1', { type: 'link-started', origin: 'picker', clientName: 'ACME', sessionId: SID });
    await store.applyAssociationEvent('m1', { type: 'link-completed', seedSent: {} });

    vi.resetModules();
    const reloaded = await import('./agenteAssociationStore');
    expect((await reloaded.getAssociation('m1'))?.seedSent).toEqual({});
  });
});

describe('remoção pontual', () => {
  const initial = { m1: entry('m1'), m2: entry('m2'), m3: entry('m3') };

  it('removeAssociation tira só a reunião pedida', async () => {
    const { mock, store } = await loadStore({ [KEY]: initial });
    await store.removeAssociation('m2');
    expect(Object.keys(mock.local.values[KEY] as object).sort()).toEqual(['m1', 'm3']);
  });

  it('removeAssociations tira só as pedidas e ignora ids que não existem', async () => {
    const { mock, store } = await loadStore({ [KEY]: initial });
    await store.removeAssociations(['m1', 'm3', 'nao-existe']);
    expect(Object.keys(mock.local.values[KEY] as object)).toEqual(['m2']);
  });

  it('remover só ids inexistentes não grava', async () => {
    const { mock, store } = await loadStore({ [KEY]: initial });
    await store.removeAssociations(['nao-existe']);
    expect(mock.local.set).not.toHaveBeenCalled();
  });
});

describe('subscribeAssociations (para os painéis)', () => {
  it('entrega o valor atual e depois cada mudança; para de entregar ao cancelar', async () => {
    const { store } = await loadStore({ [KEY]: { m1: entry('m1') } });
    const received: string[][] = [];
    const stop = store.subscribeAssociations((map) => received.push(Object.keys(map)));
    await vi.waitFor(() => expect(received).toHaveLength(1));
    expect(received[0]).toEqual(['m1']);

    await store.applyAssociationEvent('m2', { type: 'created' });
    expect(received.at(-1)?.sort()).toEqual(['m1', 'm2']);

    stop();
    const count = received.length;
    await store.applyAssociationEvent('m3', { type: 'created' });
    expect(received).toHaveLength(count);
  });
});

describe('clearSeed', () => {
  it('apaga só a semente e mantém o vínculo', async () => {
    const { mock, store } = await loadStore({
      [KEY]: { m1: entry('m1', { state: 'linked', sessionId: SID, seedSent: { '0:c1': 2 } }) },
    });
    await store.clearSeed('m1');
    const stored = (mock.local.values[KEY] as Record<string, MeetingAssociation>).m1;
    expect(stored).toMatchObject({ state: 'linked', sessionId: SID });
    expect(stored).not.toHaveProperty('seedSent');
  });
});
