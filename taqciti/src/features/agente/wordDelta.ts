/**
 * Delta palavra-a-palavra por segmento (D-07) — funções puras, sem
 * `chrome`/`fetch`. Espelha o padrão de `extension/content_meet.js::emitNew()`,
 * mas adaptado para MÚLTIPLOS segmentos concorrentes (a Taqciti mantém vários
 * `LiveSegment` simultâneos; a extensão antiga tinha só uma fala de cada vez).
 *
 * A chave de cada segmento no cursor é `${índice}:${captionId}` — NÃO só
 * `captionId` — porque o mesmo captionId pode gerar um segmento NOVO (troca
 * de falante, ou linha do DOM reaproveitada — ver aggregator.ts:49-68). Usar
 * só captionId cortaria o início desse segmento novo pela contagem do
 * anterior.
 */
import type { LiveSegment, MeetingSessionState } from '@/shared/types/domain';

export interface StreamCursor {
  meetingId: string;
  sessionId: string;
  /** `${índice}:${captionId}` -> nº de palavras já enviadas daquele segmento. */
  sent: Readonly<Record<string, number>>;
}

export interface SegmentDelta {
  key: string;
  text: string;
  speaker: string | null;
}

export interface StreamBinding {
  sessionId: string;
  /** Reunião nova que a pessoa confirmou como parte desta mesma sessão (CR-01). */
  confirmedMeetingId?: string;
  /**
   * Última reunião enviada para esta sessão, vinda de `storage.local` (CR-01). É o que
   * resta de memória quando o cursor se perde (navegador fechado, extensão atualizada,
   * toggle religado). Vazio ou ausente = esta sessão ainda não recebeu nenhuma reunião.
   */
  boundMeetingId?: string;
}

export interface StreamStep {
  cursor: StreamCursor | null;
  deltas: SegmentDelta[];
  /** Reunião nova com o mesmo session_id, esperando confirmação (CR-01). */
  waitingForNewMeeting?: boolean;
}

/** Split em whitespace Unicode; descarta tokens vazios. Sem re-normalização NFC/NFD. */
export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter((word) => word.length > 0);
}

export function segmentKey(segment: Pick<LiveSegment, 'captionId'>, index: number): string {
  return `${index}:${segment.captionId}`;
}

/** Ancora o cursor no estado atual (tudo já "enviado") — envio só dali para frente (D-09). */
export function primeCursor(session: MeetingSessionState, sessionId: string): StreamCursor {
  const sent: Record<string, number> = {};
  session.segments.forEach((segment, index) => {
    sent[segmentKey(segment, index)] = splitWords(segment.text).length;
  });
  return { meetingId: session.meetingId, sessionId, sent };
}

/**
 * Para cada segmento atual: delta = palavras além da contagem já enviada,
 * unidas por um espaço; nova contagem = máximo entre a anterior e a atual
 * (texto que encolhe ou é reescrito sem crescer não é reenviado — limitação
 * aceita, ver RESEARCH.md Pattern 2). O cursor novo só tem chaves dos
 * segmentos atuais — chaves de segmentos que sumiram (ex: CLEAR_TRANSCRIPT)
 * não sobrevivem.
 */
export function computeSegmentDeltas(
  cursor: StreamCursor,
  segments: readonly LiveSegment[],
): { cursor: StreamCursor; deltas: SegmentDelta[] } {
  const sent: Record<string, number> = {};
  const deltas: SegmentDelta[] = [];

  segments.forEach((segment, index) => {
    const key = segmentKey(segment, index);
    const words = splitWords(segment.text);
    const already = cursor.sent[key] ?? 0;
    sent[key] = Math.max(already, words.length);

    if (words.length > already) {
      const fresh = words.slice(already).join(' ');
      if (fresh.length > 0) {
        deltas.push({ key, text: fresh, speaker: segment.speaker });
      }
    }
  });

  return { cursor: { ...cursor, sent }, deltas };
}

/**
 * Decide o passo do streaming a partir do estado anterior do cursor, da
 * sessão atual da máquina de estados e do binding (config pronta ou não):
 *
 * 1. binding nulo (desligado/incompleto) -> cursor null, sem deltas.
 * 2. sem sessão -> mantém o cursor anterior, sem deltas.
 * 3. cursor nulo (primeira vez, ou perdido) -> prime (envio só dali para frente,
 *    D-09) — EXCETO se a sessão já está vinculada a OUTRA reunião (`boundMeetingId`):
 *    aí é a mesma situação do passo 4 (reunião nova, mesmo session_id) e vale a mesma
 *    espera sinalizada, senão a reunião do dia seguinte ia para a sessão do cliente
 *    anterior sem ninguém confirmar (CR-01, 2ª revisão).
 * 4. reunião mudou: session_id mudou -> prime para a reunião nova; mesmo
 *    session_id -> ESPERA sinalizada (`waitingForNewMeeting`, CR-01) até a
 *    pessoa confirmar — confirmada, a reunião nova sai desde o início dela.
 * 5. mesma reunião -> calcula os deltas, com o session_id atualizado para o
 *    do binding (trocar de sessão no meio só afeta o texto novo dali pra
 *    frente — nada já contado é reenviado).
 */
export function planStreamStep(
  prev: StreamCursor | null,
  session: MeetingSessionState | null,
  binding: StreamBinding | null,
): StreamStep {
  if (binding === null) {
    return { cursor: null, deltas: [] };
  }
  if (session === null) {
    return { cursor: prev, deltas: [] };
  }
  if (prev === null) {
    const bound = binding.boundMeetingId;
    if (bound && bound !== session.meetingId) {
      return releaseOrWait(null, session, binding);
    }
    return { cursor: primeCursor(session, binding.sessionId), deltas: [] };
  }
  if (prev.meetingId !== session.meetingId) {
    if (binding.sessionId === prev.sessionId) {
      return releaseOrWait(prev, session, binding);
    }
    return { cursor: primeCursor(session, binding.sessionId), deltas: [] };
  }

  const cursorForSession =
    prev.sessionId === binding.sessionId ? prev : { ...prev, sessionId: binding.sessionId };
  return computeSegmentDeltas(cursorForSession, session.segments);
}

/**
 * Reunião diferente da que a sessão já recebeu: confirmada pela pessoa, sai desde o
 * início dela; senão ESPERA, mantendo o cursor que havia (`null` quando se perdeu).
 */
function releaseOrWait(
  cursor: StreamCursor | null,
  session: MeetingSessionState,
  binding: StreamBinding,
): StreamStep {
  if (binding.confirmedMeetingId === session.meetingId) {
    const fromStart = { meetingId: session.meetingId, sessionId: binding.sessionId, sent: {} };
    return computeSegmentDeltas(fromStart, session.segments);
  }
  return { cursor, deltas: [], waitingForNewMeeting: true };
}
