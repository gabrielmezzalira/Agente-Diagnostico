/**
 * Tradução associação + entrega -> o que a tela mostra (Fase 8, plano 08-14, Task 1). Função pura:
 * o teste é uma tabela de estado x (ao vivo, encerrada), inclusive os três estados que uma sala
 * retomada pode mostrar ao vivo (`ended-unsent`, `sending`, `sent` — 08-22 converte logo em seguida).
 */
import { describe, expect, it } from 'vitest';
import type { AssociationState, MeetingAssociation } from './association';
import {
  recoveredToastDue,
  shouldBounce,
  toBadgeState,
  toBindingBarView,
  toEndPromptView,
} from './bindingView';
import { EMPTY_DELIVERY, type AgenteDelivery } from '@/shared/config/agenteDeliveryStore';

const OK: AgenteDelivery = EMPTY_DELIVERY;
const OFFLINE: AgenteDelivery = { ...EMPTY_DELIVERY, status: 'offline', queued: 4 };
const REJECTED_401: AgenteDelivery = { ...EMPTY_DELIVERY, status: 'rejected', httpStatus: 401 };

function assoc(state: AssociationState, extra: Partial<MeetingAssociation> = {}): MeetingAssociation {
  return { meetingId: 'm1', state, ...extra };
}

describe('toBindingBarView — reunião ao vivo', () => {
  it('sem associação, pending e choosing não têm barra (o aviso é a bolha ou o cartão)', () => {
    expect(toBindingBarView(null, OK, true)).toBeNull();
    expect(toBindingBarView(assoc('pending'), OK, true)).toBeNull();
    expect(toBindingBarView(assoc('choosing'), OK, true)).toBeNull();
  });

  it('deferred -> barra "Sem cliente"', () => {
    expect(toBindingBarView(assoc('deferred'), OK, true)).toEqual({ kind: 'deferred' });
  });

  it('linking com e sem progresso', () => {
    const withProgress = assoc('linking', { sendProgress: { done: 3, total: 12 } });
    expect(toBindingBarView(withProgress, OK, true)).toEqual({ kind: 'linking', done: 3, total: 12 });
    expect(toBindingBarView(assoc('linking'), OK, true)).toEqual({ kind: 'linking', done: 0, total: 0 });
  });

  it('linked + entrega ok -> "Enviando ao vivo"', () => {
    const linked = assoc('linked', { clientName: 'Empresa X' });
    expect(toBindingBarView(linked, OK, true)).toEqual({ kind: 'linked', clientName: 'Empresa X' });
  });

  it('linked + offline -> aviso com a contagem da fila', () => {
    const linked = assoc('linked', { clientName: 'Empresa X' });
    expect(toBindingBarView(linked, OFFLINE, true)).toEqual({
      kind: 'offline',
      clientName: 'Empresa X',
      queued: 4,
    });
  });

  it('linked + recusa 401 -> texto de rejectionText', () => {
    const linked = assoc('linked', { clientName: 'Empresa X' });
    expect(toBindingBarView(linked, REJECTED_401, true)).toEqual({
      kind: 'rejected',
      text: 'Último envio recusado: a chave de autenticação não foi aceita (HTTP 401).',
    });
  });

  it('linked + entrega failed não muda a barra (o detalhe fica na tela do Agente)', () => {
    const linked = assoc('linked', { clientName: 'Empresa X' });
    const failed: AgenteDelivery = { ...EMPTY_DELIVERY, status: 'failed', httpStatus: 500 };
    expect(toBindingBarView(linked, failed, true)).toEqual({ kind: 'linked', clientName: 'Empresa X' });
  });

  it('send-failed ao vivo -> "stopped" com o progresso', () => {
    const failed = assoc('send-failed', { sendProgress: { done: 6, total: 45 } });
    expect(toBindingBarView(failed, OK, true)).toEqual({ kind: 'stopped', done: 6, total: 45 });
  });
});

