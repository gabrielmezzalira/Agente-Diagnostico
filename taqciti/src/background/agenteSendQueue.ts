/**
 * Porta da fila do sender do Agente (Fase 8, D-18) e a fila em memória padrão. O sender só conhece
 * esta interface: em produção quem a implementa é a fila durável de `agenteOutboxStore.ts`; sem uma
 * injetada vale a fila em memória — mesma regra da durável (teto de `AGENTE_OUTBOX_MAX_ITEMS`, o
 * excedente NOVO é recusado e contado; nenhuma fala antiga é descartada).
 */
import {
  AGENTE_OUTBOX_MAX_ITEMS,
  appendItems,
  type AppendResult,
  type OutboxItem,
} from '@/features/agente/outbox';

export interface SendQueuePort {
  /** A fila inteira, na ordem de entrega. */
  load: () => Promise<OutboxItem[]>;
  /** Acrescenta ao fim; devolve a fila nova e quantas falas novas foram recusadas. */
  append: (items: readonly OutboxItem[]) => Promise<AppendResult>;
  /** Tira só a fala indicada (id que não está na fila não faz nada). */
  remove: (chunkId: string) => Promise<void>;
  clear: () => Promise<void>;
}

export function createMemorySendQueue(): SendQueuePort {
  let items: OutboxItem[] = [];
  return {
    load: () => Promise.resolve([...items]),
    append: (added) => {
      const result = appendItems(items, added, AGENTE_OUTBOX_MAX_ITEMS);
      items = result.queue;
      return Promise.resolve(result);
    },
    remove: (chunkId) => {
      items = items.filter((item) => item.chunkId !== chunkId);
      return Promise.resolve();
    },
    clear: () => {
      items = [];
      return Promise.resolve();
    },
  };
}
