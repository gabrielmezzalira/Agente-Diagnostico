/**
 * Teste do contêiner do fim da reunião (Fase 8, plano 08-17, Task 2): cartão/botão -> seletor
 * (modo encerrada) -> envio com progresso -> enviada, e o descarte só com confirmação (D-09, D-10, D-11).
 * Plataforma falsa + storage simulado (`agentePanelHarness`), como em produção.
 */
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AssociationState, MeetingAssociation } from '@/features/agente/association';
import { createAgenteHarness } from '@/test/agentePanelHarness';
import { AgenteEndSlot } from './AgenteEndSlot';

const MEETING = 'm1';
const TITLE = 'Reunião com a Acme';
const CLIENTS = [
  { id: 'c-acme', client: 'Acme', name: 'Pipeline' },
  { id: 'c-beta', client: 'Beta SA', name: 'Beta SA' },
];

function assoc(state: AssociationState, extra: Partial<MeetingAssociation> = {}): MeetingAssociation {
  return { meetingId: MEETING, state, ...extra };
}

const h = createAgenteHarness();

function slot(
  variant: 'card' | 'button' = 'card',
  surface: 'panel' | 'wide' = 'panel',
  onDiscarded?: () => void,
) {
  return (
    <AgenteEndSlot
      meetingId={MEETING}
      title={TITLE}
      variant={variant}
      surface={surface}
      onDiscarded={onDiscarded}
    />
  );
}

function respondOk(): void {
  h.respondWith((command) =>
    command.type === 'ui/agente/clients/list' ? { ok: true, clients: CLIENTS } : { ok: true },
  );
}

async function pickAcme(): Promise<void> {
  await h.click(h.host.querySelector('ul[aria-label="Clientes"] > li button'));
}

afterEach(async () => {
  await h.stop();
  h.sent.length = 0;
  h.respondWith(() => ({ ok: true }));
});

describe('AgenteEndSlot — cartão, seletor e envio', () => {
  it('ended-unsent: cartão -> "Selecionar cliente" abre o seletor encerrado e pede a lista', async () => {
    h.start(assoc('ended-unsent'));
    respondOk();
    await h.render(slot());
    expect(h.host.textContent).toContain('Enviar esta reunião ao Agente?');

    await h.click(h.buttonByText('Selecionar cliente'));

    expect(h.host.textContent).toContain('Escolher cliente');
    expect(h.buttonByText('Enviar reunião')).toBeDefined();
    expect(h.commandsOf('ui/agente/clients/list')).toHaveLength(1);
  });

  it('confirmar o cliente manda UM bind; depois vem o progresso "3 de 30" e "Reunião enviada para {cliente}."', async () => {
    h.start(assoc('ended-unsent'));
    respondOk();
    await h.render(slot());
    await h.click(h.buttonByText('Selecionar cliente'));
    await pickAcme();
    const confirm = h.buttonByText('Enviar reunião')!;
    await act(async () => {
      confirm.click();
      confirm.click();
    });

    expect(h.commandsOf('ui/agente/meeting/bind')).toEqual([
      {
        type: 'ui/agente/meeting/bind',
        meetingId: MEETING,
        target: { kind: 'client', clientId: 'c-acme', clientName: 'Acme' },
      },
    ]);

    await h.writeAssociation(assoc('sending', { clientName: 'Acme', sendProgress: { done: 3, total: 30 } }));
    expect(h.host.textContent).toContain('Enviando para');
    expect(h.host.textContent).toContain('Acme');
    expect(h.host.textContent).toContain('3 de 30');
    expect(h.host.textContent).not.toContain('Escolher cliente');

    await h.writeAssociation(assoc('sent', { clientName: 'Acme' }));
    expect(h.host.textContent).toContain('Reunião enviada para');
    expect(h.host.textContent).toContain('Acme');
  });

  it('bind recusado mostra o erro no seletor e o mantém aberto', async () => {
    h.start(assoc('ended-unsent'));
    h.respondWith((command) => {
      if (command.type === 'ui/agente/clients/list') return { ok: true, clients: CLIENTS };
      if (command.type === 'ui/agente/meeting/bind') return { ok: false, error: 'create-session' };
      return { ok: true };
    });
    await h.render(slot());
    await h.click(h.buttonByText('Selecionar cliente'));
    await pickAcme();
    await h.click(h.buttonByText('Enviar reunião'));

    expect(h.host.textContent).toContain('Escolher cliente');
    expect(h.host.textContent).toContain('Não foi possível criar a sessão no Agente.');
  });

  it('"Voltar" do seletor fecha sem mandar nada além da lista', async () => {
    h.start(assoc('ended-unsent'));
    respondOk();
    await h.render(slot());
    await h.click(h.buttonByText('Selecionar cliente'));
    await h.click(h.buttonByText('Voltar'));
    expect(h.host.textContent).toContain('Enviar esta reunião ao Agente?');
    expect(h.sent.map((command) => command.type)).toEqual(['ui/agente/clients/list']);
  });

  it('saída larga: o seletor aberto é renderizado dentro de um AppShell', async () => {
    h.start(assoc('ended-unsent'));
    respondOk();
    await h.render(slot('button', 'wide'));
    await h.click(h.buttonByText('Enviar ao Agente'));

    const shell = h.host.querySelector('.fixed [style*="grid-template-rows"]');
    expect(shell).not.toBeNull();
    expect(shell!.textContent).toContain('Escolher cliente');
  });
});

