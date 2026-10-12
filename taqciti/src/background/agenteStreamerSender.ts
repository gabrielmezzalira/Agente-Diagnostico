/**
 * Montagem do sender do streamer do Agente, extraída de `agenteStreamerInstance.ts` para a instância caber
 * em 300 linhas: liga o envio (`deps.send`), a fila durável (`deps.outbox`), o reenvio e o status que a
 * tela e o painel do Meet mostram (resultado, entrega e rastro de falas descartadas). O request de cada
 * fala é montado na hora de enviar, com a config ATUAL — necessário para reenviar depois de um reinício,
 * quando ainda não houve nenhum passo, e para nunca guardar a chave no storage. A instância só decide
 * QUANDO entregar falas e chamar o sender.
 */
import { buildOutboxRequest } from '@/features/agente/outbox';
import type { AgenteStreamerDeps } from './agenteStreamerDeps';
import type { createStatusReporter } from './agenteStatusReporter';
import { createAgenteSender } from './agenteSender';

type StatusReporter = ReturnType<typeof createStatusReporter>;

export function createStreamerSender(deps: AgenteStreamerDeps, status: StatusReporter) {
  return createAgenteSender({
    send: deps.send,
    queue: deps.outbox,
    resendEnabled: deps.outboxResendEnabled,
    onOutcome: status.sendOutcome,
    onDelivery: status.delivery,
    onDropped: status.dropped,
    buildRequest: async (item) => buildOutboxRequest(await deps.loadConfig(), item),
  });
}
