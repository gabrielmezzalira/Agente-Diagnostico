/**
 * Tabela de transições do reducer da associação reunião → sessão (Fase 8, plano 08-01, Task 2).
 * Cobre cada transição legal do diagrama do UI-SPEC e, para TODO estado, o que acontece quando a
 * reunião termina, quando a mesma sala é retomada e quando o vínculo conclui — nenhum estado fica
 * sem saída. Transição ilegal devolve a MESMA referência (`toBe`), padrão de `meeting/machine.ts`.
 */
import { describe, expect, it } from 'vitest';
import {
  ASSOCIATION_STATES,
  reduceAssociation,
  type AssociationEvent,
  type AssociationState,
  type MeetingAssociation,
} from './association';

const M = 'm1';
const SID = '22222222-2222-2222-2222-222222222222';
const SEED = { '0:c1': 3 };

function assoc(state: AssociationState, extra: Partial<MeetingAssociation> = {}): MeetingAssociation {
  return { meetingId: M, state, ...extra };
}
const reduce = (current: MeetingAssociation | null, event: AssociationEvent) =>
  reduceAssociation(current, M, event);

describe('transições legais do diagrama do UI-SPEC', () => {
  const legal: Array<[string, MeetingAssociation | null, AssociationEvent, MeetingAssociation]> = [
    ['null + created -> pending', null, { type: 'created' }, assoc('pending')],
    ['pending + opened -> choosing', assoc('pending'), { type: 'opened' }, assoc('choosing')],
    ['deferred + opened -> choosing', assoc('deferred'), { type: 'opened' }, assoc('choosing')],
    ['choosing + deferred -> deferred', assoc('choosing'), { type: 'deferred' }, assoc('deferred')],
    [
      'choosing + link-started -> linking',
      assoc('choosing'),
      { type: 'link-started', origin: 'picker', clientName: 'ACME' },
      assoc('linking', { clientName: 'ACME', origin: 'picker' }),
    ],
    [
      'deferred (com erro) + link-started -> linking sem o erro antigo',
      assoc('deferred', { error: 'create-session' }),
      { type: 'link-started', origin: 'manual-id', clientName: 'ACME', sessionId: SID },
      assoc('linking', { clientName: 'ACME', origin: 'manual-id', sessionId: SID }),
    ],
    [
      'linking + session-created -> linking com sessionId',
      assoc('linking', { origin: 'picker' }),
      { type: 'session-created', sessionId: SID },
      assoc('linking', { origin: 'picker', sessionId: SID }),
    ],
    [
      'linking + link-progress -> linking com sendProgress',
      assoc('linking', { sessionId: SID }),
      { type: 'link-progress', done: 2, total: 5 },
      assoc('linking', { sessionId: SID, sendProgress: { done: 2, total: 5 } }),
    ],
    [
      'linking (sem sessionId) + link-failed(create-session) -> deferred com erro',
      assoc('linking', { clientName: 'ACME', origin: 'picker' }),
      { type: 'link-failed', error: 'create-session' },
      assoc('deferred', { clientName: 'ACME', error: 'create-session' }),
    ],
    [
      'linking (com sessionId) + link-failed(send) -> send-failed, sendProgress preservado',
      assoc('linking', { sessionId: SID, origin: 'manual-id', sendProgress: { done: 1, total: 4 } }),
      { type: 'link-failed', error: 'send' },
      assoc('send-failed', {
        sessionId: SID,
        origin: 'manual-id',
        sendProgress: { done: 1, total: 4 },
        error: 'send',
      }),
    ],
    [
      'linking (com sessionId) + link-completed -> linked com a semente',
      assoc('linking', { sessionId: SID, origin: 'picker', clientName: 'ACME', sendProgress: { done: 4, total: 4 } }),
      { type: 'link-completed', seedSent: SEED },
      assoc('linked', { sessionId: SID, origin: 'picker', clientName: 'ACME', seedSent: SEED }),
    ],
    [
      'linked + seed-consumed -> linked sem a semente',
      assoc('linked', { sessionId: SID, seedSent: SEED }),
      { type: 'seed-consumed' },
      assoc('linked', { sessionId: SID }),
    ],
    [
      'ended-unsent + send-started (manual) -> sending com sessionId',
      assoc('ended-unsent'),
      { type: 'send-started', origin: 'manual-id', clientName: 'ACME', sessionId: SID },
      assoc('sending', { origin: 'manual-id', clientName: 'ACME', sessionId: SID }),
    ],
    [
      'ended-unsent + send-started (picker) -> sending sem sessionId',
      assoc('ended-unsent'),
      { type: 'send-started', origin: 'picker', clientName: 'ACME' },
      assoc('sending', { origin: 'picker', clientName: 'ACME' }),
    ],
    [
      'sending + send-session-created -> sending com sessionId',
      assoc('sending', { origin: 'picker' }),
      { type: 'send-session-created', sessionId: SID },
      assoc('sending', { origin: 'picker', sessionId: SID }),
    ],
    [
      'sending + send-progress -> sending com sendProgress',
      assoc('sending', { sessionId: SID }),
      { type: 'send-progress', done: 3, total: 9 },
      assoc('sending', { sessionId: SID, sendProgress: { done: 3, total: 9 } }),
    ],
    [
      'sending (com sessionId) + send-completed -> sent com a semente do envio',
      assoc('sending', { sessionId: SID, origin: 'picker', clientName: 'ACME', sendProgress: { done: 9, total: 9 } }),
      { type: 'send-completed', seedSent: SEED },
      assoc('sent', { sessionId: SID, origin: 'picker', clientName: 'ACME', seedSent: SEED }),
    ],
    [
      'sending (sem sessionId) + send-failed -> ended-unsent com erro create-session',
      assoc('sending', { origin: 'picker', clientName: 'ACME' }),
      { type: 'send-failed', error: 'create-session' },
      assoc('ended-unsent', { clientName: 'ACME', error: 'create-session' }),
    ],
    [
      'sending (com sessionId) + send-failed -> send-failed',
      assoc('sending', { sessionId: SID, origin: 'picker', sendProgress: { done: 2, total: 9 } }),
      { type: 'send-failed', error: 'send' },
      assoc('send-failed', {
        sessionId: SID,
        origin: 'picker',
        sendProgress: { done: 2, total: 9 },
        error: 'send',
      }),
    ],
  ];

  it.each(legal)('%s', (_name, current, event, expected) => {
    expect(reduce(current, event)).toEqual(expected);
  });

  it('linking sem sessionId não conclui (link-completed é ilegal sem sessão)', () => {
    const current = assoc('linking');
    expect(reduce(current, { type: 'link-completed', seedSent: SEED })).toBe(current);
  });
});

