/**
 * Aba da reunião fechada no meio da call, com a máquina real (plano 08-26, TAQ-02, DA-3 = fechar-aba-encerra):
 * `onMeetingTabRemoved` -> dispatch REAL do `sessionController` -> histórico e ciclo de vida da associação
 * no storage simulado. Prova que o fim por aba fechada anda pelo MESMO caminho do `meet/ended` (fase `ended`,
 * registro final, associação) e que NÃO há RESET — a regra de reentrada do 08-24 precisa da fase `ended`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeStorageMock } from '@/test/chromeStorageMock';
import type { MeetingEvent } from '@/features/meeting/machine';

const SESSION_ID = '11111111-1111-1111-1111-111111111111';
const ROOM = 'abc-defg-hij';
const TAB = 1;
const CLOSED_AT = 9000;

function detected(meetingId: string, at = 1000, startFresh = false, captionsEnabled = true): MeetingEvent {
  return {
    type: 'MEETING_DETECTED',
    meetingId,
    meetingCode: ROOM,
    provider: 'google-meet',
    tabId: TAB,
    title: 'Reunião de teste',
    captionsEnabled,
    at,
    ...(startFresh && { startFresh: true }),
  };
}

const caption: MeetingEvent = {
  type: 'CAPTION_CHUNK',
  chunk: { captionId: 'c1', speaker: 'Ana', text: 'olá tudo bem', atMs: 1100 },
};

async function fresh() {
  const mock = installChromeStorageMock({
    extra: {
      runtime: { sendMessage: vi.fn(() => Promise.resolve()) },
      tabs: { sendMessage: vi.fn(() => Promise.resolve()) },
    },
  });
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, status: 202 } as Response)));
  const sessionController = await import('./sessionController');
  const { onMeetingTabRemoved } = await import('./meetingTabClosed');
  const { shouldStartFreshMeeting } = await import('./agenteFreshStart');
  const { listHistory } = await import('./history');
  const store = await import('@/shared/config/agenteAssociationStore');
  const { patchAgenteConfig } = await import('@/shared/config/agenteConfigStore');
  await patchAgenteConfig({ streamingEnabled: true });

  const settle = async () => {
    await vi.advanceTimersByTimeAsync(10);
    await vi.advanceTimersByTimeAsync(10);
  };
  const dispatch = async (event: MeetingEvent) => {
    const result = await sessionController.dispatch(event);
    await settle();
    return result;
  };
  const closeTab = async (tabId: number) => {
    await onMeetingTabRemoved(tabId, {
      getState: sessionController.getState,
      dispatch: sessionController.dispatch,
      now: () => CLOSED_AT,
    });
    await settle();
  };
  const link = async () => {
    await store.applyAssociationEvent('m1', { type: 'link-started', origin: 'picker', clientName: 'ACME', sessionId: SESSION_ID });
    await store.applyAssociationEvent('m1', { type: 'link-completed', seedSent: {} });
  };
  return {
    mock,
    store,
    dispatch,
    closeTab,
    link,
    state: sessionController.getState,
    history: listHistory,
    stored: () => store.loadAssociations(),
    shouldStartFresh: () => shouldStartFreshMeeting(sessionController.getState(), ROOM),
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('fechar a aba no meio da call encerra a reunião', () => {
  it('recording com falas e associação linked: fase ended com endedAt, registro ready e a associação segue linked', async () => {
    const { dispatch, closeTab, link, state, history, stored } = await fresh();
    await dispatch(detected('m1'));
    await dispatch(caption);
    await link();

    await closeTab(TAB);

    expect(state().phase).toBe('ended');
    expect(state().session?.endedAt).toBe(CLOSED_AT);
    expect((await history()).map((r) => [r.id, r.status])).toEqual([['m1', 'ready']]);
    expect((await stored()).m1?.state).toBe('linked');
  });

  it('não há RESET: o estado fica em ended, como depois de um meet/ended', async () => {
    const { dispatch, closeTab, state } = await fresh();
    await dispatch(detected('m1'));
    await dispatch(caption);
    await closeTab(TAB);
    expect(state().phase).toBe('ended');
    expect(state().session?.meetingId).toBe('m1');
  });

  it('pending com falas -> ended-unsent; pending sem falas -> associação removida', async () => {
    const withSpeech = await fresh();
    await withSpeech.dispatch(detected('m1'));
    await withSpeech.dispatch(caption);
    await withSpeech.closeTab(TAB);
    expect((await withSpeech.stored()).m1?.state).toBe('ended-unsent');

    vi.resetModules();
    const noSpeech = await fresh();
    await noSpeech.dispatch(detected('m1'));
    await noSpeech.closeTab(TAB);
    expect(await noSpeech.stored()).toEqual({});
  });

  it('paused -> ended', async () => {
    const { dispatch, closeTab, state } = await fresh();
    await dispatch(detected('m1'));
    await dispatch(caption);
    await dispatch({ type: 'PAUSE' });
    expect(state().phase).toBe('paused');
    await closeTab(TAB);
    expect(state().phase).toBe('ended');
  });

  it('captionsRequired sem falas -> ended com a sessão vazia e sem registro novo no histórico', async () => {
    const { dispatch, closeTab, state, history } = await fresh();
    await dispatch(detected('m1', 1000, false, false));
    expect(state().phase).toBe('captionsRequired');
    await closeTab(TAB);
    expect(state().phase).toBe('ended');
    expect(state().session?.segments).toEqual([]);
    expect(await history()).toEqual([]);
  });

  it('linking (envio em partes rodando): a associação não muda e o vínculo ainda termina em linked', async () => {
    const { dispatch, closeTab, store, stored } = await fresh();
    await dispatch(detected('m1'));
    await dispatch(caption);
    await store.applyAssociationEvent('m1', { type: 'link-started', origin: 'picker', clientName: 'ACME', sessionId: SESSION_ID });

    await closeTab(TAB);
    expect((await stored()).m1?.state).toBe('linking');

    await store.applyAssociationEvent('m1', { type: 'link-completed', seedSent: {} });
    expect((await stored()).m1).toMatchObject({ state: 'linked', sessionId: SESSION_ID });
  });

  it('aba de outra reunião ou sem relação -> nada muda', async () => {
    const { dispatch, closeTab, state } = await fresh();
    await dispatch(detected('m1'));
    await dispatch(caption);
    await closeTab(999);
    expect(state().phase).toBe('recording');
    expect(state().session?.endedAt).toBeNull();
  });

  it('fechar a aba DEPOIS do fim (mesma aba) continua devolvendo o estado ao ocioso (RESET)', async () => {
    const { dispatch, closeTab, state } = await fresh();
    await dispatch(detected('m1'));
    await dispatch(caption);
    await closeTab(TAB);
    expect(state().session?.endedAt).toBe(CLOSED_AT);
    await closeTab(TAB);
    expect(state().phase).toBe('idle');
  });
});

describe('reabrir a mesma sala depois do fim por aba fechada (08-22 / 08-24)', () => {
  it('sem sessionFinished e sem finish em voo: não é reunião nova e a máquina retoma o mesmo meetingId', async () => {
    const { dispatch, closeTab, link, state, shouldStartFresh } = await fresh();
    await dispatch(detected('m1'));
    await dispatch(caption);
    await link();
    await closeTab(TAB);

    expect(await shouldStartFresh()).toBe(false);
    await dispatch(detected('m-novo-id', 6000 + CLOSED_AT));
    expect(state().phase).toBe('recording');
    expect(state().session?.meetingId).toBe('m1');
  });

  it('com sessionFinished: é reunião nova e a máquina cria outro meetingId', async () => {
    const { dispatch, closeTab, link, store, state, shouldStartFresh } = await fresh();
    await dispatch(detected('m1'));
    await dispatch(caption);
    await link();
    await store.applyAssociationEvent('m1', { type: 'session-finished' });
    await closeTab(TAB);

    expect(await shouldStartFresh()).toBe(true);
    await dispatch(detected('m2', 6000 + CLOSED_AT, true));
    expect(state().phase).toBe('recording');
    expect(state().session?.meetingId).toBe('m2');
  });
});
