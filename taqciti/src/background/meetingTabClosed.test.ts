/**
 * Aba da reunião fechada (plano 08-26, TAQ-02): a regra pura, com `getState` e `dispatch` falsos.
 * Caracteriza o que o service worker faz quando uma aba some — RESET depois do fim, nada nos outros casos.
 */
import { describe, expect, it, vi } from 'vitest';
import { IDLE_STATE, type MeetingPhase, type MeetingSessionState, type MeetingState } from '@/shared/types/domain';
import { onMeetingTabRemoved } from './meetingTabClosed';

function session(tabId: number | null): MeetingSessionState {
  return {
    meetingId: 'm1',
    meetingCode: 'abc-defg-hij',
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
  return { dispatch, deps: { getState: () => state, dispatch } };
}

describe('aba da reunião fechada depois do fim', () => {
  it('fase ended + a mesma aba -> RESET, uma vez', async () => {
    const { dispatch, deps } = setup(stateOf('ended'));
    await onMeetingTabRemoved(7, deps);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'RESET' });
  });

  it('fase ended + outra aba -> nada', async () => {
    const { dispatch, deps } = setup(stateOf('ended'));
    await onMeetingTabRemoved(99, deps);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('fase ended + tabId nulo na sessão -> nada', async () => {
    const { dispatch, deps } = setup(stateOf('ended', null));
    await onMeetingTabRemoved(7, deps);
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe('demais casos', () => {
  it('fase idle (sem sessão) -> nada', async () => {
    const { dispatch, deps } = setup(IDLE_STATE);
    await onMeetingTabRemoved(7, deps);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it.each(['captionsRequired', 'recording', 'paused'] as const)(
    'fase %s + a mesma aba -> nada (comportamento de antes do 08-26)',
    async (phase) => {
      const { dispatch, deps } = setup(stateOf(phase));
      await onMeetingTabRemoved(7, deps);
      expect(dispatch).not.toHaveBeenCalled();
    },
  );
});
