/**
 * Teste do selo do histórico a partir do id da reunião (Fase 8, plano 08-17, Task 1): cada estado da
 * associação vira o selo certo, reunião sem associação fica sem selo e vários selos compartilham UMA
 * assinatura do storage.
 */
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { AssociationState, MeetingAssociation } from '@/features/agente/association';
import { STORAGE_KEYS } from '@/shared/config/constants';
import { createAgenteHarness } from '@/test/agentePanelHarness';
import { AssociationBadgeFor } from './AssociationBadgeFor';

function assoc(meetingId: string, state: AssociationState): MeetingAssociation {
  return { meetingId, state };
}

const h = createAgenteHarness();

afterEach(async () => {
  await h.stop();
});

describe('AssociationBadgeFor', () => {
  it('ended-unsent -> "Sem cliente"; sent -> "Enviada"; send-failed -> "Envio parou"', async () => {
    h.start(assoc('a', 'ended-unsent'));
    await h.render(
      <>
        <span id="a"><AssociationBadgeFor recordId="a" live={false} /></span>
        <span id="b"><AssociationBadgeFor recordId="b" live={false} /></span>
        <span id="c"><AssociationBadgeFor recordId="c" live={false} /></span>
      </>,
    );
    expect(h.host.querySelector('#a')!.textContent).toContain('Sem cliente');
    // Sem associação: nada.
    expect(h.host.querySelector('#b')!.textContent).toBe('');

    await act(async () => {
      (globalThis.chrome.storage.local as { set: (v: unknown) => Promise<void> }).set({
        [STORAGE_KEYS.agenteAssociations]: {
          a: assoc('a', 'sent'),
          b: assoc('b', 'send-failed'),
          c: assoc('c', 'linked'),
        },
      });
    });
    expect(h.host.querySelector('#a')!.textContent).toContain('Enviada');
    expect(h.host.querySelector('#b')!.textContent).toContain('Envio parou');
    // linked com a reunião encerrada (live=false) = Enviada.
    expect(h.host.querySelector('#c')!.textContent).toContain('Enviada');
  });

  it('linked com a reunião ao vivo mostra "Enviando"', async () => {
    h.start(assoc('a', 'linked'));
    await h.render(<AssociationBadgeFor recordId="a" live />);
    expect(h.host.textContent).toContain('Enviando');
  });

  it('três selos montados juntos registram UMA assinatura de storage', async () => {
    h.start(assoc('a', 'ended-unsent'));
    const before = addListenerCalls();
    await h.render(
      <>
        <AssociationBadgeFor recordId="a" live={false} />
        <AssociationBadgeFor recordId="b" live={false} />
        <AssociationBadgeFor recordId="c" live={false} />
      </>,
    );
    expect(addListenerCalls() - before).toBe(1);
  });

  it('mudar a associação no storage atualiza o selo', async () => {
    h.start(assoc('a', 'ended-unsent'));
    await h.render(<AssociationBadgeFor recordId="a" live={false} />);
    expect(h.host.textContent).toContain('Sem cliente');
    await h.writeAssociation(assoc('a', 'sending'));
    expect(h.host.textContent).toContain('Enviando');
    await h.writeAssociation(null);
    expect(h.host.textContent).toBe('');
  });
});

function addListenerCalls(): number {
  return (globalThis.chrome.storage.onChanged.addListener as unknown as { mock: { calls: unknown[] } }).mock.calls
    .length;
}
