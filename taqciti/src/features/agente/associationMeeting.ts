/**
 * As transições da associação que dependem do ciclo da REUNIÃO (Fase 8, TAQ-02, D-12): o fim e a volta
 * à mesma sala. Parte do reducer de `association.ts`, separada só para os arquivos ficarem abaixo de
 * 200 linhas; a API pública continua sendo `reduceAssociation`. Puro, sem `chrome`, `fetch` nem relógio.
 *
 * Importa de `association.ts` apenas TIPOS (nenhuma importação circular de valor).
 */
import type { AssociationState, MeetingAssociation } from './association';

/** Estados em que ainda não há destino: sem fala não há o que enviar nem descartar. */
export const BEFORE_LINK: readonly AssociationState[] = ['pending', 'choosing', 'deferred'];

/**
 * O fim da reunião: quem ainda não escolheu vira `ended-unsent` (o erro, se houver, fica). `linking`
 * não muda — o vínculo em andamento continua e o fluxo dele (08-10) resolve o fim. O resto já tem destino.
 */
export function reduceMeetingEnded(current: MeetingAssociation): MeetingAssociation {
  return BEFORE_LINK.includes(current.state) ? { ...current, state: 'ended-unsent' } : current;
}

/**
 * A mesma sala voltou: `ended-unsent` -> `pending` (a bolha reaparece), `sending` -> `linking` (o envio
 * em partes vira vínculo ao vivo), `sent` -> `linked` e a fala nova segue para a sessão já escolhida — só
 * quando a associação TEM `sessionId`. `send-failed` fica parado (a barra mostra o aviso).
 */
export function reduceMeetingResumed(current: MeetingAssociation): MeetingAssociation {
  switch (current.state) {
    case 'ended-unsent':
      return { meetingId: current.meetingId, state: 'pending' };
    case 'sending':
      return { ...current, state: 'linking' };
    case 'sent':
      return current.sessionId === undefined ? current : { ...current, state: 'linked' };
    default:
      return current;
  }
}
