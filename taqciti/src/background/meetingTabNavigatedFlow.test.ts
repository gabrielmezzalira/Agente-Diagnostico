/**
 * Troca de URL no meio da call com a máquina REAL (plano 08-28, CR-02, TAQ-02): o estado nasce de
 * `transition(IDLE_STATE, MEETING_DETECTED)` e o `dispatch` aplica `transition` de verdade. Prova que mexer
 * na URL da MESMA sala (`/<código>` -> `/meet/<código>`, `?authuser=1`, `#hash`) não encerra a reunião e que
 * sair de verdade (DA-4) encerra uma vez só, também repetido e em paralelo.
 */
import { describe, expect, it } from 'vitest';
import { transition, type MeetingEvent } from '@/features/meeting/machine';
import { IDLE_STATE, type MeetingState } from '@/shared/types/domain';
import { onMeetingTabNavigated } from './meetingTabNavigated';

const ROOM = 'abc-defg-hij';
const TAB = 7;
const NOW = 424242;

const detected: MeetingEvent = {
  type: 'MEETING_DETECTED',
  meetingId: 'm1',
  meetingCode: ROOM,
  provider: 'google-meet',
  tabId: TAB,
  title: 'Reunião de teste',
  captionsEnabled: true,
  at: 1000,
};

function liveMeeting() {
  let state: MeetingState = transition(IDLE_STATE, detected);
  expect(state.phase).toBe('recording');
  const dispatch = (event: MeetingEvent) => {
    state = transition(state, event);
    return Promise.resolve(state);
  };
  return { current: () => state, deps: { getState: () => state, dispatch, now: () => NOW } };
}

describe('fluxo com a máquina real: troca de URL no meio da call', () => {
  it('trocar de formato e mexer em ?query/#hash na mesma sala deixa a reunião em recording', async () => {
    const meeting = liveMeeting();
    for (const path of [`/${ROOM}`, `/meet/${ROOM}`, `/meet/${ROOM}?authuser=1`, `/meet/${ROOM}#fim`]) {
      await onMeetingTabNavigated(TAB, `https://meet.google.com${path}`, meeting.deps);
    }
    expect(meeting.current().phase).toBe('recording');
    expect(meeting.current().session?.endedAt).toBeNull();
  });

  it('sair de verdade encerra com endedAt do relógio; repetir a saída não muda nada', async () => {
    const meeting = liveMeeting();
    await onMeetingTabNavigated(TAB, 'https://news.ycombinator.com/', meeting.deps);
    const ended = meeting.current();
    expect(ended.phase).toBe('ended');
    expect(ended.session?.endedAt).toBe(NOW);

    await onMeetingTabNavigated(TAB, 'https://news.ycombinator.com/', meeting.deps);
    await onMeetingTabNavigated(TAB, 'https://example.com/', meeting.deps);
    expect(meeting.current()).toBe(ended);
    expect(meeting.current().session?.endedAt).toBe(NOW);
  });

  it('duas saídas simultâneas deixam a reunião ended uma vez só, com o endedAt da primeira', async () => {
    const meeting = liveMeeting();
    await Promise.all([
      onMeetingTabNavigated(TAB, 'https://news.ycombinator.com/', meeting.deps),
      onMeetingTabNavigated(TAB, 'https://news.ycombinator.com/', meeting.deps),
    ]);
    expect(meeting.current().phase).toBe('ended');
    expect(meeting.current().session?.endedAt).toBe(NOW);
  });

  it('duas notificações simultâneas na mesma sala não encerram nada', async () => {
    const meeting = liveMeeting();
    const url = `https://meet.google.com/meet/${ROOM}#x`;
    await Promise.all([
      onMeetingTabNavigated(TAB, url, meeting.deps),
      onMeetingTabNavigated(TAB, url, meeting.deps),
    ]);
    expect(meeting.current().phase).toBe('recording');
  });
});
