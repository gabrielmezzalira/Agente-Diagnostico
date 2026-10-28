/**
 * As perguntas do Agente espelhadas na Taqciti (Fase 10, TAQ-05): a leitura das mensagens do WebSocket
 * `/ws/{session_id}` do backend e a lista que o painel "AGP" mostra. Puro — sem `chrome`, `WebSocket` nem
 * relógio. A Taqciti NÃO recalcula nem inventa pergunta: só reflete o que o backend manda (`initial_state`,
 * `question_new`, `question_expired`) e ignora qualquer outro evento. A expiração vem SÓ do `question_expired`
 * do backend: comparar o `expires_at` do servidor com o relógio do cliente esconderia pergunta nova num relógio
 * adiantado, então não há prazo local.
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
}

export type AgpMessage =
  | { kind: 'initial'; questions: AgpQuestion[] }
  | { kind: 'new'; question: AgpQuestion }
  | { kind: 'expired'; id: string };

/** Teto defensivo: o backend limita a fila a 5, mas um backend com defeito não pode lotar o storage. */
export const AGP_MAX_QUESTIONS = 30;

/** Tetos por campo (WR-03): o `storage.local` é o mesmo do histórico; texto de backend nunca entra sem limite. */
const MAX_ID_LENGTH = 128;
const MAX_TEXT_LENGTH = 1_000;
const MAX_BLOCK_LENGTH = 64;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Lista branca de campos, com tetos de tamanho: nada além destes cinco entra no storage (sem fala, sem chave).
 * Serve para a mensagem do backend E para o que já foi guardado (os nomes dos campos são os mesmos), então
 * reler o storage nunca perde campo.
 */
export function toAgpQuestion(raw: unknown): AgpQuestion | null {
  if (!isRecord(raw)) return null;
  const { id, text, block, lens, status } = raw;
  if (typeof id !== 'string' || id.length === 0 || id.length > MAX_ID_LENGTH) return null;
  if (typeof text !== 'string' || text.trim().length === 0) return null;
  if (status !== 'queued' && status !== 'pinned') return null;
  return {
    id,
    text: text.slice(0, MAX_TEXT_LENGTH),
    block: typeof block === 'string' ? block.slice(0, MAX_BLOCK_LENGTH) : '',
    lens: lens === 'produto' || lens === 'dados' ? lens : null,
    status,
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

/** Acima do teto, descarta as mais antigas que NÃO estão fixadas primeiro (WR-02): fixada só sai se não houver outra saída. */
function capped(list: AgpQuestion[]): AgpQuestion[] {
  let excess = list.length - AGP_MAX_QUESTIONS;
  if (excess <= 0) return list;
  const dropUnpinned = list.filter((q) => {
    if (excess > 0 && q.status !== 'pinned') {
      excess -= 1;
      return false;
    }
    return true;
  });
  return dropUnpinned.length > AGP_MAX_QUESTIONS ? dropUnpinned.slice(dropUnpinned.length - AGP_MAX_QUESTIONS) : dropUnpinned;
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
