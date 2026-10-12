/**
 * Teste do contêiner ao vivo (Fase 8, plano 08-14, Task 2): cartão -> seletor -> barra durante a
 * reunião. Plataforma falsa + storage simulado (`agentePanelHarness`); o painel só lê o storage e
 * manda comandos, como em produção.
 */
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssociationState, MeetingAssociation } from '@/features/agente/association';
import { EMPTY_DELIVERY } from '@/shared/config/agenteDeliveryStore';
import type { PanelSize } from '@/shared/types/domain';
import { createAgenteHarness } from '@/test/agentePanelHarness';
import { AgenteLiveSlot } from './AgenteLiveSlot';

const MEETING = 'm1';
const VALID_UUID = '11111111-2222-4333-8444-555555555555';
const CLIENTS = [
  { id: 'c-acme', client: 'Acme', name: 'Pipeline' },
  { id: 'c-beta', client: 'Beta SA', name: 'Beta SA' },
];

function assoc(state: AssociationState, extra: Partial<MeetingAssociation> = {}): MeetingAssociation {
  return { meetingId: MEETING, state, ...extra };
}

interface SlotOptions {
  expanded?: boolean;
  panelSize?: PanelSize;
  onPanelSizeChange?: (size: PanelSize) => void;
  onToast?: (message: string) => void;
}

const h = createAgenteHarness();

function slot(options: SlotOptions = {}) {
  return (
    <AgenteLiveSlot
      meetingId={MEETING}
      expanded={options.expanded ?? true}
      panelSize={options.panelSize ?? 'regular'}
      onPanelSizeChange={options.onPanelSizeChange ?? (() => {})}
      onToast={options.onToast ?? (() => {})}
    />
  );
}

/** Responde `list` com os clientes e o resto com ok. */
function respondOk(): void {
  h.respondWith((command) =>
    command.type === 'ui/agente/clients/list' ? { ok: true, clients: CLIENTS } : { ok: true },
  );
}

