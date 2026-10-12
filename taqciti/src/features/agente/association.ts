/**
 * O vínculo de UMA reunião com a sessão do Agente (Fase 8, TAQ-02, D-01/D-12) — regras puras, sem
 * `chrome`, `fetch` nem relógio. Cada reunião tem a sua associação; é ela (e só ela) que diz para
 * onde a fala vai. Enquanto a associação não estiver em `linked`, nada sai (modelo B, D-04).
 *
 * O reducer só DECIDE a transição; quem dispara cada evento é outro módulo (o fluxo de vínculo e a
 * máquina da reunião). Transição não permitida devolve a MESMA referência recebida — o padrão de
 * `features/meeting/machine.ts` — e quem grava só grava quando a referência muda.
 *
 * Nunca guarda segredo: a chave `x-agente-key` fica na config, jamais aqui.
 */

import { reduceCloseFlow } from './associationClose';
import { BEFORE_LINK, reduceMeetingEnded, reduceMeetingResumed } from './associationMeeting';
import { carryIdentity, reduceSendFlow } from './associationSend';

export type AssociationState =
  | 'pending'
  | 'choosing'
  | 'deferred'
  | 'linking'
  | 'linked'
  | 'ended-unsent'
  | 'sending'
  | 'sent'
  | 'send-failed';

export const ASSOCIATION_STATES: readonly AssociationState[] = [
  'pending',
  'choosing',
  'deferred',
  'linking',
  'linked',
  'ended-unsent',
  'sending',
  'sent',
  'send-failed',
];

/** De onde veio o vínculo: escolhido no seletor ou colado como ID ("Vincular com este ID"). */
export type AssociationOrigin = 'picker' | 'manual-id';
export const ASSOCIATION_ORIGINS: readonly AssociationOrigin[] = ['picker', 'manual-id'];

export type AssociationError = 'create-session' | 'send';
export const ASSOCIATION_ERRORS: readonly AssociationError[] = ['create-session', 'send'];

/** Palavras já enviadas por segmento (`${índice}:${captionId}` -> nº de palavras). `{}` = nada enviado ainda. */
export type SeedSent = Readonly<Record<string, number>>;

export interface MeetingAssociation {
  meetingId: string;
  state: AssociationState;
  clientName?: string;
  sessionId?: string;
  origin?: AssociationOrigin;
  sendProgress?: { done: number; total: number };
  /** Semente do vínculo: o que já saiu quando virou `linked`. Consumida (apagada) depois de adotada. */
  seedSent?: SeedSent;
  error?: AssociationError;
  /** A sessão do Agente já foi encerrada (B4-b). */
  sessionFinished?: true;
  /** Prazo (epoch ms) depois do qual a Taqciti encerra mesmo com o envio parado; só o PRIMEIRO vale. */
  finishBy?: number;
  /** Quantas tentativas de encerrar falharam. */
  finishTries?: number;
  /** A Taqciti desistiu de encerrar sozinha (tentativas esgotadas ou recusa definitiva). */
  finishGaveUp?: true;
}

