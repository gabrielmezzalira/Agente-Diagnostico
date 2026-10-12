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

/** Estados em que a associação já tem uma sessão do Agente ligada (ou em vias de ser). */
const WITH_SESSION: readonly AssociationState[] = ['sending', 'linked', 'sent', 'send-failed'];

/** A volta cancela o prazo de encerramento: sem `finishBy`, `finishTries` e `finishGaveUp`; mesma referência se não havia. */
function dropFinishDeadline(current: MeetingAssociation): MeetingAssociation {
  if (current.finishBy === undefined && current.finishTries === undefined && current.finishGaveUp === undefined) {
    return current;
  }
  const next: MeetingAssociation = { ...current };
  delete next.finishBy;
  delete next.finishTries;
  delete next.finishGaveUp;
  return next;
}

/**
 * A mesma sala voltou. Com a sessão do Agente já ENCERRADA (`sessionFinished`, B4-b, DA-1) a volta é
 * reunião nova: devolve `pending` limpo, sem nenhum rastro da sessão fechada — nunca `linking` nem
 * `linked`. Sem isso: `ended-unsent` -> `pending` (a bolha reaparece), `sending` -> `linking` (o envio em
 * partes vira vínculo ao vivo), `sent` -> `linked` (só quando TEM `sessionId`), `linked`/`send-failed`
 * seguem como estão; nos que têm sessão a volta também cancela o prazo de encerramento.
 */
export function reduceMeetingResumed(current: MeetingAssociation): MeetingAssociation {
  if (current.sessionFinished === true && WITH_SESSION.includes(current.state)) {
    return { meetingId: current.meetingId, state: 'pending' };
  }
  switch (current.state) {
    case 'ended-unsent':
      return { meetingId: current.meetingId, state: 'pending' };
    case 'sending':
      return { ...dropFinishDeadline(current), state: 'linking' };
    case 'sent':
      return current.sessionId === undefined ? current : { ...dropFinishDeadline(current), state: 'linked' };
    case 'linked':
    case 'send-failed':
      return dropFinishDeadline(current);
    default:
      return current;
  }
}
