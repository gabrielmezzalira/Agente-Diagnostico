/**
 * Aba da reunião navegou para outro lugar no meio da call (DA-4 = navegar-encerra): a regra pura, com
 * `getState` e `dispatch` falsos. Outro site ou outra sala: MEETING_FINISHED. Mesma sala, outra aba, fase
 * `ended` ou ociosa: nada.
 */
import { describe, expect, it, vi } from 'vitest';
import { IDLE_STATE, type MeetingPhase, type MeetingSessionState, type MeetingState } from '@/shared/types/domain';
import { isStillInMeetingRoom, onMeetingTabNavigated } from './meetingTabNavigated';

const NOW = 424242;
const ROOM = 'abc-defg-hij';

function session(tabId: number | null): MeetingSessionState {
  return {
    meetingId: 'm1',
    meetingCode: ROOM,
    provider: 'google-meet',
    title: 'Reunião de teste',
    tabId,
    startedAt: 1000,
    endedAt: null,
    captionsEnabled: true,
    participants: [],
    segments: [],
    sealedCaptionIds: [],
    droppedSegments: 0,
    reconnectCount: 0,
    wasDiscardedAndRestarted: false,
    captionLanguage: 'unknown',
    languageWarningDismissed: false,
    chunksSinceLanguageCheck: 0,
  };
}

function stateOf(phase: MeetingPhase, tabId: number | null = 7): MeetingState {
  return { phase, session: session(tabId) };
}

function setup(state: MeetingState) {
  const dispatch = vi.fn(() => Promise.resolve(state));
  return { dispatch, deps: { getState: () => state, dispatch, now: () => NOW } };
}

describe('isStillInMeetingRoom', () => {
  it.each([
    `https://meet.google.com/${ROOM}`,
    `https://meet.google.com/${ROOM}?authuser=1`,
    `https://meet.google.com/${ROOM}#fim`,
    `https://meet.google.com/${ROOM.toUpperCase()}`,
  ])('%s -> ainda na sala', (url) => {
    expect(isStillInMeetingRoom(url, ROOM)).toBe(true);
  });

  it.each([
    'https://meet.google.com/landing',
    'https://meet.google.com/xyz-abcd-efg',
    `https://example.com/${ROOM}`,
    `https://meet.google.com.evil.com/${ROOM}`,
    'https://meet.google.com/',
    'chrome://newtab/',
    'não é uma url',
  ])('%s -> saiu da sala', (url) => {
    expect(isStillInMeetingRoom(url, ROOM)).toBe(false);
  });
});

describe('aba da reunião navegou no meio da call (DA-4 = navegar-encerra)', () => {
  it.each(['captionsRequired', 'recording', 'paused'] as const)(
    'fase %s + mesma aba + outro site -> MEETING_FINISHED uma vez, com o relógio injetado, sem RESET',
    async (phase) => {
      const { dispatch, deps } = setup(stateOf(phase));
      await onMeetingTabNavigated(7, 'https://news.ycombinator.com/', deps);
      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(dispatch).toHaveBeenCalledWith({ type: 'MEETING_FINISHED', at: NOW });
    },
  );

  it('fase recording + mesma aba + outra sala do Meet -> MEETING_FINISHED', async () => {
    const { dispatch, deps } = setup(stateOf('recording'));
    await onMeetingTabNavigated(7, 'https://meet.google.com/xyz-abcd-efg', deps);
    expect(dispatch).toHaveBeenCalledWith({ type: 'MEETING_FINISHED', at: NOW });
  });

  it('fase recording + mesma sala (recarregar ou mudar query) -> nada', async () => {
    const { dispatch, deps } = setup(stateOf('recording'));
    await onMeetingTabNavigated(7, `https://meet.google.com/${ROOM}?authuser=2`, deps);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('fase recording + outra aba -> nada', async () => {
    const { dispatch, deps } = setup(stateOf('recording'));
    await onMeetingTabNavigated(99, 'https://example.com/', deps);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('fase recording + tabId nulo na sessão -> nada (aba nula nunca casa)', async () => {
    const { dispatch, deps } = setup(stateOf('recording', null));
    await onMeetingTabNavigated(7, 'https://example.com/', deps);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('fase ended + mesma aba + outro site -> nada (já acabou; quem limpa é o fechar-aba)', async () => {
    const { dispatch, deps } = setup(stateOf('ended'));
    await onMeetingTabNavigated(7, 'https://example.com/', deps);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('fase idle (sem sessão) -> nada', async () => {
    const { dispatch, deps } = setup(IDLE_STATE);
    await onMeetingTabNavigated(7, 'https://example.com/', deps);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
