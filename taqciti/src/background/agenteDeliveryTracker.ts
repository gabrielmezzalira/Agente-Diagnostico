/**
 * Estado de entrega ao Agente (Fase 8, D-18): o que o painel do Meet mostra ("fora do ar, 5 falas na
 * fila") e o aviso de CADA fala que a Taqciti desistiu de entregar, para o rastro persistente.
 *
 * Só guarda o estado em memória e o repassa por `onDelivery` (o reporter só grava quando muda); nada
 * aqui toca storage nem rede. O aviso `onDropped` nunca leva texto de fala nem chave: sessão, contagem,
 * motivo, HTTP e hora.
 */
import {
  EMPTY_DELIVERY,
  type AgenteDelivery,
  type AgenteDrop,
  type DropReason,
} from '@/shared/config/agenteDeliveryStore';
import type { OutboxItem } from '@/features/agente/outbox';

export interface DeliveryTrackerDeps {
  now: () => number;
  onDelivery?: (record: AgenteDelivery) => void;
  onDropped?: (drop: AgenteDrop) => void;
}

/** Falas que saem sem entrega, agrupadas por sessão (cada sessão tem o seu rastro). */
function countBySession(items: readonly OutboxItem[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items)
    counts.set(item.sessionId, (counts.get(item.sessionId) ?? 0) + 1);
  return counts;
}

export function createDeliveryTracker(deps: DeliveryTrackerDeps) {
  let state: AgenteDelivery = EMPTY_DELIVERY;

  function emit(patch: Partial<AgenteDelivery>): void {
    state = { ...state, ...patch };
    deps.onDelivery?.(state);
  }

  function drop(
    items: readonly OutboxItem[],
    reason: DropReason,
    httpStatus: number | null,
  ): void {
    const at = deps.now();
    for (const [sessionId, count] of countBySession(items))
      deps.onDropped?.({ sessionId, count, reason, httpStatus, at });
  }

  return {
    /** O Agente confirmou uma fala. Se vinha de uma queda (ou de um reinício com fila), registra a volta. */
    delivered(queued: number, httpStatus: number): void {
      emit({
        status: 'ok',
        queued,
        httpStatus,
        recoveredAt: state.status === 'offline' ? deps.now() : state.recoveredAt,
      });
    },
    /** O topo da fila esgotou as tentativas por queda: fica parado esperando o Agente voltar. */
    offline(queued: number, httpStatus: number | null): void {
      emit({ status: 'offline', queued, httpStatus, recoveredAt: null });
    },
    /** A fila durável tem falas de antes do reinício: a próxima entrega conta como volta. */
    assumeBacklog(queued: number): void {
      state = { ...state, status: 'offline', queued };
    },
    /** Falas novas chegaram (ou saíram) com o Agente fora do ar: só atualiza a contagem. */
    queueChanged(queued: number): void {
      if (state.status === 'offline' && queued !== state.queued) emit({ queued });
    },
    /** Saída sem entrega: desistiu (`failed`) ou o Agente recusou (`rejected`). */
    dropped(
      item: OutboxItem,
      reason: Exclude<DropReason, 'overflow'>,
      httpStatus: number | null,
      queued: number,
    ): void {
      emit({ status: reason, queued, httpStatus });
      drop([item], reason, httpStatus);
    },
    /** Falas novas recusadas (fila cheia ou falha ao gravar): o status só soma o estouro. */
    overflowed(items: readonly OutboxItem[]): void {
      if (items.length === 0) return;
      emit({ overflow: state.overflow + items.length });
      drop(items, 'overflow', null);
    },
    /** O envio foi desligado ou o destino trocou (pedido da pessoa): volta ao estado inicial, sem rastro. */
    reset(): void {
      state = EMPTY_DELIVERY;
      deps.onDelivery?.(state);
    },
  };
}

export type DeliveryTracker = ReturnType<typeof createDeliveryTracker>;
