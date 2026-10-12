/**
 * Qual sessão o AGP segue (Fase 10, critério 3): só a de reunião ao vivo com vínculo explícito.
 */
import { describe, expect, it } from 'vitest';
import type { MeetingAssociation } from './association';
import { selectAgpTarget } from './agpTarget';

const SID = '11111111-1111-1111-1111-111111111111';
const linked = (over: Partial<MeetingAssociation> = {}): MeetingAssociation => ({
  meetingId: 'm1', state: 'linked', origin: 'picker', sessionId: SID, clientName: 'ACME', ...over,
});

describe('selectAgpTarget', () => {
  it('reunião ao vivo + vínculo explícito -> a sessão', () => {
    expect(selectAgpTarget({ m1: linked() }, 'm1')).toEqual({ meetingId: 'm1', sessionId: SID });
    expect(selectAgpTarget({ m1: linked({ origin: 'manual-id' }) }, 'm1')).toEqual({ meetingId: 'm1', sessionId: SID });
  });
  it('nenhuma reunião ao vivo -> null', () => {
    expect(selectAgpTarget({ m1: linked() }, null)).toBeNull();
  });
  it('reunião ao vivo sem associação, ou de outra reunião -> null (nunca adivinha)', () => {
    expect(selectAgpTarget({}, 'm1')).toBeNull();
    expect(selectAgpTarget({ m2: linked({ meetingId: 'm2' }) }, 'm1')).toBeNull();
  });
  it.each([
    ['sem origem', linked({ origin: undefined })],
    ['sem sessionId', linked({ sessionId: undefined })],
    ['ainda deferida', linked({ state: 'deferred' })],
    ['vinculando', linked({ state: 'linking' })],
    ['sessão já encerrada', linked({ sessionFinished: true })],
  ])('%s -> null', (_name, association) => {
    expect(selectAgpTarget({ m1: association }, 'm1')).toBeNull();
  });
});
