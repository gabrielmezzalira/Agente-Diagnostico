/**
 * Soltar a associação de uma reunião apagada do histórico (Fase 8, WR-02). Apagar a reunião não pode deixar a
 * sessão do Agente aberta para sempre (gastando IA): se a Taqciti ainda deve o encerramento (`isCloseOwed`), a
 * associação FICA — é dela que o agendador tira `sessionId`, `origin` e `finishBy` — e o agendador é chamado na
 * hora, sem esperar. Quando a sessão fecha, a composição do agendador recolhe a associação que sobrou.
 * Quem não deve mais nada sai junto com a reunião, como antes.
 */
import { isCloseOwed } from '@/features/agente/associationClose';
import { removeAssociation } from '@/shared/config/agenteAssociationStore';
import { logger } from '@/shared/services/log';
import { agenteSessionFinisher } from './agenteSessionFinisher';

export async function releaseMeetingAssociation(meetingId: string): Promise<void> {
  const kept = await removeAssociation(meetingId, isCloseOwed);
  if (kept.length === 0) return;
  void agenteSessionFinisher
    .evaluate(meetingId)
    .catch((error: unknown) => logger.error('encerrar a sessão da reunião apagada falhou', error));
}
