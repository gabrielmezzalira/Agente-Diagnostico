/**
 * Para qual sessão do Agente o painel "AGP" deve olhar (Fase 10, TAQ-05, critério 3): SÓ a de uma reunião
 * ao vivo cujo vínculo é explícito (cliente escolhido no seletor, ou ID colado — Fase 8). Nunca adivinha nem
 * usa um padrão. Puro: o id da reunião ao vivo entra por parâmetro.
 */
import type { MeetingPhase } from '@/shared/types/domain';
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

/**
 * O que o feed do painel AGP faz com a reunião de agora (D-11, WR-04): `follow` = abrir/manter o socket;
 * `hold` = vínculo explícito vivo, mas conexão fechada de propósito (as perguntas já recebidas ficam na tela);
 * `none` = nada a seguir (o feed limpa).
 */
export type AgpFollowDecision =
  | { kind: 'follow'; meetingId: string; sessionId: string }
  | { kind: 'hold'; meetingId: string; sessionId: string }
  | { kind: 'none' };

/** Fases em que a reunião ainda está "ao vivo" para o painel (mesma lista do ciclo de vida da associação). */
const LIVE_PHASES: readonly MeetingPhase[] = ['captionsRequired', 'recording', 'paused'];

/**
 * D-11: conectar no `/ws/{session_id}` cria o pipeline de IA do backend (laços de 15/30 s, gasto de Gemini), então
 * o socket só abre com a reunião GRAVANDO, vínculo explícito (`selectAgpTarget`) e o envio ao Agente ligado.
 * Em pausa, sem legendas ou com o envio desligado vira `hold`; fora das fases ao vivo ou sem vínculo, `none`.
 * Pura: a fase, a reunião e o liga/desliga entram por parâmetro.
 */
export function decideAgpFollow(
  associations: Readonly<Record<string, MeetingAssociation>>,
  meeting: { phase: MeetingPhase; meetingId: string | null },
  streamingEnabled: boolean,
): AgpFollowDecision {
  if (!LIVE_PHASES.includes(meeting.phase)) return { kind: 'none' };
  const target = selectAgpTarget(associations, meeting.meetingId);
  if (target === null) return { kind: 'none' };
  const follows = meeting.phase === 'recording' && streamingEnabled;
  return { kind: follows ? 'follow' : 'hold', ...target };
}
