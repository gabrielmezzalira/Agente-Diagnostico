/**
 * Aba da reunião fechada (plano 08-26, TAQ-02): a regra pura, com `getState` e `dispatch` falsos.
 * Depois do fim: RESET. No meio da call (DA-3 = fechar-aba-encerra): MEETING_FINISHED, o mesmo evento do
 * meet/ended. Aba de outra reunião, aba nula ou fase ociosa: nada.
 */
import { describe, expect, it, vi } from 'vitest';
import { IDLE_STATE, type MeetingPhase, type MeetingSessionState, type MeetingState } from '@/shared/types/domain';
import { onMeetingTabRemoved } from './meetingTabClosed';

const NOW = 424242;

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
  return { dispatch, deps: { getState: () => state, dispatch, now: () => NOW } };
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

describe('aba da reunião fechada no meio da call (DA-3 = fechar-aba-encerra)', () => {
  it.each(['captionsRequired', 'recording', 'paused'] as const)(
    'fase %s + a mesma aba -> MEETING_FINISHED uma vez, com o relógio injetado, sem RESET',
    async (phase) => {
      const { dispatch, deps } = setup(stateOf(phase));
      await onMeetingTabRemoved(7, deps);
      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(dispatch).toHaveBeenCalledWith({ type: 'MEETING_FINISHED', at: NOW });
      expect(dispatch).not.toHaveBeenCalledWith({ type: 'RESET' });
    },
  );

  it.each(['captionsRequired', 'recording', 'paused'] as const)(
    'fase %s + outra aba -> nada',
    async (phase) => {
      const { dispatch, deps } = setup(stateOf(phase));
      await onMeetingTabRemoved(99, deps);
      expect(dispatch).not.toHaveBeenCalled();
    },
  );

  it('fase recording + tabId nulo na sessão -> nada (aba nula nunca casa)', async () => {
    const { dispatch, deps } = setup(stateOf('recording', null));
    await onMeetingTabRemoved(7, deps);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('fase idle (sem sessão) -> nada', async () => {
    const { dispatch, deps } = setup(IDLE_STATE);
    await onMeetingTabRemoved(7, deps);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
