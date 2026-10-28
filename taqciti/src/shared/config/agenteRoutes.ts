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
  isValidAgenteSessionId,
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

/** Rota do WebSocket de uma sessão no backend (`backend/app/routers/ws.py`): `/ws/{session_id}`. */
export const AGENTE_WS_PATH = '/ws';

/**
 * URL do WebSocket da sessão (Fase 10, painel AGP): `https` -> `wss`, `http` (só loopback, WR-06) -> `ws`.
 * `null` para backend inválido ou id fora do formato UUID — nada abre conexão nesse caso. Sem chave na URL:
 * o WebSocket do backend não usa o `x-agente-key`.
 */
export function buildAgpSocketUrl(backendUrl: string, sessionId: string): string | null {
  if (!isValidAgenteBackendUrl(backendUrl) || !isValidAgenteSessionId(sessionId)) return null;
  const parsed = new URL(backendUrl);
  const protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, '')}${AGENTE_WS_PATH}/${sessionId}`;
}
