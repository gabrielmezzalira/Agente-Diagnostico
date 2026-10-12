/**
 * Transições do envio de uma reunião JÁ ENCERRADA (Fase 8, TAQ-02): `ended-unsent` -> `sending` ->
 * `sent`, ou `send-failed`/de volta a `ended-unsent`. Parte do reducer de `association.ts`, separada só
 * para os dois arquivos ficarem abaixo de 200 linhas; a API pública continua sendo `reduceAssociation`.
 * Puro, sem `chrome`, `fetch` nem relógio.
 */
import type { AssociationEvent, MeetingAssociation } from './association';

/** Campos que sobrevivem entre estados: o "quem" do vínculo, sem erro, progresso nem semente. */
export function carryIdentity(current: MeetingAssociation): Omit<MeetingAssociation, 'state'> {
  const { meetingId, clientName, sessionId, origin } = current;
  return {
    meetingId,
    ...(clientName !== undefined && { clientName }),
    ...(sessionId !== undefined && { sessionId }),
    ...(origin !== undefined && { origin }),
  };
}

/** Envio de uma reunião já encerrada ("Selecionar cliente" depois do fim): `ended-unsent` -> `sending` -> `sent`. */
export function reduceSendFlow(current: MeetingAssociation, event: AssociationEvent): MeetingAssociation {
  switch (event.type) {
    case 'send-started':
      if (current.state !== 'ended-unsent') return current;
      return {
        meetingId: current.meetingId,
        state: 'sending',
        clientName: event.clientName,
        origin: event.origin,
        ...(event.sessionId !== undefined && { sessionId: event.sessionId }),
      };
    case 'send-session-created':
      return current.state === 'sending' ? { ...current, sessionId: event.sessionId } : current;
    case 'send-progress':
      return current.state === 'sending'
        ? { ...current, sendProgress: { done: event.done, total: event.total } }
        : current;
    case 'send-completed':
      if (current.state !== 'sending' || current.sessionId === undefined) return current;
      return { ...carryIdentity(current), state: 'sent', seedSent: event.seedSent };
    case 'send-failed':
      if (current.state !== 'sending') return current;
      if (current.sessionId !== undefined) return { ...current, state: 'send-failed', error: event.error };
      return {
        meetingId: current.meetingId,
        state: 'ended-unsent',
        ...(current.clientName !== undefined && { clientName: current.clientName }),
        error: event.error,
      };
    default:
      return current;
  }
}
