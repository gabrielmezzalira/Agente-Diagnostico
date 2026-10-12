/**
 * Ciclo de vida da associação dirigido pela máquina da reunião (plano 08-22, TAQ-02, D-04/D-06/D-09/D-12):
 * dispatch REAL do `sessionController` -> `syncAssociationLifecycle` -> store de associação no storage
 * simulado. Prova: nasce `pending` uma vez só, vira `ended-unsent` ao terminar sem escolha, volta a um
 * estado ao vivo coerente quando a MESMA sala é retomada, e nunca fica preso depois de um reinício.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeStorageMock } from '@/test/chromeStorageMock';
import { STORAGE_KEYS } from '@/shared/config/constants';
import type { MeetingEvent } from '@/features/meeting/machine';

const SESSION_ID = '11111111-1111-1111-1111-111111111111';

function detected(meetingId: string, meetingCode = 'abc-defg-hij', at = 1000): MeetingEvent {
  return {
    type: 'MEETING_DETECTED',
    meetingId,
    meetingCode,
    provider: 'google-meet',
    tabId: 1,
    title: 'Reunião de teste',
    captionsEnabled: true,
    at,
  };
}

function caption(text: string, atMs = 1100): MeetingEvent {
  return { type: 'CAPTION_CHUNK', chunk: { captionId: 'c1', speaker: 'Ana', text, atMs } };
}

async function fresh(options: { local?: Record<string, unknown>; streaming?: boolean } = {}) {
  const mock = installChromeStorageMock({
    local: options.local,
    extra: {
      runtime: { sendMessage: vi.fn(() => Promise.resolve()) },
      tabs: { sendMessage: vi.fn(() => Promise.resolve()) },
    },
  });
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, status: 202 } as Response)));
  const sessionController = await import('./sessionController');
  const lifecycle = await import('./agenteAssociationLifecycle');
  const store = await import('@/shared/config/agenteAssociationStore');
  const { patchAgenteConfig } = await import('@/shared/config/agenteConfigStore');
  await patchAgenteConfig({ streamingEnabled: options.streaming ?? true });

  /** Deixa o ciclo de vida (fire-and-forget) terminar de gravar. */
  const settle = async () => {
    await vi.advanceTimersByTimeAsync(10);
    await vi.advanceTimersByTimeAsync(10);
  };
  const dispatch = async (event: MeetingEvent) => {
    const result = await sessionController.dispatch(event);
    await settle();
    return result;
  };
  const stored = () => store.loadAssociations();
  const associationWrites = () =>
    mock.local.set.mock.calls.filter(([items]) => STORAGE_KEYS.agenteAssociations in items).length;
  return { mock, sessionController, lifecycle, store, dispatch, settle, stored, associationWrites, patchAgenteConfig };
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('criação da associação ao detectar a reunião (D-04)', () => {
  it('reunião detectada com o envio ligado ganha 1 pending; 5 polls repetidos não regravam', async () => {
    const { dispatch, stored, associationWrites } = await fresh();
    await dispatch(detected('m1'));
    expect(await stored()).toEqual({ m1: { meetingId: 'm1', state: 'pending' } });
    expect(associationWrites()).toBe(1);

    for (let i = 0; i < 5; i += 1) await dispatch(detected('m1', 'abc-defg-hij', 1500 + i));
    expect(Object.keys(await stored())).toEqual(['m1']);
    expect(associationWrites()).toBe(1);
  });

  it('com o envio desligado nada nasce; ligar no meio da reunião cria a pending no próximo dispatch', async () => {
    const { dispatch, stored, patchAgenteConfig, associationWrites } = await fresh({ streaming: false });
    await dispatch(detected('m1'));
    await dispatch(caption('olá'));
    expect(await stored()).toEqual({});
    expect(associationWrites()).toBe(0);

    await patchAgenteConfig({ streamingEnabled: true });
    await dispatch(caption('olá tudo bem'));
    expect((await stored()).m1).toEqual({ meetingId: 'm1', state: 'pending' });
  });
});

