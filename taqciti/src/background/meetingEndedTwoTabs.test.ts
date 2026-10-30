/**
 * `meet/ended` com a mesma reunião em duas abas (Fase 10, TAQ-05, D-16 e D-17), com a máquina REAL.
 *
 * Prova a regra `onMeetingEndedInTab`: o aviso de uma aba que não é a dona não encerra a reunião; o da dona
 * passa pela regra do D-03 (outra aba na call reaponta, senão encerra); consulta que falha encerra (D-17); sem
 * reunião ao vivo ou com aba desconhecida o comportamento de hoje (despachar `MEETING_FINISHED`) continua.
 */
import { describe, expect, it, vi } from 'vitest';
import { transition, type MeetingEvent } from '@/features/meeting/machine';
import { IDLE_STATE, type MeetingState } from '@/shared/types/domain';
import { installChromeStorageMock } from '@/test/chromeStorageMock';
import { onMeetingEndedInTab, type MeetingEndedInTabDeps } from './meetingEndedInTab';

const ROOM = 'abc-defg-hij';
const OWNER = 7;
const OTHER = 9;
const NOW = 424242;
const ROOM_URL = `https://meet.google.com/${ROOM}`;

const detected: Extract<MeetingEvent, { type: 'MEETING_DETECTED' }> = {
  type: 'MEETING_DETECTED',
  meetingId: 'm1',
  meetingCode: ROOM,
  provider: 'google-meet',
  tabId: OWNER,
  title: 'Reunião de teste',
  captionsEnabled: true,
  at: 1000,
};

/** Reunião na máquina real a partir de um estado inicial; um `dispatch` espião aplica `transition` de verdade. */
function meetingFrom(initial: MeetingState) {
  let state = initial;
  const events: MeetingEvent[] = [];
  const dispatch = vi.fn((event: MeetingEvent) => {
    events.push(event);
    state = transition(state, event);
    return Promise.resolve(state);
  });
  return {
    events,
    dispatch,
    getState: () => state,
    finishedCount: () => events.filter((event) => event.type === 'MEETING_FINISHED').length,
  };
}

const liveMeeting = () => meetingFrom(transition(IDLE_STATE, detected));

function depsFor(
  meeting: ReturnType<typeof meetingFrom>,
  extra: Partial<MeetingEndedInTabDeps> = {},
): MeetingEndedInTabDeps {
  return { getState: meeting.getState, dispatch: meeting.dispatch, now: () => NOW, ...extra };
}

