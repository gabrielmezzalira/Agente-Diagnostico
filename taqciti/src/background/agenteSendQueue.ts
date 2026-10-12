/**
 * Porta da fila do sender do Agente (Fase 8, D-18) e a fila em memória padrão. O sender só conhece
 * esta interface: em produção quem a implementa é a fila durável de `agenteOutboxStore.ts`; sem uma
 * injetada vale a fila em memória, que mantém a regra da Fase 7 (teto de 50, descarta o mais antigo).
 */
import type { AppendResult, OutboxItem } from '@/features/agente/outbox';
import { AGENTE_SEND_MAX_QUEUED } from '@/features/agente/sendRetryPolicy';
import { logger } from '@/shared/services/log';

export interface SendQueuePort {
  /** A fila inteira, na ordem de entrega. */
  load: () => Promise<OutboxItem[]>;
  /** Acrescenta ao fim; devolve a fila nova e quantas falas novas foram recusadas. */
  append: (items: readonly OutboxItem[]) => Promise<AppendResult>;
  /** Tira só a fala indicada (id que não está na fila não faz nada). */
  remove: (chunkId: string) => Promise<void>;
  clear: () => Promise<void>;
}

/** Fila da Fase 7: acima do teto, descarta o trecho mais antigo que ainda esperava. */
export function createMemorySendQueue(): SendQueuePort {
  let items: OutboxItem[] = [];
  return {
    load: () => Promise.resolve([...items]),
    append: (added) => {
      for (const item of added) {
        items.push(item);
        if (items.length > AGENTE_SEND_MAX_QUEUED) {
          items.shift();
          logger.warn('fila de envio ao Agente cheia — trecho mais antigo descartado');
        }
      }
      return Promise.resolve({ queue: [...items], overflowed: 0 });
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
