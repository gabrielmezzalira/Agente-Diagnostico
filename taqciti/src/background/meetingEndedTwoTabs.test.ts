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
import { onMeetingEndedInTab, type MeetingEndedInTabDeps } from './meetingEndedInTab';

const ROOM = 'abc-defg-hij';
const OWNER = 7;
const OTHER = 9;
const NOW = 424242;

const detected: MeetingEvent = {
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
