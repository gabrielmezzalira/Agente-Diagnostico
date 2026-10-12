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
}

export type AssociationEvent =
  | { type: 'created' }
  | { type: 'link-started'; origin: AssociationOrigin; clientName: string; sessionId?: string }
  | { type: 'session-created'; sessionId: string }
  | { type: 'link-completed'; seedSent: SeedSent }
  | { type: 'seed-consumed' };

/** Campos que sobrevivem entre estados: o "quem" do vínculo, sem erro, progresso nem semente. */
function identity(current: MeetingAssociation): Omit<MeetingAssociation, 'state'> {
  const { meetingId, clientName, sessionId, origin } = current;
  return {
    meetingId,
    ...(clientName !== undefined && { clientName }),
    ...(sessionId !== undefined && { sessionId }),
    ...(origin !== undefined && { origin }),
  };
}

const CAN_START_LINK: readonly AssociationState[] = ['pending', 'choosing', 'deferred'];

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
    case 'link-started':
      if (!CAN_START_LINK.includes(current.state)) return current;
      return {
        meetingId: current.meetingId,
        state: 'linking',
        clientName: event.clientName,
        origin: event.origin,
        ...(event.sessionId !== undefined && { sessionId: event.sessionId }),
      };
    case 'session-created':
      if (current.state !== 'linking') return current;
      return { ...current, sessionId: event.sessionId };
    case 'link-completed':
      if (current.state !== 'linking' || current.sessionId === undefined) return current;
      return { ...identity(current), state: 'linked', seedSent: event.seedSent };
    case 'seed-consumed':
      if (current.state !== 'linked' || current.seedSent === undefined) return current;
      return { ...identity(current), state: 'linked' };
    default:
      return current;
  }
}