describe('onMeetingEndedInTab (D-16, D-17)', () => {
  it('aviso de uma aba que NÃO é a dona: nenhum despacho, a reunião continua ao vivo e a aba é marcada como fora da call', async () => {
    const meeting = liveMeeting();
    const markLeftCall = vi.fn();
    const otherRoomTabId = vi.fn(() => Promise.resolve(null));

    await onMeetingEndedInTab(OTHER, depsFor(meeting, { markLeftCall, otherRoomTabId }));

    expect(meeting.dispatch).not.toHaveBeenCalled();
    expect(meeting.getState().phase).toBe('recording');
    expect(meeting.getState().session?.tabId).toBe(OWNER);
    expect(markLeftCall).toHaveBeenCalledWith(OTHER);
    expect(otherRoomTabId).not.toHaveBeenCalled();
  });

  it('aviso da dona com outra aba na call e na sala: reaponta (MEETING_TAB_CHANGED) e continua ao vivo', async () => {
    const meeting = liveMeeting();
    const markLeftCall = vi.fn();
    const otherRoomTabId = vi.fn(() => Promise.resolve(OTHER));

    await onMeetingEndedInTab(OWNER, depsFor(meeting, { markLeftCall, otherRoomTabId }));

    expect(otherRoomTabId).toHaveBeenCalledWith(ROOM, OWNER);
    expect(markLeftCall).toHaveBeenCalledWith(OWNER);
    expect(meeting.events).toEqual([{ type: 'MEETING_TAB_CHANGED', tabId: OTHER }]);
    expect(meeting.getState().phase).toBe('recording');
    expect(meeting.getState().session?.tabId).toBe(OTHER);
    expect(meeting.finishedCount()).toBe(0);
  });

  it('aviso da dona sem nenhuma outra aba: encerra com um único MEETING_FINISHED', async () => {
    const meeting = liveMeeting();

    await onMeetingEndedInTab(OWNER, depsFor(meeting, { otherRoomTabId: () => Promise.resolve(null) }));

    expect(meeting.events).toEqual([{ type: 'MEETING_FINISHED', at: NOW }]);
    expect(meeting.getState().phase).toBe('ended');
  });

  it('D-17: a consulta de outra aba rejeita: a dona encerra a reunião, igual a hoje', async () => {
    const meeting = liveMeeting();

    await onMeetingEndedInTab(
      OWNER,
      depsFor(meeting, { otherRoomTabId: () => Promise.reject(new Error('chrome.tabs.query caiu')) }),
    );

    expect(meeting.finishedCount()).toBe(1);
    expect(meeting.getState().phase).toBe('ended');
  });

  it('sem porta de consulta (ausente) a dona encerra, como antes', async () => {
    const meeting = liveMeeting();
    await onMeetingEndedInTab(OWNER, depsFor(meeting));
    expect(meeting.finishedCount()).toBe(1);
    expect(meeting.getState().phase).toBe('ended');
  });

  it('aba desconhecida (sem sender.tab) em reunião ao vivo: encerra, como hoje, sem consultar abas', async () => {
    const meeting = liveMeeting();
    const markLeftCall = vi.fn();
    const otherRoomTabId = vi.fn(() => Promise.resolve(OTHER));

    await onMeetingEndedInTab(null, depsFor(meeting, { markLeftCall, otherRoomTabId }));

    expect(meeting.events).toEqual([{ type: 'MEETING_FINISHED', at: NOW }]);
    expect(markLeftCall).not.toHaveBeenCalled();
    expect(otherRoomTabId).not.toHaveBeenCalled();
  });

  it('sessão sem aba dona conhecida (tabId nulo): o aviso encerra, como hoje', async () => {
    const meeting = meetingFrom(transition(IDLE_STATE, { ...detected, tabId: null }));
    await onMeetingEndedInTab(OTHER, depsFor(meeting, { otherRoomTabId: () => Promise.resolve(null) }));
    expect(meeting.finishedCount()).toBe(1);
  });

  it.each([
    ['idle', () => meetingFrom(IDLE_STATE)],
    ['ended', () => meetingFrom(transition(transition(IDLE_STATE, detected), { type: 'MEETING_FINISHED', at: NOW }))],
  ])('fase %s: despacha MEETING_FINISHED (a máquina ignora) sem consultar abas', async (phase, build) => {
    const meeting = build();
    const before = meeting.getState();
    const otherRoomTabId = vi.fn(() => Promise.resolve(OTHER));
    expect(before.phase).toBe(phase);

    await onMeetingEndedInTab(OWNER, depsFor(meeting, { otherRoomTabId }));

    expect(meeting.events).toEqual([{ type: 'MEETING_FINISHED', at: NOW }]);
    expect(meeting.getState()).toEqual(before);
    expect(otherRoomTabId).not.toHaveBeenCalled();
  });

  it('em pausa, o aviso da dona com outra aba na call também reaponta', async () => {
    const meeting = meetingFrom(transition(transition(IDLE_STATE, detected), { type: 'PAUSE' }));
    expect(meeting.getState().phase).toBe('paused');

    await onMeetingEndedInTab(OWNER, depsFor(meeting, { otherRoomTabId: () => Promise.resolve(OTHER) }));

    expect(meeting.getState().phase).toBe('paused');
    expect(meeting.getState().session?.tabId).toBe(OTHER);
    expect(meeting.finishedCount()).toBe(0);
  });
});

/**
 * Sequências de duas saídas com o adaptador REAL (`meetingRoomTabs`), as regras reais (`onMeetingEndedInTab` e
 * `onMeetingTabRemoved`) e a máquina real. O `chrome.tabs.query` devolve sempre as duas abas na URL da sala:
 * quem decide se uma delas ainda "conta" é a memória das abas na call, não a URL (T-10-12).
 */
