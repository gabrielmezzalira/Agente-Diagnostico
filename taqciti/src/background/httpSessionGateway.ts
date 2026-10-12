/**
 * `AgenteSessionGateway` de produção: abre a sessão de uma reunião pela rota
 * POST /webhook/extension/sessions do backend (decisão B1).
 *
 * Esta porta é a fronteira que conhece o contrato: o nome da sessão sai cortado no limite do backend
 * e, vazio, nem é enviado (o backend usa "Reunião pela Taqciti"). O fluxo do vínculo (08-10) segue
 * passando o título inteiro da reunião.
 */
import { z } from 'zod';
import type { AgenteSessionGateway } from '@/features/agente/clientDirectory';
import { AGENTE_SESSIONS_PATH } from '@/shared/config/agenteRoutes';
import { requestAgenteJson, type HttpAgenteDeps } from './httpAgenteJson';

/**
 * Mesmo limite de `ExtensionSessionCreate.name` no backend (08-07). O título da reunião no Meet
 * aceita até 300 caracteres; sem este corte, um título longo viraria 422 e o vínculo falharia.
 */
export const AGENTE_SESSION_NAME_MAX = 200;

const sessionSchema = z.object({ id: z.string().uuid() });

export function createHttpSessionGateway(deps: HttpAgenteDeps): AgenteSessionGateway {
  return {
    async createSession(clientId: string, name: string): Promise<{ sessionId: string }> {
      const trimmed = name.trim().slice(0, AGENTE_SESSION_NAME_MAX);
      const body: { project_id: string; name?: string } = { project_id: clientId };
      if (trimmed.length > 0) body.name = trimmed;

      const { status, json } = await requestAgenteJson(deps, AGENTE_SESSIONS_PATH, {
        method: 'POST',
        body,
      });
      const parsed = sessionSchema.safeParse(json);
      if (status !== 201 || !parsed.success) {
        throw new Error(`Não foi possível criar a sessão (HTTP ${status}).`);
      }
      return { sessionId: parsed.data.id };
    },
  };
}
