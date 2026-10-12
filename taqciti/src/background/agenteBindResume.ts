/**
 * Preparar o "Continuar envio" (Fase 8, TAQ-02, B3, UI-SPEC E7): valida se a reunião encerrada pode
 * retomar o envio em partes e, se puder, grava `send-resumed` e devolve de ONDE recomeçar. Separado de
 * `agenteBindFlow.ts` (SRP): aqui só se DECIDE e se prepara; quem envia é `runBindUpload`.
 *
 * Seguro porque a parte `n` tem sempre o mesmo `chunk_id` (`bulk:{reunião}:{índice}`) e o backend recusa
 * duplicata (B3): recomeçar da última parte confirmada não repete nada, e a parte que estava em voo na
 * falha também não duplica. Sessão já encerrada pela B4-b (DA-2): continua valendo — o backend grava no
 * banco sem olhar o status, então as falas restantes entram na transcrição.
 */
import { planMeetingUpload, type UploadPart } from '@/features/agente/meetingUploader';
import { applyAssociationEvent, getAssociation } from '@/shared/config/agenteAssociationStore';
import { isValidAgenteBackendUrl, type AgenteConfig } from '@/shared/config/agenteConfig';
import type { AgenteCommandResult } from '@/shared/types/agenteMessages';
import type { MeetingRecord } from '@/shared/types/domain';
import { bindFail } from './agenteBindTarget';

export interface ResumeDeps {
  getRecord: (meetingId: string) => Promise<MeetingRecord | null>;
  loadConfig: () => Promise<AgenteConfig>;
}

/** O que enviar e de onde: `startAt` é a posição (na lista de partes) da primeira parte ainda não confirmada. */
export interface ResumePlan {
  sessionId: string;
  parts: UploadPart[];
  startAt: number;
}

/**
 * `live`: a reunião está acontecendo agora (quem chama sabe pela máquina da reunião). Só `send-failed`
 * COM sessão e reunião não ao vivo retoma; qualquer outro caso é recusado sem mudar nada.
 */
export async function prepareResume(
  deps: ResumeDeps,
  meetingId: string,
  live: boolean,
): Promise<ResumePlan | { failure: AgenteCommandResult }> {
  const association = await getAssociation(meetingId);
  if (association === null) return { failure: bindFail('not-found') };
  const { sessionId } = association;
  if (association.state !== 'send-failed' || sessionId === undefined || live) {
    return { failure: bindFail('invalid-state') };
  }

  const record = await deps.getRecord(meetingId);
  if (record === null) return { failure: bindFail('not-found') };

  const config = await deps.loadConfig();
  if (!config.streamingEnabled || !isValidAgenteBackendUrl(config.agenteBackendUrl)) {
    return { failure: bindFail('unavailable') };
  }

  const resumed = await applyAssociationEvent(meetingId, { type: 'send-resumed' });
  if (!resumed.applied) return { failure: bindFail('invalid-state') };

  return {
    sessionId,
    parts: planMeetingUpload(meetingId, record.segments),
    startAt: association.sendProgress?.done ?? 0,
  };
}