export type AssociationEvent =
  | { type: 'created' }
  | { type: 'opened' }
  | { type: 'deferred' }
  | { type: 'link-started'; origin: AssociationOrigin; clientName: string; sessionId?: string }
  | { type: 'session-created'; sessionId: string }
  | { type: 'link-progress'; done: number; total: number }
  | { type: 'link-failed'; error: AssociationError }
  | { type: 'link-completed'; seedSent: SeedSent }
  | { type: 'seed-consumed' }
  /** A reunião terminou (disparado pela máquina da reunião; quem dispara é o plano 08-22). */
  | { type: 'meeting-ended' }
  /** A mesma sala voltou dentro da janela de retomada (REJOIN_RESUME_WINDOW_MS). */
  | { type: 'meeting-resumed' }
  | { type: 'send-started'; origin: AssociationOrigin; clientName: string; sessionId?: string }
  | { type: 'send-session-created'; sessionId: string }
  | { type: 'send-progress'; done: number; total: number }
  /** `seedSent` = o que o envio em partes cobriu, para a retomada da sala continuar sem repetir palavras. */
  | { type: 'send-completed'; seedSent: SeedSent }
  | { type: 'send-failed'; error: AssociationError }
  /** "Continuar envio" (08-20): `send-failed` com sessão volta a `sending` do ponto confirmado e cancela o prazo de encerramento. */
  | { type: 'send-resumed' }
  /** Encerramento da sessão (B4-b): encerrada, prazo armado e tentativa falha (plano 08-16; quem dispara é o 08-27). */
  | { type: 'session-finished' }
  | { type: 'finish-armed'; by: number }
  | { type: 'finish-failed'; definitive?: boolean }
  /** Abertura do navegador (DA-5): quem desistiu de encerrar ganha uma rodada nova; só o `runtime.onStartup` dispara. */
  | { type: 'finish-round-restarted' };

/**
 * Falha do vínculo ao vivo. Sem `sessionId` a sessão nem foi criada: volta para `deferred` (com erro
 * visível). Com `sessionId` a sessão existe e o resumo é que não saiu: fica parado em `send-failed`.
 */
function reduceLinkFailed(current: MeetingAssociation, error: AssociationError): MeetingAssociation {
  if (current.state !== 'linking') return current;
  if (error === 'create-session' && current.sessionId === undefined) {
    const { meetingId, clientName } = current;
    return { meetingId, state: 'deferred', ...(clientName !== undefined && { clientName }), error };
  }
  if (error === 'send' && current.sessionId !== undefined) return { ...current, state: 'send-failed', error };
  return current;
}

/**
 * `current` é a associação atual da reunião (`null` = ainda não existe). Devolve a próxima, ou a
 * mesma referência quando o evento não vale para o estado atual.
 */
export function reduceAssociation(
  current: MeetingAssociation | null,
  meetingId: string,
  event: AssociationEvent,
): MeetingAssociation | null {
  if (event.type === 'created') {
    return current === null ? { meetingId, state: 'pending' } : current;
  }
  if (current === null) return current;

  switch (event.type) {
    case 'opened':
      return current.state === 'pending' || current.state === 'deferred'
        ? { ...current, state: 'choosing' }
        : current;
    case 'deferred':
      return current.state === 'choosing' ? { ...current, state: 'deferred' } : current;
    case 'link-started':
      if (!BEFORE_LINK.includes(current.state)) return current;
      return {
        meetingId: current.meetingId,
        state: 'linking',
        clientName: event.clientName,
        origin: event.origin,
        ...(event.sessionId !== undefined && { sessionId: event.sessionId }),
      };
    case 'session-created':
      return current.state === 'linking' ? { ...current, sessionId: event.sessionId } : current;
    case 'link-progress':
      return current.state === 'linking'
        ? { ...current, sendProgress: { done: event.done, total: event.total } }
        : current;
    case 'link-failed':
      return reduceLinkFailed(current, event.error);
    case 'link-completed':
      if (current.state !== 'linking' || current.sessionId === undefined) return current;
      return { ...carryIdentity(current), state: 'linked', seedSent: event.seedSent };
    case 'seed-consumed':
      if (current.state !== 'linked' || current.seedSent === undefined) return current;
      return { ...carryIdentity(current), state: 'linked' };
    case 'meeting-ended':
      return reduceMeetingEnded(current);
    case 'meeting-resumed':
      return reduceMeetingResumed(current);
    case 'send-started':
    case 'send-session-created':
    case 'send-progress':
    case 'send-completed':
    case 'send-failed':
    case 'send-resumed':
      return reduceSendFlow(current, event);
    case 'session-finished':
    case 'finish-armed':
    case 'finish-failed':
    case 'finish-round-restarted':
      return reduceCloseFlow(current, event);
  }
}