describe('fim da reunião (meeting-ended) em todo estado', () => {
  const ended: Array<[AssociationState, Partial<MeetingAssociation>, 'same' | AssociationState]> = [
    ['pending', {}, 'ended-unsent'],
    ['choosing', {}, 'ended-unsent'],
    ['deferred', {}, 'ended-unsent'],
    ['deferred', { error: 'create-session' }, 'ended-unsent'],
    // o vínculo em andamento continua: quem resolve o fim é o fluxo de vínculo (08-10)
    ['linking', { sessionId: SID }, 'same'],
    ['linked', { sessionId: SID }, 'same'],
    ['ended-unsent', {}, 'same'],
    ['sending', { sessionId: SID }, 'same'],
    ['sent', { sessionId: SID, seedSent: SEED }, 'same'],
    ['send-failed', { sessionId: SID, error: 'send' }, 'same'],
  ];

  it.each(ended)('%s %j + meeting-ended', (state, extra, expected) => {
    const current = assoc(state, extra);
    const next = reduce(current, { type: 'meeting-ended' });
    if (expected === 'same') {
      expect(next).toBe(current);
    } else {
      expect(next).toEqual({ ...current, state: expected });
    }
  });

  it('deferred com erro create-session vira ended-unsent preservando o erro', () => {
    const next = reduce(assoc('deferred', { error: 'create-session' }), { type: 'meeting-ended' });
    expect(next).toMatchObject({ state: 'ended-unsent', error: 'create-session' });
  });
});

describe('retomada da mesma sala (meeting-resumed) em todo estado', () => {
  it('ended-unsent -> pending, sem erro (a bolha reaparece)', () => {
    const next = reduce(assoc('ended-unsent', { error: 'create-session' }), { type: 'meeting-resumed' });
    expect(next).toEqual(assoc('pending'));
  });

  it('sending -> linking, mantendo sessionId, origin, clientName e sendProgress', () => {
    const current = assoc('sending', {
      sessionId: SID,
      origin: 'picker',
      clientName: 'ACME',
      sendProgress: { done: 2, total: 9 },
    });
    expect(reduce(current, { type: 'meeting-resumed' })).toEqual({ ...current, state: 'linking' });
  });

  it('sent -> linked, mantendo sessionId, origin, clientName e o seedSent do send-completed', () => {
    const current = assoc('sent', { sessionId: SID, origin: 'picker', clientName: 'ACME', seedSent: SEED });
    expect(reduce(current, { type: 'meeting-resumed' })).toEqual({ ...current, state: 'linked' });
  });

  it('sent sem sessionId não vira linked (nunca fala nova para a sessão errada)', () => {
    const current = assoc('sent');
    expect(reduce(current, { type: 'meeting-resumed' })).toBe(current);
  });

  it.each<AssociationState>(['send-failed', 'linked', 'linking', 'pending', 'choosing', 'deferred'])(
    '%s + meeting-resumed fica como está',
    (state) => {
      const current = assoc(state, { sessionId: SID });
      expect(reduce(current, { type: 'meeting-resumed' })).toBe(current);
    },
  );
});

describe('transições ilegais devolvem a mesma referência', () => {
  const illegal: Array<[string, MeetingAssociation | null, AssociationEvent]> = [
    ['linked + opened', assoc('linked', { sessionId: SID }), { type: 'opened' }],
    ['sent + send-started', assoc('sent', { sessionId: SID }), { type: 'send-started', origin: 'picker', clientName: 'ACME' }],
    ['pending + link-completed', assoc('pending'), { type: 'link-completed', seedSent: SEED }],
    ['sent + meeting-ended', assoc('sent', { sessionId: SID }), { type: 'meeting-ended' }],
    ['sending + link-started', assoc('sending'), { type: 'link-started', origin: 'picker', clientName: 'ACME' }],
    ['linking + send-progress', assoc('linking'), { type: 'send-progress', done: 1, total: 2 }],
    ['ended-unsent + link-started', assoc('ended-unsent'), { type: 'link-started', origin: 'picker', clientName: 'ACME' }],
    ['pending + created (já existe)', assoc('pending'), { type: 'created' }],
    ['null + opened (não existe)', null, { type: 'opened' }],
    ['linked + seed-consumed (sem semente)', assoc('linked', { sessionId: SID }), { type: 'seed-consumed' }],
    ['linking sem sessão + link-failed(send)', assoc('linking'), { type: 'link-failed', error: 'send' }],
  ];

  it.each(illegal)('%s', (_name, current, event) => {
    expect(reduce(current, event)).toBe(current);
  });

  it('todo estado do tipo aparece na lista de estados válidos', () => {
    expect(ASSOCIATION_STATES).toHaveLength(9);
  });
});
