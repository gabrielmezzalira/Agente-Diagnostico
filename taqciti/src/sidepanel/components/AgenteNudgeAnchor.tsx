/**
 * Liga a bolha "!" (D-07) ao estado da reunião: só existe enquanto a associação está `pending` — e a
 * associação só nasce com o envio ao Agente ligado (08-01), então quem não usa o Agente nunca a vê.
 *
 * Duas ancoragens, um componente de apresentação (`AgenteNudge`):
 *   - `header`: botão no cabeçalho do painel aberto; clicar manda `open` (o cartão aparece);
 *   - `capsule`: enfeite na cápsula minimizada, sem clique próprio — o clique é da cápsula, que abre o
 *     painel, e o `AgenteLiveSlot` manda `open` ao ver o painel abrir com a reunião `pending`.
 */
import { shouldBounce } from '@/features/agente/bindingView';
import { useMeetingAssociation } from '@/shared/hooks/useMeetingAssociation';
import { AgenteNudge } from './AgenteNudge';

interface AgenteNudgeAnchorProps {
  /** `null` = nenhuma reunião em andamento. */
  meetingId: string | null;
  anchor: 'capsule' | 'header';
}

export function AgenteNudgeAnchor({ meetingId, anchor }: AgenteNudgeAnchorProps) {
  const { association, open } = useMeetingAssociation(meetingId);
  if (!shouldBounce(association)) return null;

  return (
    <AgenteNudge
      anchor={anchor}
      bouncing
      {...(anchor === 'header' && { onActivate: () => void open() })}
    />
  );
}
