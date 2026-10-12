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

/**
 * Hosts onde `http:` sem TLS é aceitável — só loopback (dev local). Em
 * qualquer outro host, `http:` expõe a chave `x-agente-key` e a transcrição
 * da reunião em texto puro na rede (WR-06).
 */
const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Extrai o hostname de um trecho "host[:porta]" sem protocolo. */
function extractHostname(hostAndMaybePort: string): string {
  try {
    return new URL(`http://${hostAndMaybePort}`).hostname;
  } catch {
    return '';
  }
}

function isLoopbackHostname(hostname: string): boolean {
  return LOOPBACK_HOSTNAMES.has(hostname);
}

/** Esquema digitado de forma explícita: `algo://`. */
const EXPLICIT_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;

/**
 * Normaliza a URL do backend do Agente — mesmo padrão de
 * `extension/background.js::normalizeUrl` (trim, remove barras finais,
 * prefixa protocolo quando falta). String vazia continua vazia (quem chama
 * decide o fallback — ver `normalizeAgenteConfig`).
 *
 * WR-06: o prefixo é `http://` só para host de loopback (para não quebrar o
 * dev local digitando `localhost:8000`) — qualquer outro host sem protocolo
 * vira `https://`, para não mandar credencial em texto puro por engano.
 */
export function normalizeAgenteBackendUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  // IN-03: esquema explícito (http, https ou qualquer outro, ex.: ftp://) fica
  // como foi digitado — nunca ganha prefixo. Quem recusa os esquemas que não
  // são http/https é `isValidAgenteBackendUrl`. `localhost:8000` não tem "://".
  if (trimmed.length === 0 || EXPLICIT_SCHEME_PATTERN.test(trimmed)) {
    return trimmed;
  }
  const scheme = isLoopbackHostname(extractHostname(trimmed)) ? 'http://' : 'https://';
  return `${scheme}${trimmed}`;
}

/*
 * WR-03: o padrão da build passa pela mesma normalização da URL salva (barra
 * no fim, espaço, protocolo faltando). As helpers acima precisam vir ANTES
 * desta constante: `const` no escopo do módulo fica em zona morta até a linha
 * em que é declarada, e esta linha já as chama na avaliação do módulo.
 */
export const AGENTE_BACKEND_URL_DEFAULT =
  normalizeAgenteBackendUrl(import.meta.env.VITE_AGENTE_BACKEND_URL ?? '') || 'http://localhost:8000';

// D-09: streaming desligado por padrão — ninguém é afetado até decidir ligar.
export const AGENTE_STREAMING_ENABLED_DEFAULT =
  (import.meta.env.VITE_AGENTE_STREAMING_ENABLED ?? 'false') === 'true';

/** Espelha backend/app/routers/webhook.py — header do gate opcional (D-10). */
export const AGENTE_KEY_HEADER = 'x-agente-key';

/** Espelha backend/app/routers/webhook.py — rota do contrato ExtensionChunk. */
export const AGENTE_WEBHOOK_PATH = '/webhook/extension';

/** Timeout do fetch de streaming — nunca deixa uma chamada lenta acumular. */
export const AGENTE_REQUEST_TIMEOUT_MS = 10_000;

/**
 * Janela do envio ao Agente, desacoplada do agrupamento de 250 ms da Taqciti
 * (que existe só para custo de gravação local — ver STATE_FLUSH_INTERVAL_MS em
 * constants.ts). Uma fala só é enviada depois de ficar este tempo sem palavra
 * nova (G-07-1/G-07-2, D-06 refinado na Task 1 do plano 07-04).
 */
export const AGENTE_PHRASE_QUIET_MS = 1500;

/**
 * Teto de espera: mesmo em fala contínua (sem silêncio), o texto pendente sai
 * no máximo depois deste tempo — garante que a tela continue "ao vivo" (SC1)
 * mesmo quando a pessoa fala sem pausar (G-07-2, D-06 refinado na Task 1 do
 * plano 07-04).
 */
export const AGENTE_PHRASE_MAX_WAIT_MS = 5_000;

export interface AgenteConfig {
  agenteBackendUrl: string;
  streamingEnabled: boolean;
  /** Colado manualmente (D-04) até a Fase 8 trazer o auto-detect. */
  agenteSessionId: string;
  /** Vazio = nenhum header x-agente-key enviado (D-10). Nunca tem padrão de build. */
  agenteApiKey: string;
  /** Reunião nova confirmada como continuação da mesma sessão (CR-01). Vazio = nenhuma. */
  confirmedMeetingId: string;
}

export const DEFAULT_AGENTE_CONFIG: AgenteConfig = {
  agenteBackendUrl: AGENTE_BACKEND_URL_DEFAULT,
  streamingEnabled: AGENTE_STREAMING_ENABLED_DEFAULT,
  agenteSessionId: '',
  agenteApiKey: '',
  confirmedMeetingId: '',
};

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

  const confirmedMeetingId =
    typeof source.confirmedMeetingId === 'string' ? source.confirmedMeetingId : '';

  return {
    agenteBackendUrl,
    streamingEnabled,
    agenteSessionId,
    agenteApiKey,
    confirmedMeetingId,
  };
}

const AGENTE_SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** session_id precisa ter formato UUID (validação de entrada, ASVS V5). */
export function isValidAgenteSessionId(value: string): boolean {
  return AGENTE_SESSION_ID_PATTERN.test(value);
}

/**
 * WR-06: `http:` só é válido para loopback — em qualquer outro host, a
 * chave `x-agente-key` e a transcrição da reunião trafegariam sem TLS.
 *
 * IN-03: a URL é só a base do backend (o caminho do webhook é acrescentado
 * depois), então query (`?a=b`) e fragmento (`#x`) são recusados — senão o
 * caminho acabaria colado no meio deles. Só http/https passam.
 */
export function isValidAgenteBackendUrl(url: string): boolean {
  if (url.includes('?') || url.includes('#')) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:') return true;
    return parsed.protocol === 'http:' && isLoopbackHostname(parsed.hostname);
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
