/**
 * A volta à mesma sala e o fim da reunião no reducer da associação (Fase 8, plano 08-24, B4-b, DA-1):
 * depois que a sessão do Agente foi encerrada, a volta devolve uma associação `pending` limpa (reunião
 * nova); antes disso a retomada é a do 08-22, só que o prazo de encerramento é cancelado.
 */
import { describe, expect, it } from 'vitest';
import type { AssociationState, MeetingAssociation } from './association';
import { BEFORE_LINK, reduceMeetingEnded, reduceMeetingResumed } from './associationMeeting';

const M = 'm1';
const SID = '33333333-3333-3333-3333-333333333333';
const SEED = { '0:c1': 2 };

function assoc(state: AssociationState, extra: Partial<MeetingAssociation> = {}): MeetingAssociation {
  return { meetingId: M, state, ...extra };
}

const FINISHED_FIELDS: Partial<MeetingAssociation> = {
  clientName: 'ACME',
  sessionId: SID,
  origin: 'picker',
  sendProgress: { done: 1, total: 2 },
  seedSent: SEED,
  error: 'send',
  sessionFinished: true,
};

describe('reduceMeetingEnded', () => {
  it.each(BEFORE_LINK)('%s -> ended-unsent', (state) => {
    expect(reduceMeetingEnded(assoc(state))).toEqual(assoc('ended-unsent'));
  });

  it.each(['linking', 'linked', 'sent', 'send-failed', 'sending', 'ended-unsent'] as const)(
    '%s fica como está (mesma referência)',
    (state) => {
      const current = assoc(state);
      expect(reduceMeetingEnded(current)).toBe(current);
    },
  );
});

describe('reduceMeetingResumed com a sessão do Agente encerrada (DA-1 = reuniao-nova-de-verdade)', () => {
  it.each(['sending', 'linked', 'sent', 'send-failed'] as const)(
    '%s + sessionFinished -> pending limpo, sem nenhum rastro da sessão fechada',
    (state) => {
      const current = assoc(state, { ...FINISHED_FIELDS, finishBy: 99, finishTries: 2, finishGaveUp: true });
      const next = reduceMeetingResumed(current);
      expect(next).toEqual({ meetingId: M, state: 'pending' });
      expect(Object.keys(next)).toEqual(['meetingId', 'state']);
    },
  );
});

describe('reduceMeetingResumed sem sessionFinished (a retomada do 08-22 continua)', () => {
  it('ended-unsent -> pending (a bolha volta)', () => {
    expect(reduceMeetingResumed(assoc('ended-unsent', { clientName: 'ACME' }))).toEqual(assoc('pending'));
  });

  it('sending -> linking com a mesma sessão', () => {
    const next = reduceMeetingResumed(assoc('sending', { sessionId: SID, clientName: 'ACME', origin: 'picker' }));
    expect(next).toEqual(assoc('linking', { sessionId: SID, clientName: 'ACME', origin: 'picker' }));
  });

  it('sent com sessão -> linked, com a mesma sessão e a semente preservada', () => {
    const next = reduceMeetingResumed(assoc('sent', { sessionId: SID, origin: 'picker', seedSent: SEED }));
    expect(next).toEqual(assoc('linked', { sessionId: SID, origin: 'picker', seedSent: SEED }));
  });

  it('sent sem sessão não muda (mesma referência)', () => {
    const current = assoc('sent');
    expect(reduceMeetingResumed(current)).toBe(current);
  });

  it.each(['pending', 'choosing', 'deferred', 'linking'] as const)('%s: mesma referência', (state) => {
    const current = assoc(state);
    expect(reduceMeetingResumed(current)).toBe(current);
  });

  it.each(['linked', 'send-failed'] as const)('%s sem prazo algum: mesma referência (nada a limpar)', (state) => {
    const current = assoc(state, { sessionId: SID, origin: 'picker' });
    expect(reduceMeetingResumed(current)).toBe(current);
  });
});

describe('reduceMeetingResumed cancela o prazo de encerramento (a volta antes do fim)', () => {
  it.each(['linked', 'send-failed'] as const)('%s com finishBy/finishTries/finishGaveUp: segue igual, sem o prazo', (state) => {
    const current = assoc(state, { sessionId: SID, origin: 'picker', finishBy: 5, finishTries: 3, finishGaveUp: true });
    expect(reduceMeetingResumed(current)).toEqual(assoc(state, { sessionId: SID, origin: 'picker' }));
  });

  it('sent com prazo -> linked sem o prazo, com a semente', () => {
    const current = assoc('sent', { sessionId: SID, origin: 'picker', seedSent: SEED, finishBy: 5, finishTries: 1 });
    expect(reduceMeetingResumed(current)).toEqual(assoc('linked', { sessionId: SID, origin: 'picker', seedSent: SEED }));
  });

  it('só finishBy: some, e o resto fica', () => {
    const current = assoc('linked', { sessionId: SID, clientName: 'ACME', finishBy: 5 });
    expect(reduceMeetingResumed(current)).toEqual(assoc('linked', { sessionId: SID, clientName: 'ACME' }));
  });
});
