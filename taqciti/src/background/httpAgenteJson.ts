/**
 * Uma chamada JSON ao backend do Agente, com tudo o que as portas HTTP da Fase 8 têm em comum: a
 * config é relida a cada chamada (a chave e a URL podem mudar), o request só existe para URL válida,
 * todo fetch tem timeout (nunca segura o service worker) e o corpo da resposta nunca é logado.
 *
 * Devolve só `{ status, json }`; `json` é `undefined` quando o corpo não é JSON (ex.: HTML de um
 * proxy). Quem chama valida o formato com zod e decide o que cada status significa.
 */
import { AGENTE_REQUEST_TIMEOUT_MS, type AgenteConfig } from '@/shared/config/agenteConfig';
import { buildAgenteJsonRequest, type AgenteJsonRequestInit } from '@/shared/config/agenteRoutes';

export interface HttpAgenteDeps {
  loadConfig: () => Promise<AgenteConfig>;
  /** Injetável para teste; padrão = `fetch` global. */
  fetch?: typeof fetch;
}

export interface AgenteJsonResponse {
  status: number;
  json: unknown;
}

/** URL do backend inválida: nada foi enviado. */
export class AgenteInvalidUrlError extends Error {
  constructor() {
    super('A URL do Agente não é válida.');
    this.name = 'AgenteInvalidUrlError';
  }
}

export async function requestAgenteJson(
  deps: HttpAgenteDeps,
  path: string,
  init: AgenteJsonRequestInit,
): Promise<AgenteJsonResponse> {
  const config = await deps.loadConfig();
  const request = buildAgenteJsonRequest(config, path, init);
  if (request === null) throw new AgenteInvalidUrlError();

  const doFetch = deps.fetch ?? fetch;
  const response = await doFetch(request.url, {
    ...request.init,
    signal: AbortSignal.timeout(AGENTE_REQUEST_TIMEOUT_MS),
  });
  const json: unknown = await response.json().catch(() => undefined);
  return { status: response.status, json };
}
