/**
 * Fila durável do reenvio ao Agente (Fase 8, TAQ-02, D-18): funções PURAS — sem `chrome`, `fetch`
 * nem `Date.now`. Quem grava no disco é `agenteOutboxStore.ts`; quem envia é o sender do plano 08-23.
 *
 * O que a fila guarda é só o necessário para refazer o envio: `{chunkId, backendUrl, sessionId,
 * text, speaker, enqueuedAt}`. NUNCA headers nem a chave `x-agente-key` (T-08-20): o request é
 * remontado na hora do envio, com a chave da config ATUAL (`buildOutboxRequest`).
 *
 * O teto NÃO descarta o mais antigo: acima de `AGENTE_OUTBOX_MAX_ITEMS`, `appendItems` recusa só o
 * excedente novo e devolve a contagem, para o sender registrar o rastro de falas descartadas.
 */
import {
  buildExtensionChunkRequest,
  type AgenteConfig,
  type ExtensionChunkRequest,
} from '@/shared/config/agenteConfig';
import type { PendingPhrase } from './phraseBatcher';

/**
 * Teto de falas esperando entrega. Suposição registrada: fala é texto curto (dezenas de bytes a
 * poucos KB), então 1000 itens ficam bem abaixo da cota de 10 MB do `storage.local`; o teste manual
 * D-20 mede `getBytesInUse` para confirmar.
 */
export const AGENTE_OUTBOX_MAX_ITEMS = 1000;

/** Intervalo entre novas tentativas de entrega da fila quando o Agente está fora (usado no 08-23). */
export const AGENTE_OUTBOX_RETRY_INTERVAL_MS = 15_000;

/**
 * Reenvio automático LIGADO (D-18, critério 4): com o Agente fora do ar as falas ficam na fila
 * durável e saem na ordem quando ele volta. Evita duplicata o `chunk_id` por fala (B3-a =
 * `aprovar-chunk-id`, `AGENTE_SEND_CHUNK_ID`); ligado em 2026-10-12 pelo plano 08-19. A regra de
 * retirada por HTTP 500 segue a B3-b (`retirada-nunca`, `AGENTE_OUTBOX_SERVER_ERROR_MAX_AGE_MS`).
 */
export const AGENTE_OUTBOX_RESEND_ENABLED = true;

/**
 * Manda o `chunk_id` em cada trecho (D-19). Decisão B3-a = `aprovar-chunk-id` (2026-10-12): a
 * migração da coluna `chunk_id` + índice único `(session_id, chunk_id)` foi aplicada em produção em
 * 2026-10-12 (08-09 Task 3). Ordem de rollout: migração -> deploy do backend -> build da Taqciti;
 * mandar `chunk_id` a um backend sem a coluna daria 500 em todo envio.
 */
export const AGENTE_SEND_CHUNK_ID = true;

export interface OutboxItem {
  /** Identificador da fala, para o backend reconhecer um reenvio (B3) e para remover da fila. */
  chunkId: string;
  /** Backend em que a fala foi acumulada (IN-11): nunca é enviada a outro. */
  backendUrl: string;
  sessionId: string;
  text: string;
  speaker: string | null;
  /** epoch ms de quando entrou na fila. */
  enqueuedAt: number;
}

export type Outbox = readonly OutboxItem[];

export interface AppendResult {
  queue: OutboxItem[];
  /** Quantas falas NOVAS foram recusadas por falta de espaço (nenhuma antiga é descartada). */
  overflowed: number;
}

/** Falas liberadas pela janela de agrupamento viram itens da fila, na mesma ordem. */
export function phrasesToOutboxItems(
  phrases: readonly PendingPhrase[],
  makeId: () => string,
  now: number,
): OutboxItem[] {
  return phrases.map((phrase) => ({
    chunkId: makeId(),
    backendUrl: phrase.backendUrl,
    sessionId: phrase.sessionId,
    text: phrase.text,
    speaker: phrase.speaker,
    enqueuedAt: now,
  }));
}

/** Acrescenta ao fim da fila até o teto; o excedente NOVO é recusado, a fila existente fica intacta. */
export function appendItems(queue: Outbox, items: readonly OutboxItem[], max: number): AppendResult {
  const room = Math.max(0, max - queue.length);
  const accepted = items.slice(0, room);
  return { queue: [...queue, ...accepted], overflowed: items.length - accepted.length };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function normalizeItem(raw: unknown): OutboxItem | null {
  if (!isRecord(raw)) return null;
  const { chunkId, backendUrl, sessionId, text, speaker, enqueuedAt } = raw;
  if (!isNonEmptyString(chunkId) || !isNonEmptyString(backendUrl)) return null;
  if (!isNonEmptyString(sessionId) || typeof text !== 'string') return null;
  return {
    chunkId,
    backendUrl,
    sessionId,
    text,
    speaker: typeof speaker === 'string' ? speaker : null,
    enqueuedAt: typeof enqueuedAt === 'number' && Number.isFinite(enqueuedAt) ? enqueuedAt : 0,
  };
}

/** Valor salvo -> fila válida; lista branca de 6 campos (T-08-20), lixo vira `[]`. */
export function normalizeOutbox(raw: unknown): OutboxItem[] {
  if (!Array.isArray(raw)) return [];
  const items: OutboxItem[] = [];
  for (const entry of raw) {
    const item = normalizeItem(entry);
    if (item !== null) items.push(item);
  }
  return items;
}

/**
 * Remonta o request do item com a chave da config ATUAL. Item de outro backend vira `null`: mandá-lo
 * à URL antiga levaria a chave do backend novo (mesma regra de `buildPhraseRequests`, IN-11).
 */
export function buildOutboxRequest(config: AgenteConfig, item: OutboxItem): ExtensionChunkRequest | null {
  if (item.backendUrl !== config.agenteBackendUrl) return null;
  return buildExtensionChunkRequest(
    { ...config, agenteSessionId: item.sessionId },
    { text: item.text, speaker: item.speaker },
    AGENTE_SEND_CHUNK_ID ? item.chunkId : undefined,
  );
}

export function countForSession(queue: Outbox, sessionId: string): number {
  return queue.filter((item) => item.sessionId === sessionId).length;
}