describe('duas saídas da call com o adaptador real (T-10-12)', () => {
  /** Worker "recém-acordado" (módulos novos = memória vazia) com as duas abas sempre na URL da sala. */
  async function startWorker() {
    vi.resetModules();
    const query = vi.fn(() => Promise.resolve([{ id: OWNER, url: ROOM_URL }, { id: OTHER, url: ROOM_URL }]));
    installChromeStorageMock({ extra: { tabs: { query } } });
    const roomTabs = await import('./meetingRoomTabs');
    const closed = await import('./meetingTabClosed');
    return { roomTabs, closed };
  }

  type Worker = Awaited<ReturnType<typeof startWorker>>;

  /** Reunião ao vivo com a aba dona escolhida (a última que entrou na call). */
  function meetingOwnedBy(tabId: number) {
    return meetingFrom(transition(IDLE_STATE, { ...detected, tabId }));
  }

  /** O `meet/ended` como o `index.ts` o liga: regra real, porta real e marca real de "saiu da call". */
  const sendEnded = (worker: Worker, meeting: ReturnType<typeof meetingFrom>, tabId: number) =>
    onMeetingEndedInTab(
      tabId,
      depsFor(meeting, {
        otherRoomTabId: worker.roomTabs.findOtherRoomTab,
        markLeftCall: worker.roomTabs.markTabLeftCall,
      }),
    );

  /** O `tabs.onRemoved` como o `index.ts` o liga: marca a saída (síncrono) e depois roda a regra real. */
  async function closeTab(worker: Worker, meeting: ReturnType<typeof meetingFrom>, tabId: number) {
    worker.roomTabs.markTabLeftCall(tabId);
    await worker.closed.onMeetingTabRemoved(tabId, {
      getState: meeting.getState,
      dispatch: meeting.dispatch,
      now: () => NOW,
      otherRoomTabId: worker.roomTabs.findOtherRoomTab,
    });
  }

  it('a aba 7 sai (ignorado) e depois a dona 9 fecha: a 7 não segura a reunião, encerra exatamente 1 vez', async () => {
    const worker = await startWorker();
    worker.roomTabs.markTabJoinedCall(OWNER, ROOM);
    worker.roomTabs.markTabJoinedCall(OTHER, ROOM);
    const meeting = meetingOwnedBy(OTHER);

    await sendEnded(worker, meeting, OWNER);
    expect(meeting.events).toEqual([]);
    expect(meeting.getState().phase).toBe('recording');
    expect(meeting.getState().session?.tabId).toBe(OTHER);

    await closeTab(worker, meeting, OTHER);
    expect(meeting.finishedCount()).toBe(1);
    expect(meeting.events).toEqual([{ type: 'MEETING_FINISHED', at: NOW }]);
    expect(meeting.getState().phase).toBe('ended');
  });

  it('a dona 9 sai (reaponta para a 7) e depois a 7 sai: encerra exatamente 1 vez', async () => {
    const worker = await startWorker();
    worker.roomTabs.markTabJoinedCall(OWNER, ROOM);
    worker.roomTabs.markTabJoinedCall(OTHER, ROOM);
    const meeting = meetingOwnedBy(OTHER);

    await sendEnded(worker, meeting, OTHER);
    expect(meeting.events).toEqual([{ type: 'MEETING_TAB_CHANGED', tabId: OWNER }]);
    expect(meeting.getState().phase).toBe('recording');
    expect(meeting.getState().session?.tabId).toBe(OWNER);
    expect(meeting.finishedCount()).toBe(0);

    await sendEnded(worker, meeting, OWNER);
    expect(meeting.finishedCount()).toBe(1);
    expect(meeting.getState().phase).toBe('ended');
  });

  it('a 7 sai e volta para a call (novo meet/detected): volta a contar e a dona 9 fechando reaponta para a 7', async () => {
    const worker = await startWorker();
    worker.roomTabs.markTabJoinedCall(OWNER, ROOM);
    worker.roomTabs.markTabJoinedCall(OTHER, ROOM);
    const meeting = meetingOwnedBy(OTHER);

    await sendEnded(worker, meeting, OWNER);
    worker.roomTabs.markTabJoinedCall(OWNER, ROOM);

    await closeTab(worker, meeting, OTHER);
    expect(meeting.events).toEqual([{ type: 'MEETING_TAB_CHANGED', tabId: OWNER }]);
    expect(meeting.getState().phase).toBe('recording');
    expect(meeting.getState().session?.tabId).toBe(OWNER);
    expect(meeting.finishedCount()).toBe(0);
  });
});
