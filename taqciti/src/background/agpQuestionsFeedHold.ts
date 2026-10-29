/**
 * As decisões do "segurar" do feed do painel AGP (Fase 10, D-11, WR-04): com a reunião em pausa, sem legendas ou
 * com o envio ao Agente desligado, a conexão fecha de propósito mas as perguntas já recebidas ficam na tela
 * (`paused`); ao voltar a gravar, o feed reconecta com a lista mantida até o `initial_state` substituí-la.
 * Inclui a hidratação depois do sono do service worker (o feed salvo só vale para a MESMA sessão) e o marcador
 * do 4004 (D-12): sessão que o backend recusou não vira `paused` nem reabre sozinha — só um alvo novo ou o boot.
 *
 * Existe como módulo à parte porque o CLAUDE.md manda dividir arquivo acima de 200 linhas: o `agpQuestionsFeed.ts`
 * só EXECUTA o passo daqui. Puro — só dados entram e saem: nenhuma API do navegador, nenhum socket, nenhum relógio.
 */
import type { AgpQuestion } from '@/features/agente/agpQuestions';
import type { AgpFeed } from '@/shared/config/agpQuestionsStore';

/** A seleção "segurar": vínculo explícito vivo, conexão fechada de propósito (D-11). */
export interface AgpFeedHold {
  kind: 'hold';
  sessionId: string;
}

/** O que o feed lembra de uma sessão cuja conexão fechou de propósito. */
export interface AgpHeldSession {
  readonly sessionId: string;
  readonly questions: readonly AgpQuestion[];
  /** O backend respondeu 4004 (sessão não ativa): nem o hold nem a retomada reabrem esta sessão (D-12). */
  readonly endedByBackend: boolean;
}

/** Passo do hold: nada a fazer, pausar (publica `paused`) ou só guardar o marcador do 4004 (não publica nada). */
export type AgpHoldStep =
  | { kind: 'none' }
  | { kind: 'pause'; held: AgpHeldSession }
  | { kind: 'mark'; held: AgpHeldSession };

/** Passo da retomada: conectar já com as perguntas de partida, ou "bloqueado" (sessão recusada pelo backend). */
export type AgpResumeStep = { kind: 'connect'; questions: readonly AgpQuestion[] } | { kind: 'blocked' };

/** O mínimo do `Following` do feed que o hold lê (o feed passa o próprio `following`, sem montar cópia). */
interface AgpFollowedSession {
  readonly target: { readonly sessionId: string };
  readonly questions: readonly AgpQuestion[];
  readonly endedByBackend?: boolean;
}

/**
 * O feed salvo vira sessão segurada SÓ se for da mesma sessão (nunca mostra pergunta de outra); o salvo `idle`
 * significa que o backend já recusou a sessão (4004) antes do sono do worker.
 */
export function heldFromStored(stored: AgpFeed, sessionId: string): AgpHeldSession | null {
  if (stored.sessionId === null || stored.sessionId !== sessionId) return null;
  return { sessionId, questions: stored.questions, endedByBackend: stored.connection === 'idle' };
}

/**
 * Segurar `sessionId`. Já segurando a mesma sessão = nada a fazer (hold repetido). Senão a sessão "vista" é a que
 * estava sendo seguida SE for a mesma, ou o feed salvo do boot SE for a mesma; de outra sessão nunca (lista vazia).
 * Sessão marcada pelo 4004 só guarda o marcador: continua `idle`, sem publicar `paused`.
 */
export function decideAgpHold(
  sessionId: string,
  current: AgpFollowedSession | null,
  held: AgpHeldSession | null,
  boot: AgpFeed | null = null,
): AgpHoldStep {
  if (held !== null && held.sessionId === sessionId) return { kind: 'none' };
  const followed = current !== null && current.target.sessionId === sessionId ? current : null;
  const seen: AgpHeldSession =
    followed !== null
      ? { sessionId, questions: followed.questions, endedByBackend: followed.endedByBackend === true }
      : ((boot !== null ? heldFromStored(boot, sessionId) : null) ?? { sessionId, questions: [], endedByBackend: false });
  return { kind: seen.endedByBackend ? 'mark' : 'pause', held: seen };
}

/**
 * Voltar a seguir `sessionId`: sessão segurada marcada pelo 4004 = bloqueado; da mesma sessão = perguntas dela;
 * senão (sem `held`) as do feed salvo do boot SE for a mesma sessão, ignorando a marca dele (o boot tenta de novo,
 * como sempre); caso contrário, lista vazia.
 */
export function decideAgpResume(
  sessionId: string,
  held: AgpHeldSession | null,
  boot: AgpFeed | null = null,
): AgpResumeStep {
  if (held !== null && held.sessionId === sessionId) {
    return held.endedByBackend ? { kind: 'blocked' } : { kind: 'connect', questions: held.questions };
  }
  const saved = held === null && boot !== null ? heldFromStored(boot, sessionId) : null;
  return { kind: 'connect', questions: saved?.questions ?? [] };
}
