/**
 * Onde mora a fila durável de falas ainda não entregues ao Agente (Fase 8, D-18): a chave própria
 * `taq:agenteOutbox` de `storage.local` (NÃO é a legada `taq:outbox`).
 *
 * ESCRITOR ÚNICO = o service worker, sempre com o VALOR INTEIRO e por uma fila serializada: duas
 * escritas simultâneas nunca se apagam (Pitfall 2, o WR-01 da Fase 7) e a segunda enxerga o
 * resultado da primeira. A fila fica em cache na memória, atualizado na mesma operação que grava.
 * Nada de segredo aqui: `normalizeOutbox` reconstrói cada item só com os 6 campos conhecidos.
 */
import {
  AGENTE_OUTBOX_MAX_ITEMS,
  appendItems,
  countForSession,
  normalizeOutbox,
  type AppendResult,
  type OutboxItem,
} from '@/features/agente/outbox';
import { readLocal, writeLocal } from '@/shared/services/storage';
import { STORAGE_KEYS } from './constants';

let cache: Promise<OutboxItem[]> | null = null;
let queue: Promise<unknown> = Promise.resolve();

/** Carrega o storage uma única vez; se a leitura falhar, a próxima chamada tenta de novo. */
function ensureLoaded(): Promise<OutboxItem[]> {
  if (cache === null) {
    cache = readLocal<unknown>(STORAGE_KEYS.agenteOutbox).then(normalizeOutbox);
    cache.catch(() => {
      cache = null;
    });
  }
  return cache;
}

/** Fila única de escrita: cada operação espera a anterior (e sobrevive à falha dela). */
function enqueue<T>(run: () => Promise<T>): Promise<T> {
  const next = queue.catch(() => undefined).then(run);
  queue = next;
  return next;
}

/** Grava a fila INTEIRA e só então troca o cache — gravação que falha não deixa o cache à frente. */
async function commit(next: OutboxItem[]): Promise<void> {
  await writeLocal(STORAGE_KEYS.agenteOutbox, next);
  cache = Promise.resolve(next);
}

export function loadOutbox(): Promise<OutboxItem[]> {
  return ensureLoaded();
}

/** Acrescenta ao fim; acima do teto recusa só o excedente novo e devolve a contagem. */
export function appendToOutbox(
  items: readonly OutboxItem[],
  max: number = AGENTE_OUTBOX_MAX_ITEMS,
): Promise<AppendResult> {
  return enqueue(async () => {
    const current = await ensureLoaded();
    const result = appendItems(current, normalizeOutbox(items), max);
    if (result.queue.length !== current.length) await commit(result.queue);
    return result;
  });
}

/** Tira só a fala confirmada pelo Agente; id que não está na fila não grava nada. */
export function removeOutboxItem(chunkId: string): Promise<void> {
  return enqueue(async () => {
    const current = await ensureLoaded();
    const remaining = current.filter((item) => item.chunkId !== chunkId);
    if (remaining.length !== current.length) await commit(remaining);
  });
}

export function clearOutbox(): Promise<void> {
  return enqueue(() => commit([]));
}

export async function countOutboxItemsForSession(sessionId: string): Promise<number> {
  return countForSession(await ensureLoaded(), sessionId);
}
