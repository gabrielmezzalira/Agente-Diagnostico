/**
 * Fila de envio ao Agente (Fase 7, WR-01; Fase 8, D-18): os trechos saem um de cada vez, na ordem em que
 * foram liberados, com as novas tentativas da `sendRetryPolicy.ts`. Nunca bloqueia o streamer.
 *
 * Fase 8: as falas esperam numa porta de fila (`SendQueuePort`, durável em produção) e só saem dela quando
 * o Agente confirma — um reinício não perde nada e nenhuma fala antiga é descartada por teto (só o
 * excedente NOVO é recusado). O request é montado na hora de enviar, com a chave atual. Com o reenvio
 * ligado, esgotadas as tentativas por queda o item fica no topo e `kick()` só volta a tentar depois do
 * intervalo; a retirada por HTTP 500 segue a B3-b (`agenteSendSettle.ts`). Toda fala que sai sem entrega
 * é avisada por `onDropped`, exceto as pedidas pela pessoa: `cancelAll()` (D-09) e request `null`.
 * `dispose()` é terminal mas NÃO limpa a fila: descartar a instância não é desligar o envio.
 */
import type { ExtensionChunkRequest } from '@/shared/config/agenteConfig';
import type { AgenteSendOutcome } from '@/shared/config/agenteStatus';
import type { AgenteDelivery, AgenteDrop } from '@/shared/config/agenteDeliveryStore';
import { AGENTE_OUTBOX_RETRY_INTERVAL_MS, type OutboxItem } from '@/features/agente/outbox';
import { logger } from '@/shared/services/log';
import { createRequestDeliverer } from './agenteSendAttempts';
import { createCycleSettler } from './agenteSendSettle';
import { createDeliveryTracker } from './agenteDeliveryTracker';
import { createMemorySendQueue, type SendQueuePort } from './agenteSendQueue';

