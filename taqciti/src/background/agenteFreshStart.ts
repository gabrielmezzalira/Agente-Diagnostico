/**
 * A volta à sala conta como reunião NOVA? (Fase 8, TAQ-02, decisão B4-b, DA-1 = reuniao-nova-de-verdade.)
 * Depois que a sessão do Agente foi encerrada, mandar a fala de quem voltou para ela seria gravar numa
 * sessão que nenhuma IA acompanha mais: a máquina da reunião abre uma reunião nova (`startFresh`), que
 * nasce com associação pendente. Um finish EM VOO conta como encerrada — não se espera por ele, para a
 * captura nunca atrasar.
 *
 * Só lê a associação quando a fase é `ended` e a sala é a mesma; nas demais detecções (a cada poll) devolve
 * falso sem tocar o storage (T-08-51). Quem chama é o `case 'meet/detected'` do `index.ts`.
 */
import type { MeetingAssociation } from '@/features/agente/association';
import { getAssociation } from '@/shared/config/agenteAssociationStore';
import type { MeetingState } from '@/shared/types/domain';
import { agenteSessionFinisher } from './agenteSessionFinisher';

export interface FreshStartDeps {
  getAssociation: (meetingId: string) => Promise<MeetingAssociation | null>;
  /** Há um encerramento da sessão em andamento para esta reunião? Memória pura. */
  isClosing: (meetingId: string) => boolean;
}

const DEFAULT_DEPS: FreshStartDeps = {
  getAssociation,
  isClosing: (meetingId) => agenteSessionFinisher.isClosing(meetingId),
};

export async function shouldStartFreshMeeting(
  state: MeetingState,
  meetingCode: string,
  deps: FreshStartDeps = DEFAULT_DEPS,
): Promise<boolean> {
  const session = state.session;
  if (state.phase !== 'ended' || session === null || session.meetingCode !== meetingCode) return false;
  if (deps.isClosing(session.meetingId)) return true;
  const association = await deps.getAssociation(session.meetingId);
  return association?.sessionFinished === true;
}
