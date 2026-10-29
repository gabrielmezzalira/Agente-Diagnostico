/**
 * As decisões do "segurar" do feed do painel AGP (Fase 10, D-11, WR-04): com a reunião em pausa, sem legendas ou
 * com o envio ao Agente desligado, a conexão fecha de propósito mas as perguntas já recebidas ficam na tela
 * (`paused`); ao voltar a gravar, o feed reconecta com a lista mantida até o `initial_state` substituí-la.
 *
 * Existe como módulo à parte porque o CLAUDE.md manda dividir arquivo acima de 200 linhas: o `agpQuestionsFeed.ts`
 * só EXECUTA o passo daqui. Puro — só dados entram e saem: nenhuma API do navegador, nenhum socket, nenhum relógio.
 */
import type { AgpQuestion } from '@/features/agente/agpQuestions';

/** A seleção "segurar": vínculo explícito vivo, conexão fechada de propósito (D-11). */
export interface AgpFeedHold {
  kind: 'hold';
  sessionId: string;
}

/** O que o feed lembra de uma sessão cuja conexão fechou de propósito. */
export interface AgpHeldSession {
  readonly sessionId: string;
  readonly questions: readonly AgpQuestion[];
}

/** Passo do hold: nada a fazer (já segurando) ou pausar guardando a sessão devolvida. */
export type AgpHoldStep = { kind: 'none' } | { kind: 'pause'; held: AgpHeldSession };

/** Passo da retomada: conectar já com as perguntas de partida. */
export interface AgpResumeStep {
  kind: 'connect';
  questions: readonly AgpQuestion[];
}

/** O mínimo do `Following` do feed que o hold lê (o feed passa o próprio `following`, sem montar cópia). */
interface AgpFollowedSession {
  readonly target: { readonly sessionId: string };
  readonly questions: readonly AgpQuestion[];
}

/**
 * Segurar `sessionId`. Já segurando a mesma sessão = nada a fazer (hold repetido). Senão pausa com as perguntas
 * da sessão que estava sendo seguida SE for a mesma; de outra sessão nunca (lista vazia).
 */
export function decideAgpHold(
  sessionId: string,
  current: AgpFollowedSession | null,
  held: AgpHeldSession | null,
): AgpHoldStep {
  if (held !== null && held.sessionId === sessionId) return { kind: 'none' };
  const sameSession = current !== null && current.target.sessionId === sessionId;
  return { kind: 'pause', held: { sessionId, questions: sameSession ? current.questions : [] } };
}

/** Voltar a seguir `sessionId`: parte das perguntas seguradas se forem da mesma sessão, senão de lista vazia. */
export function decideAgpResume(sessionId: string, held: AgpHeldSession | null): AgpResumeStep {
  return { kind: 'connect', questions: held !== null && held.sessionId === sessionId ? held.questions : [] };
}
