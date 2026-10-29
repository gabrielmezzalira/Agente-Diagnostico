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

// D-11 (WR-04): a tabela follow/hold/none por fase x vínculo x envio. Acrescentado ao fim do arquivo (só acréscimo).
import type { MeetingPhase } from '@/shared/types/domain';
import { decideAgpFollow } from './agpTarget';

describe('decideAgpFollow (D-11)', () => {
  const LIVE: MeetingPhase[] = ['recording', 'paused', 'captionsRequired'];
  const follow = { kind: 'follow', meetingId: 'm1', sessionId: SID };
  const hold = { kind: 'hold', meetingId: 'm1', sessionId: SID };
  const none = { kind: 'none' };
  const decide = (phase: MeetingPhase, streaming: boolean, association = linked()) =>
    decideAgpFollow({ m1: association }, { phase, meetingId: 'm1' }, streaming);

  it.each([
    ['recording', true, follow],
    ['recording', false, hold],
    ['paused', true, hold],
    ['paused', false, hold],
    ['captionsRequired', true, hold],
    ['captionsRequired', false, hold],
    ['ended', true, none],
    ['ended', false, none],
    ['idle', true, none],
    ['idle', false, none],
  ] as const)('fase %s, envio %s, vínculo elegível -> %j', (phase, streaming, expected) => {
    expect(decide(phase, streaming)).toEqual(expected);
  });

  const INELIGIBLE: [string, MeetingAssociation | undefined][] = [
    ['sem associação', undefined],
    ['sem origem', linked({ origin: undefined })],
    ['ainda deferida', linked({ state: 'deferred' })],
    ['vinculando', linked({ state: 'linking' })],
    ['sessão já encerrada', linked({ sessionFinished: true })],
  ];

  it.each(LIVE.flatMap((phase) => INELIGIBLE.map(([reason, association]) => [phase, reason, association] as const)))(
    'fase ao vivo %s, vínculo inelegível (%s) -> none, com o envio ligado ou desligado',
    (phase, _reason, association) => {
      const associations: Record<string, MeetingAssociation> = association === undefined ? {} : { m1: association };
      for (const streaming of [true, false]) {
        expect(decideAgpFollow(associations, { phase, meetingId: 'm1' }, streaming)).toEqual(none);
      }
    },
  );

  it('sem reunião ao vivo (meetingId null) -> none em qualquer fase', () => {
    for (const phase of LIVE) expect(decideAgpFollow({ m1: linked() }, { phase, meetingId: null }, true)).toEqual(none);
  });

  it('o vínculo é o da reunião de agora: associação de outra reunião -> none', () => {
    expect(decideAgpFollow({ m2: linked({ meetingId: 'm2' }) }, { phase: 'recording', meetingId: 'm1' }, true)).toEqual(none);
  });
});