export interface AgenteSenderDeps {
  send: (request: ExtensionChunkRequest) => Promise<Response>;
  /** Monta o request do item na hora de enviar; `null` = o item é de outro backend e não sai. */
  buildRequest: (item: OutboxItem) => Promise<ExtensionChunkRequest | null>;
  /** Onde as falas esperam a vez. Sem ela vale a fila em memória. */
  queue?: SendQueuePort;
  /** Reenvio depois de queda (D-18); padrão `AGENTE_OUTBOX_RESEND_ENABLED` (desligado até a B3). */
  resendEnabled?: boolean;
  /** Limite B3-b para retirar uma fala recusada com HTTP 500; `null` = nunca. */
  serverErrorMaxAgeMs?: number | null;
  now?: () => number;
  /** Injetável só para teste; o padrão é `setTimeout`. */
  sleep?: (ms: number) => Promise<void>;
  /** Resultado de cada tentativa, para a tela mostrar a verdade (WR-07). `null` = erro de rede. */
  onOutcome?: (outcome: AgenteSendOutcome, httpStatus: number | null) => void;
  onDelivery?: (record: AgenteDelivery) => void;
  onDropped?: (drop: AgenteDrop) => void;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export function createAgenteSender(deps: AgenteSenderDeps) {
  const now = deps.now ?? Date.now;
  const queue = deps.queue ?? createMemorySendQueue();
  const report = (outcome: AgenteSendOutcome, status: number | null) => deps.onOutcome?.(outcome, status);
  const tracker = createDeliveryTracker({ now, onDelivery: deps.onDelivery, onDropped: deps.onDropped });
  let running = false;
  /** Falas guardadas enquanto o laço já corria: ele relê a fila antes de parar. */
  let rerun = false;
  /** Quando o topo esgotou as tentativas; `null` = não está esperando o Agente voltar. */
  let heldAt: number | null = null;
  let idle: Promise<void> = Promise.resolve();
  /** Chamado quando o laço vai despachar o 1º envio (ou parou): `accept` só termina depois disso. */
  let dispatched: () => void = () => undefined;
  /** Entradas de `submit` na ordem recebida: a fila é assíncrona, mas a ordem nunca se inverte. */
  let inbox: Promise<void> = Promise.resolve();
  let generation = 0;
  let disposed = false;

  const isCurrent = (gen: number) => !disposed && gen === generation;
  const deliver = createRequestDeliverer({
    send: deps.send,
    sleep: deps.sleep ?? defaultSleep,
    report,
    isCurrent,
  });
  const settle = createCycleSettler({
    queue,
    tracker,
    report,
    now,
    resendEnabled: deps.resendEnabled,
    serverErrorMaxAgeMs: deps.serverErrorMaxAgeMs,
  });

  async function run(): Promise<void> {
    let skipped = 0;
    try {
      while (!disposed) {
        const gen = generation;
        const queued = await queue.load();
        const item = queued[0];
        if (item === undefined) {
          if (!rerun) break;
          rerun = false;
          continue;
        }
        let request: ExtensionChunkRequest | null;
        try {
          request = await deps.buildRequest(item);
        } catch (error) {
          logger.error('montar o envio ao Agente falhou', error); // a fala fica; o próximo kick tenta de novo
          break;
        }
        if (!isCurrent(gen)) continue;
        if (request === null) {
          await queue.remove(item.chunkId);
          skipped += 1;
          continue;
        }
        dispatched();
        const cycle = await deliver(request, gen);
        if (!isCurrent(gen)) continue;
        if ((await settle(item, cycle, queued.length)) === 'hold') {
          heldAt = now();
          break;
        }
      }
    } catch (error) {
      logger.error('a fila de envio ao Agente parou', error);
    } finally {
      running = false;
      dispatched();
      // IN-04: o descarte por destino diferente (IN-11) não pode ser silencioso. Só a contagem — nunca o texto.
      if (skipped > 0) logger.warn('falas descartadas: destino diferente da config atual', { discarded: skipped });
    }
  }

  /** Tenta o topo se não há envio em voo e, havendo espera pelo Agente, o intervalo de nova tentativa passou. */
  function start(): Promise<void> {
    if (disposed) return Promise.resolve();
    if (running) {
      rerun = true;
      return Promise.resolve();
    }
    if (heldAt !== null && now() - heldAt < AGENTE_OUTBOX_RETRY_INTERVAL_MS) return Promise.resolve();
    heldAt = null;
    rerun = false;
    running = true;
    const started = new Promise<void>((resolve) => (dispatched = resolve));
    idle = run();
    return started;
  }
  const kick = (): void => void start();

  async function accept(items: readonly OutboxItem[], gen: number): Promise<void> {
    if (!isCurrent(gen)) return; // cancelado entre o submit e a gravação (D-09)
    try {
      const result = await queue.append(items);
      if (result.overflowed > 0) tracker.overflowed(items.slice(items.length - result.overflowed));
      tracker.queueChanged(result.queue.length);
    } catch {
      // Falha ao gravar (cota do storage): as falas não ficaram na fila — contam como "fila cheia".
      logger.warn('guardar as falas na fila de envio falhou', { code: 'append_failed' });
      tracker.overflowed(items);
      return;
    }
    if (isCurrent(gen)) await start();
  }

  /** Enfileira na ordem recebida. */
  function submit(items: readonly OutboxItem[]): void {
    if (disposed || items.length === 0) return;
    const gen = generation;
    inbox = inbox.then(() => accept(items, gen)).catch((error: unknown) => {
      logger.error('guardar as falas na fila de envio falhou', error);
    });
  }

  /** Boot: retoma a fila durável na ordem. Fila com falas de antes do reinício conta a próxima entrega como volta. */
  async function resume(): Promise<void> {
    try {
      const queued = await queue.load();
      if (queued.length > 0) tracker.assumeBacklog(queued.length);
    } catch (error) {
      logger.error('ler a fila de envio ao Agente falhou', error);
      return;
    }
    kick();
  }

  /** Descarta a fila e interrompe o trecho que estiver esperando nova tentativa (pedido da pessoa: sem rastro). */
  function cancelAll(): void {
    generation += 1;
    heldAt = null;
    tracker.reset();
    queue.clear().catch((error: unknown) => logger.error('limpar a fila de envio ao Agente falhou', error));
  }

  /** Terminal, mas a fila (durável) fica intacta para a instância seguinte. */
  function dispose(): void {
    disposed = true;
    generation += 1;
  }

  /** Só para testes: espera a fila atual terminar (inclui as esperas de retry). */
  async function whenIdle(): Promise<void> {
    await inbox;
    await idle;
  }

  /** Só para testes: espera as falas serem guardadas e o 1º envio ser despachado — sem esperar a resposta. */
  const settled = (): Promise<void> => inbox;

  return { submit, kick, resume, cancelAll, dispose, whenIdle, settled };
}

export type AgenteSender = ReturnType<typeof createAgenteSender>;
