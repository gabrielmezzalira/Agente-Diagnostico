/**
 * A volta à sala conta como reunião nova? (Fase 8, plano 08-24, B4-b, DA-1, T-08-51.) Só lê a associação
 * quando a fase é `ended` e a sala é a mesma; fora disso nada é lido e a detecção custa zero.
 */
import { describe, expect, it, vi } from 'vitest';
import type { MeetingAssociation } from '@/features/agente/association';
import type { MeetingEvent } from '@/features/meeting/machine';
import { transition } from '@/features/meeting/machine';
import { IDLE_STATE, type MeetingState } from '@/shared/types/domain';
import { shouldStartFreshMeeting } from './agenteFreshStart';

const SID = '44444444-4444-4444-4444-444444444444';
const ROOM = 'abc-defg-hij';

function detected(meetingId: string, meetingCode = ROOM): MeetingEvent {
  return {
    type: 'MEETING_DETECTED',
    meetingId,
    meetingCode,
    provider: 'google-meet',
    tabId: 1,
    title: 'Reunião',
    captionsEnabled: true,
    at: 1000,
  };
}

const activeState = transition(IDLE_STATE, detected('m1'));
const endedState: MeetingState = transition(activeState, { type: 'MEETING_FINISHED', at: 5000 });

function rig(association: MeetingAssociation | null, closing = false) {
  const getAssociation = vi.fn(() => Promise.resolve(association));
  const isClosing = vi.fn(() => closing);
  return { getAssociation, isClosing };
}

describe('shouldStartFreshMeeting', () => {
  it('ended + mesma sala + associação com sessionFinished -> true', async () => {
    const deps = rig({ meetingId: 'm1', state: 'linked', sessionId: SID, origin: 'picker', sessionFinished: true });
    expect(await shouldStartFreshMeeting(endedState, ROOM, deps)).toBe(true);
    expect(deps.getAssociation).toHaveBeenCalledWith('m1');
  });

  it('ended + mesma sala + linked sem encerramento e nada em voo -> false', async () => {
    const deps = rig({ meetingId: 'm1', state: 'linked', sessionId: SID, origin: 'picker' });
    expect(await shouldStartFreshMeeting(endedState, ROOM, deps)).toBe(false);
    expect(deps.isClosing).toHaveBeenCalledWith('m1');
  });

  it('ended + mesma sala + finish em voo (isClosing) -> true, mesmo sem a marca', async () => {
    const deps = rig({ meetingId: 'm1', state: 'linked', sessionId: SID, origin: 'picker' }, true);
    expect(await shouldStartFreshMeeting(endedState, ROOM, deps)).toBe(true);
  });

  it('ended-unsent (nunca teve cliente) -> false', async () => {
    const deps = rig({ meetingId: 'm1', state: 'ended-unsent' });
    expect(await shouldStartFreshMeeting(endedState, ROOM, deps)).toBe(false);
  });

  it('sem associação nenhuma -> false', async () => {
    expect(await shouldStartFreshMeeting(endedState, ROOM, rig(null))).toBe(false);
  });

  it.each([
    ['fase ativa', activeState, ROOM],
    ['fase idle', IDLE_STATE, ROOM],
    ['sala diferente', endedState, 'zzz-zzzz-zzz'],
  ] as const)('%s -> false e nada é lido', async (_name, state, code) => {
    const deps = rig({ meetingId: 'm1', state: 'linked', sessionId: SID, sessionFinished: true });
    expect(await shouldStartFreshMeeting(state, code, deps)).toBe(false);
    expect(deps.getAssociation).not.toHaveBeenCalled();
    expect(deps.isClosing).not.toHaveBeenCalled();
  });
});
