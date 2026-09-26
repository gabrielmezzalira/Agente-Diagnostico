/**
 * Config da integração de streaming com o backend do Agente Diagnóstico
 * (Fase 7, TAQ-01). Espelha o padrão de `serverConfig.ts` — variável de
 * build (`VITE_AGENTE_*`) como padrão, editável em runtime a partir do
 * plano 02 (`agenteConfigStore.ts`, ainda não criado nesta task).
 *
 * DIFERENÇA DELIBERADA em relação a `SERVER_SHARED_KEY`: aquela chave tem um
 * valor-padrão público embutido no bundle, porque serve só para barrar uso
 * acidental de um servidor de dev. A chave do Agente (`agenteApiKey`) NÃO
 * pode seguir esse padrão — ela autentica de verdade contra o gate opcional
 * da Fase 6 (`EXTENSION_SHARED_KEY`), e um valor embutido no `.crx` seria
 * visível a qualquer pessoa que abrisse o pacote da extensão (D-10). Por
 * isso não existe `AGENTE_KEY_DEFAULT`: a chave só existe no storage runtime,
 * vazio por padrão (nenhum header enviado).
 */

export const AGENTE_BACKEND_URL_DEFAULT =
  import.meta.env.VITE_AGENTE_BACKEND_URL ?? 'http://localhost:8000';

// D-09: streaming desligado por padrão — ninguém é afetado até decidir ligar.
export const AGENTE_STREAMING_ENABLED_DEFAULT =
  (import.meta.env.VITE_AGENTE_STREAMING_ENABLED ?? 'false') === 'true';

/** Espelha backend/app/routers/webhook.py — header do gate opcional (D-10). */
export const AGENTE_KEY_HEADER = 'x-agente-key';

/** Espelha backend/app/routers/webhook.py — rota do contrato ExtensionChunk. */
export const AGENTE_WEBHOOK_PATH = '/webhook/extension';

/** Timeout do fetch de streaming — nunca deixa uma chamada lenta acumular. */
export const AGENTE_REQUEST_TIMEOUT_MS = 10_000;

export interface AgenteConfig {
  agenteBackendUrl: string;
  streamingEnabled: boolean;
  /** Colado manualmente (D-04) até a Fase 8 trazer o auto-detect. */
  agenteSessionId: string;
  /** Vazio = nenhum header x-agente-key enviado (D-10). Nunca tem padrão de build. */
  agenteApiKey: string;
}

export const DEFAULT_AGENTE_CONFIG: AgenteConfig = {
  agenteBackendUrl: AGENTE_BACKEND_URL_DEFAULT,
  streamingEnabled: AGENTE_STREAMING_ENABLED_DEFAULT,
  agenteSessionId: '',
  agenteApiKey: '',
};

/**
 * Normaliza a URL do backend do Agente — mesmo padrão de
 * `extension/background.js::normalizeUrl` (trim, remove barras finais,
 * prefixa `https://` quando falta protocolo). String vazia continua vazia
 * (quem chama decide o fallback — ver `normalizeAgenteConfig`).
 */
export function normalizeAgenteBackendUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (trimmed.length > 0 && !/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

/**
 * Resolve uma config parcial (ex: vinda do storage) para uma config completa
 * e válida: campo do tipo certo vence; tipo errado ou ausente cai no padrão;
 * URL em branco cai no padrão da build; session_id e chave sempre com trim.
 */
export function normalizeAgenteConfig(
  raw: Partial<AgenteConfig> | null | undefined,
): AgenteConfig {
  const source = raw ?? {};

  const rawUrl = typeof source.agenteBackendUrl === 'string' ? source.agenteBackendUrl : '';
  const normalizedUrl = normalizeAgenteBackendUrl(rawUrl);
  const agenteBackendUrl = normalizedUrl.length > 0 ? normalizedUrl : AGENTE_BACKEND_URL_DEFAULT;

  const streamingEnabled =
    typeof source.streamingEnabled === 'boolean'
      ? source.streamingEnabled
      : AGENTE_STREAMING_ENABLED_DEFAULT;

  const agenteSessionId =
    typeof source.agenteSessionId === 'string' ? source.agenteSessionId.trim() : '';

  const agenteApiKey =
    typeof source.agenteApiKey === 'string' ? source.agenteApiKey.trim() : '';

  return { agenteBackendUrl, streamingEnabled, agenteSessionId, agenteApiKey };
}

const AGENTE_SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** session_id precisa ter formato UUID (validação de entrada, ASVS V5). */
export function isValidAgenteSessionId(value: string): boolean {
  return AGENTE_SESSION_ID_PATTERN.test(value);
}

function isValidAgenteBackendUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export type StreamingReadiness =
  | 'disabled'
  | 'invalid-url'
  | 'missing-session'
  | 'invalid-session'
  | 'ready';

/** Ordem de precedência fixa: disabled > invalid-url > missing-session > invalid-session > ready. */
export function getStreamingReadiness(config: AgenteConfig): StreamingReadiness {
  if (!config.streamingEnabled) return 'disabled';
  if (!isValidAgenteBackendUrl(config.agenteBackendUrl)) return 'invalid-url';
  if (config.agenteSessionId.length === 0) return 'missing-session';
  if (!isValidAgenteSessionId(config.agenteSessionId)) return 'invalid-session';
  return 'ready';
}

export function isStreamingReady(config: AgenteConfig): boolean {
  return getStreamingReadiness(config) === 'ready';
}

export interface ExtensionChunkRequest {
  url: string;
  init: RequestInit;
}

/**
 * Monta a requisição exata do contrato `ExtensionChunk`
 * (backend/app/routers/webhook.py) a partir da config e do texto novo de um
 * segmento. Função pura — nenhum `fetch` aqui.
 */
export function buildExtensionChunkRequest(
  config: AgenteConfig,
  chunk: { text: string; speaker: string | null },
): ExtensionChunkRequest {
  const url = `${config.agenteBackendUrl}${AGENTE_WEBHOOK_PATH}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.agenteApiKey.length > 0) {
    headers[AGENTE_KEY_HEADER] = config.agenteApiKey;
  }
  return {
    url,
    init: {
      method: 'POST',
      headers,
      body: JSON.stringify({
        session_id: config.agenteSessionId,
        text: chunk.text,
        speaker: chunk.speaker,
      }),
    },
  };
}
