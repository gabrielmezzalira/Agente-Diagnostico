/**
 * `ClientDirectory` de produção: lista e cria clientes pelas rotas /webhook/extension/clients do
 * backend (decisão B1). Qualquer falha de leitura (URL inválida, rede, 404/5xx, resposta fora do
 * formato) vira `ClientDirectoryUnavailableError` — a tela mostra o plano B (ID manual, D-02).
 * A resposta é validada com zod e nunca exibida crua (T-08-25).
 */
import { z } from 'zod';
import {
  ClientDirectoryUnavailableError,
  DuplicateClientError,
  type ClientDirectory,
  type ClientSummary,
} from '@/features/agente/clientDirectory';
import { AGENTE_CLIENTS_PATH } from '@/shared/config/agenteRoutes';
import { requestAgenteJson, type HttpAgenteDeps } from './httpAgenteJson';

const clientSchema = z.object({
  id: z.string().uuid(),
  client: z.string(),
  name: z.string(),
});
const clientListSchema = z.array(clientSchema);

export function createHttpClientDirectory(deps: HttpAgenteDeps): ClientDirectory {
  return {
    async list(): Promise<ClientSummary[]> {
      try {
        const { status, json } = await requestAgenteJson(deps, AGENTE_CLIENTS_PATH, {
          method: 'GET',
        });
        const parsed = clientListSchema.safeParse(json);
        if (status !== 200 || !parsed.success) {
          throw new ClientDirectoryUnavailableError();
        }
        return parsed.data;
      } catch {
        // Nenhum detalhe (nem corpo) sai daqui: a tela só precisa saber que está indisponível.
        throw new ClientDirectoryUnavailableError();
      }
    },

    async create(name: string): Promise<ClientSummary> {
      const { status, json } = await requestAgenteJson(deps, AGENTE_CLIENTS_PATH, {
        method: 'POST',
        body: { name },
      }).catch(() => {
        throw new ClientDirectoryUnavailableError();
      });
      if (status === 409) throw new DuplicateClientError();
      const parsed = clientSchema.safeParse(json);
      if (status !== 201 || !parsed.success) {
        throw new Error(`Não foi possível criar o cliente (HTTP ${status}).`);
      }
      return parsed.data;
    },
  };
}