function typeInto(input: HTMLInputElement, value: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  return act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

afterEach(async () => {
  await h.stop();
  h.sent.length = 0;
  h.respondWith(() => ({ ok: true }));
});

describe('AgenteLiveSlot — cartão e "Depois"', () => {
  beforeEach(() => h.start(assoc('choosing')));

  it('choosing mostra o cartão; "Depois" manda defer e, ao virar deferred, a barra "Sem cliente" aparece', async () => {
    await h.render(slot());
    expect(h.host.textContent).toContain('Esta reunião é de qual cliente?');

    await h.click(h.buttonByText('Depois'));
    expect(h.commandsOf('ui/agente/meeting/defer')).toEqual([
      { type: 'ui/agente/meeting/defer', meetingId: MEETING },
    ]);

    await h.writeAssociation(assoc('deferred'));
    expect(h.host.textContent).toContain('Sem cliente. A transcrição fica só aqui.');
    expect(h.host.textContent).not.toContain('Esta reunião é de qual cliente?');
  });

  it('o Esc dentro do cartão adia e não chega ao documento (não minimiza o painel)', async () => {
    const onDocumentKey = vi.fn();
    document.addEventListener('keydown', onDocumentKey);
    await h.render(slot());

    await act(async () => {
      h.host
        .querySelector('[aria-label="Esta reunião é de qual cliente?"]')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(h.commandsOf('ui/agente/meeting/defer')).toHaveLength(1);
    expect(onDocumentKey).not.toHaveBeenCalled();
    document.removeEventListener('keydown', onDocumentKey);
  });
});

describe('AgenteLiveSlot — seletor', () => {
  beforeEach(() => {
    h.start(assoc('choosing'));
    respondOk();
  });

  it('"Selecionar cliente agora" abre o seletor, pede a lista e, em painel compacto, sobe para regular uma vez', async () => {
    const onPanelSizeChange = vi.fn();
    await h.render(slot({ panelSize: 'compact', onPanelSizeChange }));

    await h.click(h.buttonByText('Selecionar cliente agora'));

    expect(h.host.textContent).toContain('Escolher cliente');
    expect(h.commandsOf('ui/agente/clients/list')).toHaveLength(1);
    expect(onPanelSizeChange).toHaveBeenCalledTimes(1);
    expect(onPanelSizeChange).toHaveBeenCalledWith('regular');
    expect(h.host.textContent).toContain('Acme');
  });

  it('painel regular não é redimensionado ao abrir o seletor', async () => {
    const onPanelSizeChange = vi.fn();
    await h.render(slot({ panelSize: 'regular', onPanelSizeChange }));
    await h.click(h.buttonByText('Selecionar cliente agora'));
    expect(onPanelSizeChange).not.toHaveBeenCalled();
  });

  it('confirmar o cliente manda UM bind { kind: "client" } mesmo com dois cliques', async () => {
    let finishBind: (value: unknown) => void = () => {};
    h.respondWith((command) => {
      if (command.type === 'ui/agente/clients/list') return { ok: true, clients: CLIENTS };
      if (command.type === 'ui/agente/meeting/bind') return new Promise((resolve) => (finishBind = resolve));
      return { ok: true };
    });
    await h.render(slot());
    await h.click(h.buttonByText('Selecionar cliente agora'));

    const acme = h.host.querySelector<HTMLLIElement>('ul[aria-label="Clientes"] > li')!;
    await h.click(acme.querySelector('button'));
    const confirm = h.buttonByText('Vincular reunião')!;
    await act(async () => {
      confirm.click();
      confirm.click();
    });

    const binds = h.commandsOf('ui/agente/meeting/bind');
    expect(binds).toEqual([
      {
        type: 'ui/agente/meeting/bind',
        meetingId: MEETING,
        target: { kind: 'client', clientId: 'c-acme', clientName: 'Acme' },
      },
    ]);
    await act(async () => finishBind({ ok: true }));
  });

  it('bind recusado com create-session mostra o erro no seletor e o mantém aberto', async () => {
    h.respondWith((command) => {
      if (command.type === 'ui/agente/clients/list') return { ok: true, clients: CLIENTS };
      if (command.type === 'ui/agente/meeting/bind') return { ok: false, error: 'create-session' };
      return { ok: true };
    });
    await h.render(slot());
    await h.click(h.buttonByText('Selecionar cliente agora'));
    await h.click(h.host.querySelector('ul[aria-label="Clientes"] > li button'));
    await h.click(h.buttonByText('Vincular reunião'));
    // O service worker volta a reunião para `deferred` ao falhar a criação da sessão.
    await h.writeAssociation(assoc('deferred', { error: 'create-session' }));

    expect(h.host.textContent).toContain('Escolher cliente');
    expect(h.host.textContent).toContain('Não foi possível criar a sessão no Agente.');
  });

  it('lista indisponível cai no plano B; "Vincular com este ID" manda bind { kind: "manual" }', async () => {
    h.respondWith((command) =>
      command.type === 'ui/agente/clients/list' ? { ok: false, error: 'unavailable' } : { ok: true },
    );
    await h.render(slot());
    await h.click(h.buttonByText('Selecionar cliente agora'));
    expect(h.host.textContent).toContain('Não consegui carregar os clientes.');

    await typeInto(h.host.querySelector<HTMLInputElement>('#client-picker-manual-id')!, VALID_UUID);
    await h.click(h.buttonByText('Vincular com este ID'));

    expect(h.commandsOf('ui/agente/meeting/bind')).toEqual([
      {
        type: 'ui/agente/meeting/bind',
        meetingId: MEETING,
        target: { kind: 'manual', sessionId: VALID_UUID },
      },
    ]);
  });

  it('o erro do vínculo por ID manual também aparece no plano B, sem perder o campo', async () => {
    h.respondWith((command) => {
      if (command.type === 'ui/agente/clients/list') return { ok: false, error: 'unavailable' };
      if (command.type === 'ui/agente/meeting/bind') return { ok: false, error: 'unavailable' };
      return { ok: true };
    });
    await h.render(slot());
    await h.click(h.buttonByText('Selecionar cliente agora'));
    await typeInto(h.host.querySelector<HTMLInputElement>('#client-picker-manual-id')!, VALID_UUID);
    await h.click(h.buttonByText('Vincular com este ID'));

    expect(h.host.textContent).toContain('Não foi possível criar a sessão no Agente.');
    expect(h.host.querySelector<HTMLInputElement>('#client-picker-manual-id')!.value).toBe(VALID_UUID);
  });

  it('"Tentar de novo" pede a lista outra vez', async () => {
    h.respondWith(() => ({ ok: false, error: 'unavailable' }));
    await h.render(slot());
    await h.click(h.buttonByText('Selecionar cliente agora'));
    await h.click(h.buttonByText('Tentar de novo'));
    expect(h.commandsOf('ui/agente/clients/list')).toHaveLength(2);
  });

  it('"Voltar" do seletor numa reunião ao vivo manda defer', async () => {
    await h.render(slot());
    await h.click(h.buttonByText('Selecionar cliente agora'));
    await h.click(h.buttonByText('Voltar'));
    expect(h.commandsOf('ui/agente/meeting/defer')).toHaveLength(1);
  });
});

describe('AgenteLiveSlot — barra e deferred', () => {
  it('"Selecionar cliente" da barra manda open e já abre o seletor', async () => {
    h.start(assoc('deferred'));
    respondOk();
    await h.render(slot());

    await h.click(h.buttonByText('Selecionar cliente'));

    expect(h.commandsOf('ui/agente/meeting/open')).toHaveLength(1);
    expect(h.host.textContent).toContain('Escolher cliente');
  });

  it('vinculada e saudável: "Enviando ao vivo para {cliente}"', async () => {
    h.start(assoc('linked', { clientName: 'Empresa X' }), EMPTY_DELIVERY);
    await h.render(slot());
    expect(h.host.textContent).toContain('Enviando ao vivo para');
    expect(h.host.textContent).toContain('Empresa X');
  });

  it('vinculando: progresso "Enviando o que já foi falado…"', async () => {
    h.start(assoc('linking', { clientName: 'Empresa X', sendProgress: { done: 3, total: 12 } }));
    await h.render(slot());
    expect(h.host.textContent).toContain('Enviando o que já foi falado…');
  });

  it('sala retomada: ended-unsent ao vivo mostra "Sem cliente"; sending mostra o progresso', async () => {
    h.start(assoc('ended-unsent'));
    await h.render(slot());
    expect(h.host.textContent).toContain('Sem cliente. A transcrição fica só aqui.');

    await h.writeAssociation(assoc('sending', { clientName: 'Empresa X', sendProgress: { done: 5, total: 40 } }));
    expect(h.host.textContent).toContain('Enviando o que já foi falado…');
  });

  it('pending e sem associação não desenham nada (a bolha é do AgenteNudgeAnchor)', async () => {
    h.start(assoc('pending'));
    await h.render(slot());
    expect(h.host.textContent).toBe('');

    await h.writeAssociation(null);
    expect(h.host.textContent).toBe('');
  });
});

describe('AgenteLiveSlot — Agente fora do ar e volta', () => {
  it('entrega offline mostra o aviso com a contagem; ao voltar, o toast sai uma vez', async () => {
    h.start(assoc('linked', { clientName: 'Empresa X' }), { ...EMPTY_DELIVERY, status: 'offline', queued: 4 });
    const onToast = vi.fn();
    await h.render(slot({ onToast }));

    expect(h.host.textContent).toContain('O Agente está fora do ar.');
    expect(h.host.textContent).toContain('4 falas na fila');
    expect(onToast).not.toHaveBeenCalled();

    await h.writeDelivery({ ...EMPTY_DELIVERY, recoveredAt: 1700000000000 });
    expect(onToast).toHaveBeenCalledTimes(1);
    expect(onToast).toHaveBeenCalledWith('Agente de volta. Falas reenviadas.');
    expect(h.host.textContent).toContain('Enviando ao vivo para');

    // Um novo render com o mesmo status não repete o toast.
    await h.render(slot({ onToast }));
    expect(onToast).toHaveBeenCalledTimes(1);
  });
});

describe('AgenteLiveSlot — minimizar o painel', () => {
  it('expanded true -> false com o cartão aberto (choosing) manda defer uma vez', async () => {
    h.start(assoc('choosing'));
    await h.render(slot({ expanded: true }));
    expect(h.commandsOf('ui/agente/meeting/defer')).toHaveLength(0);

    await h.render(slot({ expanded: false }));
    expect(h.commandsOf('ui/agente/meeting/defer')).toHaveLength(1);

    await h.render(slot({ expanded: false }));
    expect(h.commandsOf('ui/agente/meeting/defer')).toHaveLength(1);
  });

  it('minimizar com a reunião já adiada (deferred) não manda nada', async () => {
    h.start(assoc('deferred'));
    await h.render(slot({ expanded: true }));
    await h.render(slot({ expanded: false }));
    expect(h.sent).toHaveLength(0);
  });

  it('expanded false -> true com pending manda open uma vez (a cápsula abre o painel já com o cartão)', async () => {
    h.start(assoc('pending'));
    await h.render(slot({ expanded: false }));
    expect(h.commandsOf('ui/agente/meeting/open')).toHaveLength(0);

    await h.render(slot({ expanded: true }));
    expect(h.commandsOf('ui/agente/meeting/open')).toEqual([
      { type: 'ui/agente/meeting/open', meetingId: MEETING },
    ]);

    // O service worker grava choosing: o cartão aparece e nada é reenviado.
    await h.writeAssociation(assoc('choosing'));
    expect(h.host.textContent).toContain('Esta reunião é de qual cliente?');
    expect(h.commandsOf('ui/agente/meeting/open')).toHaveLength(1);
  });
});

describe('AgenteLiveSlot — sem associação', () => {
  it('envio desligado (sem associação): não renderiza nada nem manda comando', async () => {
    h.start(null);
    await h.render(slot());
    expect(h.host.textContent).toBe('');
    expect(h.sent).toHaveLength(0);
  });
});
