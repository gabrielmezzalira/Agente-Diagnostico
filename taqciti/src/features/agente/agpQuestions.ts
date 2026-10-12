/**
 * As perguntas do Agente espelhadas na Taqciti (Fase 10, TAQ-05): a leitura das mensagens do WebSocket
 * `/ws/{session_id}` do backend e a lista que o painel "AGP" mostra. Puro — sem `chrome`, `WebSocket` nem
 * relógio (o "agora" entra por parâmetro). A Taqciti NÃO recalcula nem inventa pergunta: só reflete o que o
 * backend manda (`initial_state`, `question_new`, `question_expired`) e ignora qualquer outro evento.
 */

export type AgpLens = 'produto' | 'dados';

export interface AgpQuestion {
  id: string;
  text: string;
  /** Bloco temático (`negocio`, `eng_dados`, ...); texto livre para o painel rotular. */
  block: string;
  /** `null` no modo vendas (o backend não etiqueta a lente lá). */
  lens: AgpLens | null;
  status: 'queued' | 'pinned';
  /** ISO 8601 de quando some da fila; `null` = sem prazo legível. */
  expiresAt: string | null;
}

export type AgpMessage =
  | { kind: 'initial'; questions: AgpQuestion[] }
  | { kind: 'new'; question: AgpQuestion }
  | { kind: 'expired'; id: string };

/** Teto defensivo: o backend limita a fila a 5, mas um backend com defeito não pode lotar o storage. */
export const AGP_MAX_QUESTIONS = 30;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Lista branca de campos: nada além destes seis entra no storage (sem fala, sem chave). */
export function toAgpQuestion(raw: unknown): AgpQuestion | null {
  if (!isRecord(raw)) return null;
  const { id, text, block, lens, status, expires_at: expiresAt } = raw;
  if (typeof id !== 'string' || id.length === 0) return null;
  if (typeof text !== 'string' || text.trim().length === 0) return null;
  if (status !== 'queued' && status !== 'pinned') return null;
  return {
    id,
    text,
    block: typeof block === 'string' ? block : '',
    lens: lens === 'produto' || lens === 'dados' ? lens : null,
    status,
    expiresAt: typeof expiresAt === 'string' ? expiresAt : null,
  };
}

/** Uma mensagem crua do socket -> mensagem tipada; `null` para JSON inválido e para qualquer evento que não interessa. */
export function parseAgpMessage(rawText: string): AgpMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || typeof parsed.event !== 'string') return null;
  const data = parsed.data;
  switch (parsed.event) {
    case 'initial_state': {
      const list = isRecord(data) && Array.isArray(data.questions) ? data.questions : [];
      const questions = list.map(toAgpQuestion).filter((q): q is AgpQuestion => q !== null);
      return { kind: 'initial', questions };
    }
    case 'question_new': {
      const question = toAgpQuestion(data);
      return question === null ? null : { kind: 'new', question };
    }
    case 'question_expired':
      return isRecord(data) && typeof data.id === 'string' ? { kind: 'expired', id: data.id } : null;
    default:
      return null;
  }
}

function capped(list: AgpQuestion[]): AgpQuestion[] {
  return list.length > AGP_MAX_QUESTIONS ? list.slice(list.length - AGP_MAX_QUESTIONS) : list;
}

/** Aplica uma mensagem à lista. Devolve a MESMA referência quando nada muda (quem grava pula a escrita). */
export function applyAgpMessage(current: readonly AgpQuestion[], message: AgpMessage): readonly AgpQuestion[] {
  switch (message.kind) {
    case 'initial':
      return capped(message.questions);
    case 'new': {
      if (current.some((q) => q.id === message.question.id)) return current;
      return capped([...current, message.question]);
    }
    case 'expired': {
      const next = current.filter((q) => q.id !== message.id);
      return next.length === current.length ? current : next;
    }
  }
}

/** A pergunta ainda deve aparecer? Fixada nunca vence; as demais somem quando o prazo passa (backup do `question_expired`). */
export function isAgpQuestionVisible(question: AgpQuestion, nowMs: number): boolean {
  if (question.status === 'pinned' || question.expiresAt === null) return true;
  const expires = Date.parse(question.expiresAt);
  return Number.isNaN(expires) || expires > nowMs;
}
