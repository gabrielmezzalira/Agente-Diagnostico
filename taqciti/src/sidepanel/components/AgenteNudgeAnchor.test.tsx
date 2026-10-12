/**
 * Teste da ancoragem da bolha "!" (Fase 8, plano 08-14, Task 3): só aparece com a reunião `pending`;
 * no cabeçalho é um botão que abre o cartão (comando `open`), na cápsula é só enfeite. Mesmo
 * harness do `AgenteLiveSlot.test.tsx` (plataforma falsa + storage simulado).
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { AssociationState, MeetingAssociation } from '@/features/agente/association';
import { createAgenteHarness } from '@/test/agentePanelHarness';
import { AgenteNudgeAnchor } from './AgenteNudgeAnchor';

const MEETING = 'm1';
const NAME = 'Reunião detectada. Escolher o cliente no Agente.';

function assoc(state: AssociationState): MeetingAssociation {
  return { meetingId: MEETING, state };
}

const h = createAgenteHarness();

afterEach(async () => {
  await h.stop();
  h.sent.length = 0;
});

describe('AgenteNudgeAnchor — cabeçalho', () => {
  it('pending: botão da bolha com animate-nudge; clicar manda UM open com o meetingId', async () => {
    h.start(assoc('pending'));
    await h.render(<AgenteNudgeAnchor meetingId={MEETING} anchor="header" />);

    const button = h.host.querySelector<HTMLButtonElement>(`button[aria-label="${NAME}"]`);
    expect(button).not.toBeNull();
    expect(button!.querySelector('.animate-nudge')).not.toBeNull();

    await h.click(button);
    expect(h.sent).toEqual([{ type: 'ui/agente/meeting/open', meetingId: MEETING }]);
  });

  it('a bolha some quando o estado deixa de ser pending', async () => {
    h.start(assoc('pending'));
    await h.render(<AgenteNudgeAnchor meetingId={MEETING} anchor="header" />);
    expect(h.host.querySelector('button')).not.toBeNull();

    await h.writeAssociation(assoc('choosing'));
    expect(h.host.querySelector('button')).toBeNull();
  });
});

describe('AgenteNudgeAnchor — cápsula', () => {
  it('pending: só o círculo decorativo (aria-hidden, sem botão); nenhum comando ao montar', async () => {
    h.start(assoc('pending'));
    await h.render(<AgenteNudgeAnchor meetingId={MEETING} anchor="capsule" />);

    expect(h.host.querySelector('button')).toBeNull();
    const bubble = h.host.querySelector('[aria-hidden="true"]');
    expect(bubble).not.toBeNull();
    expect(bubble!.className).toContain('pointer-events-none');
    expect(bubble!.className).toContain('animate-nudge');
    expect(h.sent).toHaveLength(0);
  });
});

describe('AgenteNudgeAnchor — sem bolha', () => {
  it.each<AssociationState>(['choosing', 'deferred', 'linked'])('%s não mostra bolha em nenhuma ancoragem', async (state) => {
    h.start(assoc(state));
    await h.render(
      <>
        <AgenteNudgeAnchor meetingId={MEETING} anchor="header" />
        <AgenteNudgeAnchor meetingId={MEETING} anchor="capsule" />
      </>,
    );
    expect(h.host.innerHTML).toBe('');
  });

  it('meetingId null (nenhuma reunião) não mostra nada', async () => {
    h.start(assoc('pending'));
    await h.render(<AgenteNudgeAnchor meetingId={null} anchor="header" />);
    expect(h.host.innerHTML).toBe('');
  });

  it('sem associação (envio ao Agente desligado) não mostra nada', async () => {
    h.start(null);
    await h.render(<AgenteNudgeAnchor meetingId={MEETING} anchor="capsule" />);
    expect(h.host.innerHTML).toBe('');
  });
});
