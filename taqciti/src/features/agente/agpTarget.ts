/**
 * Para qual sessão do Agente o painel "AGP" deve olhar (Fase 10, TAQ-05, critério 3): SÓ a de uma reunião
 * ao vivo cujo vínculo é explícito (cliente escolhido no seletor, ou ID colado — Fase 8). Nunca adivinha nem
 * usa um padrão. Puro: o id da reunião ao vivo entra por parâmetro.
 */
import type { MeetingAssociation } from './association';

export interface AgpTarget {
  meetingId: string;
  sessionId: string;
}

/**
 * `liveMeetingId` = reunião ao vivo agora (ou `null`). Escolhe a associação dela quando: tem origem explícita,
 * `sessionId`, está `linked` (vínculo ao vivo concluído) e a sessão ainda não foi encerrada.
 */
export function selectAgpTarget(
  associations: Readonly<Record<string, MeetingAssociation>>,
  liveMeetingId: string | null,
): AgpTarget | null {
  if (liveMeetingId === null) return null;
  const association = associations[liveMeetingId];
  if (association === undefined) return null;
  if (association.origin === undefined || association.sessionId === undefined) return null;
  if (association.state !== 'linked' || association.sessionFinished === true) return null;
  return { meetingId: liveMeetingId, sessionId: association.sessionId };
}