describe('toBindingBarView — sala retomada (estados de envio ao vivo)', () => {
  it('ended-unsent ao vivo -> deferred', () => {
    expect(toBindingBarView(assoc('ended-unsent'), OK, true)).toEqual({ kind: 'deferred' });
  });

  it('sending ao vivo -> linking com o progresso', () => {
    const sending = assoc('sending', { clientName: 'Empresa X', sendProgress: { done: 5, total: 40 } });
    expect(toBindingBarView(sending, OK, true)).toEqual({ kind: 'linking', done: 5, total: 40 });
  });

  it('sent ao vivo -> linked (ou offline/rejected conforme a entrega)', () => {
    const sent = assoc('sent', { clientName: 'Empresa X' });
    expect(toBindingBarView(sent, OK, true)).toEqual({ kind: 'linked', clientName: 'Empresa X' });
    expect(toBindingBarView(sent, OFFLINE, true)).toMatchObject({ kind: 'offline', queued: 4 });
    expect(toBindingBarView(sent, REJECTED_401, true)).toMatchObject({ kind: 'rejected' });
  });

  it('nenhum estado ao vivo fica sem tela: barra, cartão (choosing) ou bolha (pending)', () => {
    const states: AssociationState[] = [
      'pending', 'choosing', 'deferred', 'linking', 'linked', 'ended-unsent', 'sending', 'sent', 'send-failed',
    ];
    for (const state of states) {
      const a = assoc(state, { clientName: 'X' });
      const covered =
        toBindingBarView(a, OK, true) !== null || state === 'choosing' || shouldBounce(a);
      expect(covered, state).toBe(true);
    }
  });

  it('fora do ao vivo não há barra', () => {
    expect(toBindingBarView(assoc('deferred'), OK, false)).toBeNull();
  });
});

describe('toEndPromptView — reunião encerrada', () => {
  it('ended-unsent -> ask', () => {
    expect(toEndPromptView(assoc('ended-unsent'), false)).toEqual({ kind: 'ask' });
  });

  it('sending -> sending com cliente e progresso', () => {
    const sending = assoc('sending', { clientName: 'Empresa X', sendProgress: { done: 2, total: 9 } });
    expect(toEndPromptView(sending, false)).toEqual({
      kind: 'sending',
      clientName: 'Empresa X',
      done: 2,
      total: 9,
    });
  });

  it('sent / send-failed / linked', () => {
    expect(toEndPromptView(assoc('sent', { clientName: 'Empresa X' }), false)).toEqual({
      kind: 'sent',
      clientName: 'Empresa X',
    });
    expect(toEndPromptView(assoc('send-failed', { sendProgress: { done: 6, total: 45 } }), false)).toEqual({
      kind: 'failed',
      done: 6,
      total: 45,
    });
    expect(toEndPromptView(assoc('linked', { clientName: 'Empresa X' }), false)).toEqual({
      kind: 'linked-note',
      clientName: 'Empresa X',
    });
  });

  it('ao vivo, ou sem associação -> null', () => {
    expect(toEndPromptView(assoc('ended-unsent'), true)).toBeNull();
    expect(toEndPromptView(null, false)).toBeNull();
  });
});

describe('toBadgeState', () => {
  it.each<[AssociationState, boolean, string | null]>([
    ['pending', true, 'no-client'],
    ['choosing', true, 'no-client'],
    ['deferred', true, 'no-client'],
    ['ended-unsent', false, 'no-client'],
    ['linking', true, 'sending'],
    ['sending', false, 'sending'],
    ['linked', true, 'sending'],
    ['linked', false, 'sent'],
    ['sent', false, 'sent'],
    ['send-failed', false, 'stopped'],
  ])('%s (ao vivo: %s) -> %s', (state, live, expected) => {
    expect(toBadgeState(assoc(state), live)).toBe(expected);
  });

  it('sem associação não há selo', () => {
    expect(toBadgeState(null, true)).toBeNull();
  });
});

describe('shouldBounce e recoveredToastDue', () => {
  it('a bolha só pula em pending', () => {
    expect(shouldBounce(assoc('pending'))).toBe(true);
    expect(shouldBounce(assoc('choosing'))).toBe(false);
    expect(shouldBounce(assoc('deferred'))).toBe(false);
    expect(shouldBounce(assoc('linked'))).toBe(false);
    expect(shouldBounce(null)).toBe(false);
  });

  it('o toast só sai na volta de offline para ok com recoveredAt', () => {
    const back: AgenteDelivery = { ...EMPTY_DELIVERY, recoveredAt: 1700000000000 };
    expect(recoveredToastDue(OFFLINE, back)).toBe(true);
    expect(recoveredToastDue(OK, OK)).toBe(false);
    expect(recoveredToastDue(OFFLINE, OFFLINE)).toBe(false);
    expect(recoveredToastDue(OFFLINE, OK)).toBe(false);
    expect(recoveredToastDue(null, back)).toBe(false);
  });
});
