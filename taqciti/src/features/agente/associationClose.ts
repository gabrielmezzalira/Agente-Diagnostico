/**
 * O encerramento da sessão do Agente guardado na associação (Fase 8, decisão B4-b, plano 08-16):
 * quem a Taqciti pode encerrar sozinha e o que ela anota enquanto tenta. Parte do reducer de
 * `association.ts`, separada só para os arquivos ficarem abaixo de 200 linhas; a API pública continua
 * sendo `reduceAssociation`. Puro, sem `chrome`, `fetch` nem relógio — quem decide QUANDO encerrar é o
 * agendador (plano 08-27); aqui só ficam as regras de dados.
 */
import type { AssociationEvent, AssociationState, MeetingAssociation } from './association';
import { AGENTE_FINISH_MAX_TRIES } from './finishPolicy';

/** Estados em que a Taqciti ainda pode estar devendo o encerramento (a sessão existe e já foi vinculada). */
const CLOSABLE_STATES: readonly AssociationState[] = ['linked', 'sent', 'send-failed'];

/** O que ainda se pode encerrar: a sessão existe, não foi encerrada e a Taqciti não desistiu. */
function isOpenForClose(current: MeetingAssociation): boolean {
  return (
    current.sessionId !== undefined &&
    current.sessionFinished !== true &&
    current.finishGaveUp !== true &&
    CLOSABLE_STATES.includes(current.state)
  );
}

/**
 * Só a sessão que a PRÓPRIA Taqciti criou (origem `picker`) é encerrada por ela: a sessão do plano B
 * (ID colado) é de outra pessoa. Encerrada, desistida ou com as tentativas esgotadas não volta a ser
 * elegível — assim nenhuma avaliação nem a varredura do boot chama o finish de novo (T-08-49).
 */
export function isEligibleForClose(association: MeetingAssociation): boolean {
  return (
    association.origin === 'picker' &&
    isOpenForClose(association) &&
    (association.finishTries ?? 0) < AGENTE_FINISH_MAX_TRIES
  );
}

/** A sessão já foi encerrada: anota e esquece o prazo, as tentativas e a desistência. */
function markFinished(current: MeetingAssociation): MeetingAssociation {
  if (current.sessionId === undefined || current.sessionFinished === true) return current;
  const next: MeetingAssociation = { ...current, sessionFinished: true };
  delete next.finishBy;
  delete next.finishTries;
  delete next.finishGaveUp;
  return next;
}

/** Só o PRIMEIRO prazo vale: com `finishBy` gravado devolve a mesma referência (o store não regrava). */
function armFinish(current: MeetingAssociation, by: number): MeetingAssociation {
  if (!isOpenForClose(current) || current.finishBy !== undefined) return current;
  return { ...current, finishBy: by };
}

/** Uma tentativa de encerrar falhou; a 11ª falha, ou uma recusa definitiva, faz a Taqciti desistir. */
function recordFailure(current: MeetingAssociation, definitive: boolean): MeetingAssociation {
  if (!isOpenForClose(current)) return current;
  const finishTries = (current.finishTries ?? 0) + 1;
  const gaveUp = definitive || finishTries >= AGENTE_FINISH_MAX_TRIES;
  return { ...current, finishTries, ...(gaveUp && { finishGaveUp: true as const }) };
}

/** Eventos do encerramento, no mesmo desenho de `reduceSendFlow` (`associationSend.ts`). */
export function reduceCloseFlow(current: MeetingAssociation, event: AssociationEvent): MeetingAssociation {
  switch (event.type) {
    case 'session-finished':
      return markFinished(current);
    case 'finish-armed':
      return armFinish(current, event.by);
    case 'finish-failed':
      return recordFailure(current, event.definitive === true);
    default:
      return current;
  }
}
