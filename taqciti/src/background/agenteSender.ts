/**
 * Fila de envio ao Agente (Fase 7, WR-01): os trechos saem um de cada vez, na
 * ordem em que foram liberados pela janela por fala, com as novas tentativas
 * da `sendRetryPolicy.ts`. Nunca bloqueia o streamer — `submit` só enfileira.
 *
 * Fase 8: o sender recebe ITENS (`OutboxItem`) por uma porta de fila (`SendQueuePort`) e monta o request
 * na hora de enviar (`deps.buildRequest`), com a chave da config atual. Item cujo request não existe
 * mais (outro backend) é removido sem envio e só a contagem vai para o log.
 *
 * `cancelAll()` é o que mantém o D-09 com o retry: desligar o streaming
 * descarta a fila E interrompe um trecho que esteja esperando nova tentativa
 * (cada tentativa confere a "geração" antes de sair).
 */
import type { ExtensionChunkRequest } from '@/shared/config/agenteConfig';
import type { AgenteSendOutcome } from '@/shared/config/agenteStatus';
import type { OutboxItem } from '@/features/agente/outbox';
import { logger } from '@/shared/services/log';
import { createRequestDeliverer } from './agenteSendAttempts';
import { createMemorySendQueue, type SendQueuePort } from './agenteSendQueue';

export interface AgenteSenderDeps {
  send: (request: ExtensionChunkRequest) => Promise<Response>;
  /** Monta o request do item na hora de enviar; `null` = o item é de outro backend e não sai. */
  buildRequest: (item: OutboxItem) => Promise<ExtensionChunkRequest | null>;
  /** Onde as falas esperam a vez. Sem ela vale a fila em memória da Fase 7. */
  queue?: SendQueuePort;
  /** Injetável só para teste; o padrão é `setTimeout`. */
  sleep?: (ms: number) => Promise<void>;
  /** Resultado de cada tentativa, para a tela mostrar a verdade (WR-07). `null` = erro de rede. */
  onOutcome?: (outcome: AgenteSendOutcome, httpStatus: number | null) => void;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createAgenteSender(deps: AgenteSenderDeps) {
  const sleep = deps.sleep ?? defaultSleep;
  const queue = deps.queue ?? createMemorySendQueue();
  const report = (outcome: AgenteSendOutcome, httpStatus: number | null) =>
    deps.onOutcome?.(outcome, httpStatus);
  let running = false;
  /** Falas guardadas enquanto o laço já corria: ele relê a fila antes de parar. */
  let rerun = false;
  let idle: Promise<void> = Promise.resolve();
  /** Entradas de `submit` na ordem recebida: a fila é assíncrona, mas a ordem nunca se inverte. */
  let inbox: Promise<void> = Promise.resolve();
  let generation = 0;
  let disposed = false;

  const isCurrent = (gen: number) => !disposed && gen === generation;
  const deliver = createRequestDeliverer({ send: deps.send, sleep, report, isCurrent });

  async function run(): Promise<void> {
    let skipped = 0;
    try {
      while (!disposed) {
        const gen = generation;
        const [item] = await queue.load();
        if (item === undefined) {
          if (!rerun) break;
          rerun = false;
          continue;
        }
        if (!isCurrent(gen)) continue; // cancelado enquanto lia a fila
        await queue.remove(item.chunkId);
        const request = await deps.buildRequest(item);
        if (!isCurrent(gen)) continue;
        if (request === null) {
          skipped += 1;
          continue;
        }
        await deliver(request, gen);
      }
    } finally {
      running = false;
      // IN-04: o descarte por destino diferente (IN-11) não pode ser silencioso. Só a contagem — nunca o texto.
      if (skipped > 0) logger.warn('falas descartadas: destino diferente da config atual', { discarded: skipped });
    }
  }

  async function accept(items: readonly OutboxItem[], gen: number): Promise<void> {
    if (!isCurrent(gen)) return; // cancelado entre o submit e a gravação (D-09)
    await queue.append(items);
    if (!isCurrent(gen)) return;
    if (running) {
      rerun = true;
      return;
    }
    running = true;
    idle = run();
  }

  /** Enfileira na ordem recebida. */
  function submit(items: readonly OutboxItem[]): void {
    if (disposed || items.length === 0) return;
    const gen = generation;
    inbox = inbox.then(() => accept(items, gen)).catch((error: unknown) => {
      logger.error('guardar as falas na fila de envio falhou', error);
    });
  }

  /** Descarta a fila e interrompe o trecho que estiver esperando nova tentativa. */
  function cancelAll(): void {
    generation += 1;
    void queue.clear();
  }

  function dispose(): void {
    disposed = true;
    cancelAll();
  }

  /** Só para testes: espera a fila atual terminar (inclui as esperas de retry). */
  async function whenIdle(): Promise<void> {
    await inbox;
    await idle;
  }

  return { submit, cancelAll, dispose, whenIdle };
}

export type AgenteSender = ReturnType<typeof createAgenteSender>;
