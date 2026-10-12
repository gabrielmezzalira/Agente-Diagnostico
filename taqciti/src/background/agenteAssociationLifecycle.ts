/**
 * Quem move a associação (reunião -> sessão do Agente) conforme a reunião anda (Fase 8, TAQ-02,
 * D-04/D-06/D-09/D-12). O reducer de `features/agente/association.ts` decide cada transição; este módulo
 * só dispara os eventos certos a partir da máquina da reunião:
 *   - reunião detectada com o envio ligado  -> `created` (a associação nasce `pending`, uma vez só);
 *   - reunião terminou ou foi preemptada    -> `meeting-ended` (ou a associação some, se não houve fala);
 *   - a MESMA sala voltou na janela de retomada -> `meeting-resumed` (a retomada da mesma sala só vale
 *     enquanto a sessão do Agente NÃO foi encerrada: depois disso a máquina já abre uma reunião nova, e
 *     por defesa o reducer devolve a associação encerrada a `pending`).
 * No boot do service worker, `recoverAssociationsAfterRestart` garante que nenhuma associação fique presa.
 *
 * Quem chama (`sessionController`) dispara isto sem esperar: o ciclo de vida nunca atrasa nem derruba a
 * gravação da reunião.
 */
import type { MeetingState } from '@/shared/types/domain';
import { createAgenteConfigReader } from '@/shared/config/agenteConfigStore';
import {
  applyAssociationEvent,
  getAssociation,
  loadAssociations,
  removeAssociation,
} from '@/shared/config/agenteAssociationStore';
import type {
  AssociationEvent,
  AssociationState,
  MeetingAssociation,
} from '@/features/agente/association';
import { logger } from '@/shared/services/log';

/** Leitor próprio e preguiçoso: só toca o storage na primeira chamada e depois segue o `onChanged`. */
const readConfig = createAgenteConfigReader();

/** Estados em que ainda não há destino: sem fala não há o que enviar nem descartar. */
const BEFORE_LINK: readonly AssociationState[] = ['pending', 'choosing', 'deferred'];

export function isLivePhase(state: MeetingState): boolean {
  return state.phase === 'captionsRequired' || state.phase === 'recording' || state.phase === 'paused';
}

/** Reunião que acabou de terminar, ou que foi preemptada por outra sala (a antiga sai de cena). */
async function closeFinishedMeeting(prev: MeetingState, next: MeetingState): Promise<void> {
  const previous = prev.session;
  if (previous === null || prev.phase === 'ended') return;
  const finished = next.phase === 'ended' && next.session?.meetingId === previous.meetingId;
  const preempted = next.session?.meetingId !== previous.meetingId;
  if (!finished && !preempted) return;

  const association = await getAssociation(previous.meetingId);
  if (association === null) return;
  if (previous.segments.length === 0 && BEFORE_LINK.includes(association.state)) {
    await removeAssociation(previous.meetingId);
    return;
  }
  await applyAssociationEvent(previous.meetingId, { type: 'meeting-ended' });
}

/** Mesma sala retomada logo depois de encerrar: devolve a associação a um estado ao vivo. */
async function resumeMeeting(prev: MeetingState, next: MeetingState): Promise<void> {
  const meetingId = next.session?.meetingId;
  if (prev.phase !== 'ended' || !isLivePhase(next) || meetingId === undefined) return;
  if (prev.session?.meetingId !== meetingId) return;
  if ((await getAssociation(meetingId)) === null) return;
  await applyAssociationEvent(meetingId, { type: 'meeting-resumed' });
}

/** Reunião ao vivo, envio ligado e ainda sem associação: nasce `pending` (idempotente). */
async function createForLiveMeeting(next: MeetingState): Promise<void> {
  const meetingId = next.session?.meetingId;
  if (meetingId === undefined || !isLivePhase(next)) return;
  if (!(await readConfig()).streamingEnabled) return;
  if ((await getAssociation(meetingId)) !== null) return;
  await applyAssociationEvent(meetingId, { type: 'created' });
}

/** Chamado depois de cada transição da máquina: `prev` é o estado de antes e `next` o de depois. */
export async function syncAssociationLifecycle(prev: MeetingState, next: MeetingState): Promise<void> {
  await resumeMeeting(prev, next);
  await closeFinishedMeeting(prev, next);
  await createForLiveMeeting(next);
}

/**
 * O que tirar de uma associação que o service worker encontrou ao acordar. `live` = é a reunião que está
 * ao vivo agora. Cada resultado é um estado com tela e com saída; `linked`, `sent` e `send-failed` de
 * reunião que não está ao vivo já têm onde ser tratados e ficam como estão (inclusive os encerrados).
 */
function recoveryEvents(association: MeetingAssociation, live: boolean): AssociationEvent[] {
  const events = stateRecoveryEvents(association, live);
  // Encerrada ou com prazo de encerramento pendurado numa reunião que está ao vivo: o reducer decide
  // (encerrada -> pending, só prazo -> prazo cancelado); a que não está ao vivo não muda.
  const hasCloseMarks =
    association.sessionFinished === true ||
    association.finishBy !== undefined ||
    association.finishTries !== undefined ||
    association.finishGaveUp !== undefined;
  const alreadyResumed = events.some((event) => event.type === 'meeting-resumed');
  return live && hasCloseMarks && !alreadyResumed ? [...events, { type: 'meeting-resumed' }] : events;
}

function stateRecoveryEvents(association: MeetingAssociation, live: boolean): AssociationEvent[] {
  const ended: AssociationEvent[] = live ? [] : [{ type: 'meeting-ended' }];
  const resumed: AssociationEvent[] = live ? [{ type: 'meeting-resumed' }] : [];
  const hasSession = association.sessionId !== undefined;
  switch (association.state) {
    case 'linking':
      return hasSession
        ? [{ type: 'link-failed', error: 'send' }]
        : [{ type: 'link-failed', error: 'create-session' }, ...ended];
    case 'sending':
      return hasSession
        ? [{ type: 'send-failed', error: 'send' }]
        : [{ type: 'send-failed', error: 'create-session' }, ...resumed];
    case 'pending':
    case 'choosing':
    case 'deferred':
      return ended;
    case 'ended-unsent':
    case 'sent':
      return resumed;
    default:
      return [];
  }
}

/**
 * No boot do service worker: nenhuma associação fica presa. Recebe o estado reidratado da reunião e nunca
 * mexe nela — só nas associações. Falha numa associação vai para o log e não impede as outras, nem a
 * cadeia de inicialização do service worker.
 */
export async function recoverAssociationsAfterRestart(state: MeetingState): Promise<void> {
  const liveId = isLivePhase(state) ? state.session?.meetingId : undefined;
  const associations = await loadAssociations().then(Object.values, (error: unknown) => {
    logger.error('leitura das associações do Agente falhou', error);
    return [] as MeetingAssociation[];
  });
  for (const association of associations) {
    try {
      for (const event of recoveryEvents(association, association.meetingId === liveId)) {
        await applyAssociationEvent(association.meetingId, event);
      }
    } catch (error) {
      logger.error('recuperação da associação do Agente falhou', error);
    }
  }
}
