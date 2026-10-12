/**
 * Rotas da extensão no backend do Agente (Fase 8, TAQ-02) e a montagem do request JSON delas.
 * Espelha `backend/app/routers/extension_clients.py` (prefixo /webhook/extension, sem rota vazia).
 *
 * Função pura — nenhum `fetch` aqui. Só monta request para URL de backend válida (https, ou http em
 * loopback — WR-06): para qualquer outra, devolve `null` e nada é enviado, então a chave
 * `x-agente-key` nunca sai em texto puro na rede.
 */
import {
  AGENTE_KEY_HEADER,
  isValidAgenteBackendUrl,
  type AgenteConfig,
} from './agenteConfig';

/** GET lista clientes; POST cria um cliente só com o nome. */
export const AGENTE_CLIENTS_PATH = '/webhook/extension/clients';

/** POST abre uma sessão nova para um cliente (projeto). */
export const AGENTE_SESSIONS_PATH = '/webhook/extension/sessions';

export interface AgenteJsonRequest {
  url: string;
  init: RequestInit;
}

export interface AgenteJsonRequestInit {
  method: 'GET' | 'POST';
  body?: unknown;
}

export function buildAgenteJsonRequest(
  config: AgenteConfig,
  path: string,
  init: AgenteJsonRequestInit,
): AgenteJsonRequest | null {
  if (!isValidAgenteBackendUrl(config.agenteBackendUrl)) return null;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.agenteApiKey.length > 0) {
    headers[AGENTE_KEY_HEADER] = config.agenteApiKey;
  }
  const requestInit: RequestInit = { method: init.method, headers };
  if (init.body !== undefined) {
    requestInit.body = JSON.stringify(init.body);
  }
  return { url: `${config.agenteBackendUrl}${path}`, init: requestInit };
}