describe('AgenteEndSlot — descarte confirmado (D-11)', () => {
  it('"Descartar" abre o modal com as cópias do contrato; "Manter reunião" fecha sem mandar comando', async () => {
    h.start(assoc('ended-unsent'));
    await h.render(slot());

    await h.click(h.buttonByText('Descartar'));
    const dialog = h.host.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-label')).toBe('Descartar esta reunião?');
    expect(dialog.textContent).toContain(`“${TITLE}” será removida do histórico da Taqciti`);
    expect(dialog.textContent).toContain('Nada foi enviado ao Agente, então não há como recuperar.');

    await h.click(h.buttonByText('Manter reunião'));
    expect(h.host.querySelector('[role="dialog"]')).toBeNull();
    expect(h.commandsOf('ui/agente/meeting/discard')).toHaveLength(0);
  });

  it('o Esc no modal cancela e não manda comando', async () => {
    h.start(assoc('ended-unsent'));
    await h.render(slot());
    await h.click(h.buttonByText('Descartar'));
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(h.host.querySelector('[role="dialog"]')).toBeNull();
    expect(h.commandsOf('ui/agente/meeting/discard')).toHaveLength(0);
  });

  it('confirmar manda ui/agente/meeting/discard uma vez e avisa quem hospeda a tela', async () => {
    h.start(assoc('ended-unsent'));
    const onDiscarded = vi.fn();
    await h.render(slot('card', 'panel', onDiscarded));
    await h.click(h.buttonByText('Descartar'));

    const dialog = h.host.querySelector('[role="dialog"]')!;
    const confirm = Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === 'Descartar')!;
    await h.click(confirm);

    expect(h.commandsOf('ui/agente/meeting/discard')).toEqual([
      { type: 'ui/agente/meeting/discard', meetingId: MEETING },
    ]);
    expect(onDiscarded).toHaveBeenCalledTimes(1);
  });

  it('comando de descarte recusado não avisa o hospedeiro', async () => {
    h.start(assoc('ended-unsent'));
    h.respondWith(() => ({ ok: false, error: 'invalid-state' }));
    const onDiscarded = vi.fn();
    await h.render(slot('card', 'panel', onDiscarded));
    await h.click(h.buttonByText('Descartar'));
    const dialog = h.host.querySelector('[role="dialog"]')!;
    await h.click(Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === 'Descartar'));
    expect(onDiscarded).not.toHaveBeenCalled();
  });
});

describe('AgenteEndSlot — variante botão e demais estados', () => {
  it('button + ended-unsent: botão "Enviar ao Agente" que abre o seletor, sem "Descartar"', async () => {
    h.start(assoc('ended-unsent'));
    respondOk();
    await h.render(slot('button'));
    expect(h.buttonByText('Descartar')).toBeUndefined();

    await h.click(h.buttonByText('Enviar ao Agente'));
    expect(h.host.textContent).toContain('Escolher cliente');
  });

  it('send-failed: mostra a falha e o apoio, sem "Enviar ao Agente" nem "Continuar envio"', async () => {
    h.start(assoc('send-failed', { sendProgress: { done: 7, total: 30 } }));
    await h.render(slot('button'));
    expect(h.host.textContent).toContain('O envio parou na parte 7 de 30.');
    expect(h.buttonByText('Enviar ao Agente')).toBeUndefined();
    expect(h.host.textContent).not.toContain('Continuar envio');
  });

  it('linked (reunião encerrada): só a linha "Enviada para {cliente}"', async () => {
    h.start(assoc('linked', { clientName: 'Acme' }));
    await h.render(slot('card'));
    expect(h.host.textContent).toContain('Enviada para');
    expect(h.host.textContent).toContain('Acme');
    expect(h.host.querySelector('button')).toBeNull();
  });

  it('sem associação: nada é desenhado nem enviado', async () => {
    h.start(null);
    await h.render(slot());
    expect(h.host.textContent).toBe('');
    expect(h.sent).toHaveLength(0);
  });
});
