/**
 * O encerramento guardado na associação (Fase 8, B4-b, plano 08-16): `session-finished`,
 * `finish-armed` (só o PRIMEIRO prazo vale) e `finish-failed` (a 11ª falha desiste), a regra de quem
 * é elegível e a garantia de que nenhuma marca se perde ao mudar de estado (`carryIdentity`).
 * Transição que não vale devolve a MESMA referência (`toBe`), padrão de `association.ts`.
 */
import { describe, expect, it } from 'vitest';
import {
  ASSOCIATION_STATES,
  reduceAssociation,
  type AssociationEvent,
  type AssociationState,
  type MeetingAssociation,
} from './association';
import { isEligibleForClose, reduceCloseFlow } from './associationClose';
import { AGENTE_FINISH_MAX_TRIES } from './finishPolicy';

const M = 'm1';
const SID = '22222222-2222-2222-2222-222222222222';
const BY = 1_700_000_000_000;

function assoc(state: AssociationState, extra: Partial<MeetingAssociation> = {}): MeetingAssociation {
  return { meetingId: M, state, sessionId: SID, origin: 'picker', clientName: 'ACME', ...extra };
}

const ELIGIBLE_STATES: readonly AssociationState[] = ['linked', 'sent', 'send-failed'];
const OTHER_STATES = ASSOCIATION_STATES.filter((state) => !ELIGIBLE_STATES.includes(state));

describe('session-finished', () => {
  it.each(ASSOCIATION_STATES)('em %s com sessionId: marca sessionFinished e zera o resto', (state) => {
    const current = assoc(state, { finishBy: BY, finishTries: 3, finishGaveUp: true });
    const next = reduceCloseFlow(current, { type: 'session-finished' });
    expect(next).toEqual(assoc(state, { sessionFinished: true }));
    expect(next).not.toHaveProperty('finishBy');
    expect(next).not.toHaveProperty('finishTries');
    expect(next).not.toHaveProperty('finishGaveUp');
  });

  it('sem sessionId: mesma referência', () => {
    const current: MeetingAssociation = { meetingId: M, state: 'deferred' };
    expect(reduceCloseFlow(current, { type: 'session-finished' })).toBe(current);
  });

  it('associação já encerrada: mesma referência', () => {
    const current = assoc('linked', { sessionFinished: true });
    expect(reduceCloseFlow(current, { type: 'session-finished' })).toBe(current);
  });
});

describe('finish-armed', () => {
  it.each(ELIGIBLE_STATES)('em %s sem prazo: grava finishBy', (state) => {
    const next = reduceCloseFlow(assoc(state), { type: 'finish-armed', by: BY });
    expect(next).toEqual(assoc(state, { finishBy: BY }));
  });

  it('o PRIMEIRO prazo vale: com finishBy já gravado devolve a mesma referência', () => {
    const current = assoc('send-failed', { finishBy: BY });
    expect(reduceCloseFlow(current, { type: 'finish-armed', by: BY + 60_000 })).toBe(current);
  });

  it.each(OTHER_STATES)('em %s: mesma referência', (state) => {
    const current = assoc(state);
    expect(reduceCloseFlow(current, { type: 'finish-armed', by: BY })).toBe(current);
  });

  it('sem sessionId, encerrada ou desistida: mesma referência', () => {
    const noSession: MeetingAssociation = { meetingId: M, state: 'linked' };
    const finished = assoc('linked', { sessionFinished: true });
    const gaveUp = assoc('linked', { finishGaveUp: true });
    for (const current of [noSession, finished, gaveUp]) {
      expect(reduceCloseFlow(current, { type: 'finish-armed', by: BY })).toBe(current);
    }
  });
});

