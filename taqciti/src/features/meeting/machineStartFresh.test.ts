/**
 * `startFresh` no MEETING_DETECTED (Fase 8, plano 08-24, B4-b, DA-1 = reuniao-nova-de-verdade): quando a
 * sessão do Agente da reunião anterior já foi encerrada, a volta à MESMA sala é reunião nova, não retomada.
 * Sem o campo, a retomada da Fase 7 continua idêntica (o `machine.test.ts` roda sem alteração).
 */
import { describe, expect, it } from 'vitest';
import type { MeetingState } from '@/shared/types/domain';
import { IDLE_STATE } from '@/shared/types/domain';
import { REJOIN_RESUME_WINDOW_MS } from '@/shared/config/constants';
import type { MeetingEvent } from './machine';
import { transition } from './machine';

const T0 = 1_000_000;

function detected(
  overrides: Partial<Extract<MeetingEvent, { type: 'MEETING_DETECTED' }>> = {},
): MeetingEvent {
  return {
    type: 'MEETING_DETECTED',
    meetingId: 'm-1',
    meetingCode: 'abc-defg-hij',
    provider: 'google-meet',
    tabId: 7,
    title: 'Reunião com cliente',
    captionsEnabled: true,
    at: T0,
    ...overrides,
  };
}

function chunk(id: string, text: string): MeetingEvent {
  return { type: 'CAPTION_CHUNK', chunk: { captionId: id, speaker: 'Ana', text, atMs: T0 + 5000 } };
}

/** m-1 gravou uma fala e terminou 60 s depois. */
function endedState(): MeetingState {
  let state = transition(IDLE_STATE, detected());
  state = transition(state, chunk('c1', 'olá tudo bem'));
  return transition(state, { type: 'MEETING_FINISHED', at: T0 + 60_000 });
}

const BACK_AT = T0 + 90_000;

describe('startFresh no MEETING_DETECTED', () => {
  it('sem startFresh: a mesma sala volta e retoma o mesmo meetingId, com os segmentos (Fase 7)', () => {
    const next = transition(endedState(), detected({ meetingId: 'm-2', at: BACK_AT }));
    expect(next.session?.meetingId).toBe('m-1');
    expect(next.session?.endedAt).toBeNull();
    expect(next.session?.segments.length).toBeGreaterThan(0);
  });

  it('startFresh false: igual a sem o campo', () => {
    const next = transition(endedState(), detected({ meetingId: 'm-2', at: BACK_AT, startFresh: false }));
    expect(next.session?.meetingId).toBe('m-1');
  });

  it('startFresh true: sessão nova com o meetingId do evento e os segmentos vazios', () => {
    const next = transition(endedState(), detected({ meetingId: 'm-2', at: BACK_AT, startFresh: true }));
    expect(next.phase).toBe('recording');
    expect(next.session?.meetingId).toBe('m-2');
    expect(next.session?.segments).toEqual([]);
    expect(next.session?.endedAt).toBeNull();
    expect(next.session?.startedAt).toBe(BACK_AT);
  });

  it('startFresh true sem legendas: a fase segue captionsEnabled (captionsRequired)', () => {
    const next = transition(
      endedState(),
      detected({ meetingId: 'm-2', at: BACK_AT, startFresh: true, captionsEnabled: false }),
    );
    expect(next.phase).toBe('captionsRequired');
    expect(next.session?.meetingId).toBe('m-2');
  });

  it('startFresh true com a reunião ATIVA na mesma sala: a sessão continua (a sala ativa vem antes)', () => {
    const active = transition(IDLE_STATE, detected());
    const next = transition(active, detected({ meetingId: 'm-2', at: T0 + 1000, startFresh: true }));
    expect(next.session?.meetingId).toBe('m-1');
  });

  it('startFresh true com sala diferente, ou fora da janela: sessão nova de qualquer jeito', () => {
    const other = transition(
      endedState(),
      detected({ meetingId: 'm-2', meetingCode: 'zzz-zzzz-zzz', at: BACK_AT, startFresh: true }),
    );
    expect(other.session?.meetingId).toBe('m-2');
    const late = transition(
      endedState(),
      detected({ meetingId: 'm-3', at: T0 + 60_000 + REJOIN_RESUME_WINDOW_MS + 1, startFresh: true }),
    );
    expect(late.session?.meetingId).toBe('m-3');
  });

  it('duas detecções seguidas com startFresh: só a primeira abre a reunião nova', () => {
    const first = transition(endedState(), detected({ meetingId: 'm-2', at: BACK_AT, startFresh: true }));
    const second = transition(first, detected({ meetingId: 'm-3', at: BACK_AT + 1000, startFresh: true }));
    expect(second.session?.meetingId).toBe('m-2');
  });
});