describe('fim da reunião e preempção (D-09)', () => {
  it.each(['pending', 'choosing', 'deferred'] as const)(
    'terminar com falas e associação %s -> ended-unsent',
    async (state) => {
      const { dispatch, stored, store } = await fresh();
      await dispatch(detected('m1'));
      await dispatch(caption('olá tudo bem'));
      if (state !== 'pending') await store.applyAssociationEvent('m1', { type: 'opened' });
      if (state === 'deferred') await store.applyAssociationEvent('m1', { type: 'deferred' });
      await dispatch({ type: 'MEETING_FINISHED', at: 5000 });
      expect((await stored()).m1?.state).toBe('ended-unsent');
    },
  );

  it('terminar sem nenhuma fala remove a associação (sem registro)', async () => {
    const { dispatch, stored } = await fresh();
    await dispatch(detected('m1'));
    await dispatch({ type: 'MEETING_FINISHED', at: 5000 });
    expect(await stored()).toEqual({});
  });

  it('terminar durante o vínculo (linking) continua linking, mesmo sem falas', async () => {
    const { dispatch, stored, store } = await fresh();
    await dispatch(detected('m1'));
    await store.applyAssociationEvent('m1', { type: 'link-started', origin: 'picker', clientName: 'ACME', sessionId: SESSION_ID });
    await dispatch({ type: 'MEETING_FINISHED', at: 5000 });
    expect((await stored()).m1?.state).toBe('linking');
  });

  it('terminar com a reunião linked continua linked', async () => {
    const { dispatch, stored, store } = await fresh();
    await dispatch(detected('m1'));
    await dispatch(caption('olá tudo bem'));
    await store.applyAssociationEvent('m1', { type: 'link-started', origin: 'picker', clientName: 'ACME', sessionId: SESSION_ID });
    await store.applyAssociationEvent('m1', { type: 'link-completed', seedSent: {} });
    await dispatch({ type: 'MEETING_FINISHED', at: 5000 });
    expect((await stored()).m1?.state).toBe('linked');
  });

  it('outra sala preemptando m1 (com falas): m1 vira ended-unsent e m2 nasce pending', async () => {
    const { dispatch, stored } = await fresh();
    await dispatch(detected('m1'));
    await dispatch(caption('olá tudo bem'));
    await dispatch(detected('m2', 'zzz-zzzz-zzz', 2000));
    const map = await stored();
    expect(map.m1?.state).toBe('ended-unsent');
    expect(map.m2).toEqual({ meetingId: 'm2', state: 'pending' });
  });
});

describe('retomada da mesma sala (D-06, T-08-41)', () => {
  it('ended-unsent + mesma sala dentro da janela -> pending, sem associação nova', async () => {
    const { dispatch, stored } = await fresh();
    await dispatch(detected('m1'));
    await dispatch(caption('olá tudo bem'));
    await dispatch({ type: 'MEETING_FINISHED', at: 5000 });
    expect((await stored()).m1?.state).toBe('ended-unsent');

    await dispatch(detected('m-novo-id', 'abc-defg-hij', 6000));
    const map = await stored();
    expect(map.m1).toEqual({ meetingId: 'm1', state: 'pending' });
    expect(Object.keys(map)).toEqual(['m1']);
  });

  it('sent (sessionId S1 e seedSent) + mesma sala -> linked com a mesma sessão e a semente preservada', async () => {
    const seed = { '0:c1': 2 };
    const { dispatch, stored, store } = await fresh();
    await dispatch(detected('m1'));
    await dispatch(caption('olá tudo'));
    await dispatch({ type: 'MEETING_FINISHED', at: 5000 });
    await store.applyAssociationEvent('m1', { type: 'send-started', origin: 'picker', clientName: 'ACME', sessionId: SESSION_ID });
    await store.applyAssociationEvent('m1', { type: 'send-completed', seedSent: seed });

    await dispatch(detected('m-novo-id', 'abc-defg-hij', 6000));
    expect((await stored()).m1).toMatchObject({ state: 'linked', sessionId: SESSION_ID, seedSent: seed });
  });

  it('sala diferente depois do fim de m1: m2 nasce pending e m1 não muda', async () => {
    const { dispatch, stored } = await fresh();
    await dispatch(detected('m1'));
    await dispatch(caption('olá tudo bem'));
    await dispatch({ type: 'MEETING_FINISHED', at: 5000 });
    await dispatch(detected('m2', 'zzz-zzzz-zzz', 6000));
    const map = await stored();
    expect(map.m1?.state).toBe('ended-unsent');
    expect(map.m2).toEqual({ meetingId: 'm2', state: 'pending' });
  });

  it('retomada de reunião que tinha sido removida (0 falas) cria uma pending nova', async () => {
    const { dispatch, stored } = await fresh();
    await dispatch(detected('m1'));
    await dispatch({ type: 'MEETING_FINISHED', at: 5000 });
    expect(await stored()).toEqual({});
    await dispatch(detected('x', 'abc-defg-hij', 6000));
    expect((await stored()).m1).toEqual({ meetingId: 'm1', state: 'pending' });
  });
});

describe('falha no ciclo de vida nunca derruba o dispatch (T-08-42)', () => {
  it('a gravação da associação falha: o dispatch devolve o estado novo e o erro vai para o log', async () => {
    const { mock, sessionController, settle } = await fresh();
    const { logger } = await import('@/shared/services/log');
    const logSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const realSet = mock.local.set.getMockImplementation()!;
    mock.local.set.mockImplementation(async (items: Record<string, unknown>) => {
      if (STORAGE_KEYS.agenteAssociations in items) throw new Error('quota');
      return realSet(items);
    });

    const result = await sessionController.dispatch(detected('m1'));
    await settle();
    expect(result.phase).toBe('recording');
    expect(logSpy).toHaveBeenCalledWith('ciclo de vida da associação do Agente falhou', expect.any(Error));
  });
});