describe('finish-failed', () => {
  it.each(ELIGIBLE_STATES)('em %s: soma uma tentativa e mantém o prazo', (state) => {
    const first = reduceCloseFlow(assoc(state, { finishBy: BY }), { type: 'finish-failed' });
    expect(first).toEqual(assoc(state, { finishBy: BY, finishTries: 1 }));
    const second = reduceCloseFlow(first, { type: 'finish-failed' });
    expect(second).toMatchObject({ finishBy: BY, finishTries: 2 });
    expect(second).not.toHaveProperty('finishGaveUp');
  });

  it('a 11ª falha marca finishGaveUp', () => {
    const tenth = assoc('linked', { finishTries: AGENTE_FINISH_MAX_TRIES - 1 });
    const next = reduceCloseFlow(tenth, { type: 'finish-failed' });
    expect(next).toMatchObject({ finishTries: AGENTE_FINISH_MAX_TRIES, finishGaveUp: true });
  });

  it('recusa definitiva desiste já na primeira falha', () => {
    const next = reduceCloseFlow(assoc('sent'), { type: 'finish-failed', definitive: true });
    expect(next).toMatchObject({ finishTries: 1, finishGaveUp: true });
  });

  it.each(OTHER_STATES)('em %s: mesma referência', (state) => {
    const current = assoc(state);
    expect(reduceCloseFlow(current, { type: 'finish-failed' })).toBe(current);
  });

  it('já desistida, encerrada ou sem sessionId: mesma referência (sem contar mais tentativas)', () => {
    const gaveUp = assoc('linked', { finishGaveUp: true, finishTries: 4 });
    const finished = assoc('linked', { sessionFinished: true });
    const noSession: MeetingAssociation = { meetingId: M, state: 'linked' };
    for (const current of [gaveUp, finished, noSession]) {
      expect(reduceCloseFlow(current, { type: 'finish-failed' })).toBe(current);
    }
  });
});

describe('isEligibleForClose', () => {
  it.each(ELIGIBLE_STATES)('picker + sessionId em %s: elegível', (state) => {
    expect(isEligibleForClose(assoc(state))).toBe(true);
  });

  it('elegível com tentativas abaixo do máximo', () => {
    expect(isEligibleForClose(assoc('linked', { finishTries: AGENTE_FINISH_MAX_TRIES - 1 }))).toBe(true);
  });

  it('plano B (manual-id) nunca', () => {
    expect(isEligibleForClose(assoc('linked', { origin: 'manual-id' }))).toBe(false);
  });

  it('sem origem registrada: não elegível', () => {
    const withoutOrigin: MeetingAssociation = { meetingId: M, state: 'linked', sessionId: SID };
    expect(isEligibleForClose(withoutOrigin)).toBe(false);
  });

  it('sem sessionId, já encerrada, desistida ou com tentativas esgotadas: não elegível', () => {
    expect(isEligibleForClose({ meetingId: M, state: 'linked', origin: 'picker' })).toBe(false);
    expect(isEligibleForClose(assoc('linked', { sessionFinished: true }))).toBe(false);
    expect(isEligibleForClose(assoc('linked', { finishGaveUp: true }))).toBe(false);
    expect(isEligibleForClose(assoc('linked', { finishTries: AGENTE_FINISH_MAX_TRIES }))).toBe(false);
  });

  it.each(OTHER_STATES)('estado %s: não elegível', (state) => {
    expect(isEligibleForClose(assoc(state))).toBe(false);
  });
});

describe('integração com reduceAssociation e carryIdentity', () => {
  const reduce = (current: MeetingAssociation | null, event: AssociationEvent) =>
    reduceAssociation(current, M, event);
  const marks = { sessionFinished: true, finishBy: BY, finishTries: 2, finishGaveUp: true } as const;

  it('o reducer principal delega os três eventos de encerramento', () => {
    const armed = reduce(assoc('linked'), { type: 'finish-armed', by: BY });
    expect(armed).toEqual(assoc('linked', { finishBy: BY }));
    expect(reduce(armed, { type: 'finish-failed' })).toMatchObject({ finishTries: 1 });
    expect(reduce(armed, { type: 'session-finished' })).toMatchObject({ sessionFinished: true });
    expect(reduce(null, { type: 'session-finished' })).toBeNull();
  });

  it('link-completed mantém os quatro campos', () => {
    const next = reduce(assoc('linking', marks), { type: 'link-completed', seedSent: {} });
    expect(next).toMatchObject({ state: 'linked', ...marks });
  });

  it('send-completed mantém os quatro campos', () => {
    const next = reduce(assoc('sending', marks), { type: 'send-completed', seedSent: {} });
    expect(next).toMatchObject({ state: 'sent', ...marks });
  });

  it('seed-consumed mantém o prazo (a semente some logo depois do vínculo, o prazo não reinicia)', () => {
    const next = reduce(assoc('linked', { seedSent: {}, finishBy: BY, finishTries: 1 }), {
      type: 'seed-consumed',
    });
    expect(next).toMatchObject({ state: 'linked', finishBy: BY, finishTries: 1 });
    expect(next).not.toHaveProperty('seedSent');
  });

  it('sem as marcas, nada muda: nenhuma chave nova aparece', () => {
    const next = reduce(assoc('linking'), { type: 'link-completed', seedSent: {} });
    expect(next).toEqual(assoc('linked', { seedSent: {} }));
    for (const key of ['sessionFinished', 'finishBy', 'finishTries', 'finishGaveUp']) {
      expect(next).not.toHaveProperty(key);
    }
  });
});
