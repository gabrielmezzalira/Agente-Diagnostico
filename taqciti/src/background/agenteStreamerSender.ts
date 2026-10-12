/**
 * Montagem do sender do streamer do Agente, extraída de `agenteStreamerInstance.ts` para a instância caber
 * em 300 linhas: liga o envio (`deps.send`), o status que a tela mostra e o jeito de montar o request de
 * cada fala da fila na hora de enviar. A instância só decide QUANDO entregar falas e chamar o sender.
 */
import type { AgenteConfig } from '@/shared/config/agenteConfig';
import { buildOutboxRequest } from '@/features/agente/outbox';
import type { AgenteStreamerDeps } from './agenteStreamerDeps';
import type { createStatusReporter } from './agenteStatusReporter';
import { createAgenteSender } from './agenteSender';

type StatusReporter = ReturnType<typeof createStatusReporter>;

export function createStreamerSender(
  deps: AgenteStreamerDeps,
  status: StatusReporter,
  getQueueConfig: () => AgenteConfig | null,
) {
  return createAgenteSender({
    send: deps.send,
    onOutcome: status.sendOutcome,
    buildRequest: (item) => {
      const config = getQueueConfig();
      return Promise.resolve(config ? buildOutboxRequest(config, item) : null);
    },
  });
}
