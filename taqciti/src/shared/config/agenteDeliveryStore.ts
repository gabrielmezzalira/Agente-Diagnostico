/**
 * Status de entrega ao Agente e rastro de falas descartadas (Fase 8, TAQ-02, D-18), ambos em
 * `chrome.storage.local` e NUNCA em `storage.session`: o content script do Meet não lê
 * `storage.session` (Pitfall 3), e o aviso "fora do ar, 5 falas na fila" nunca apareceria no painel.
 *
 * Duas chaves, cada uma com UM dono (mesmo padrão do WR-02 da Fase 7). O dono é o service worker:
 * - `taq:agenteDelivery`: o estado de agora (ok / offline / failed / rejected, falas na fila,
 *   estouro, quando voltou); escrita direta do valor inteiro, sem ler antes;
 * - `taq:agenteDropTrace`: o rastro de falas que a Taqciti desistiu de entregar. `writeDelivery`
 *   NUNCA toca essa chave — o próximo "ok" não pode apagar o rastro (T-08-44, decisão B3-b). Só uma
 *   queda numa sessão DIFERENTE recomeça a contagem.
 *
 * Só metadados: nem a chave `x-agente-key` nem texto de fala têm campo aqui (T-08-20).
 */
import type { Unsubscribe } from '@/shared/types/domain';
import { onLocalChange, readLocal, writeLocal } from '@/shared/services/storage';
import { STORAGE_KEYS } from './constants';

export type DeliveryStatus = 'ok' | 'offline' | 'failed' | 'rejected';

export interface AgenteDelivery {
  status: DeliveryStatus;
  /** Falas esperando entrega na fila durável. */
  queued: number;
  /** Falas novas recusadas porque a fila estava cheia. */
  overflow: number;
  /** HTTP da última tentativa; `null` = erro de rede (ou nenhum envio ainda). */
  httpStatus: number | null;
  /** epoch ms de quando o Agente voltou depois de uma queda; `null` = não houve. */
  recoveredAt: number | null;
}

export const EMPTY_DELIVERY: AgenteDelivery = {
  status: 'ok',
  queued: 0,
  overflow: 0,
  httpStatus: null,
  recoveredAt: null,
};

export type DropReason = 'failed' | 'rejected' | 'overflow';

export interface AgenteDropTrace {
  /** Sessão a que o rastro se refere; `null` = nenhuma fala descartada. */
  sessionId: string | null;
  count: number;
  lastAt: number | null;
  lastReason: DropReason | null;
  lastHttpStatus: number | null;
}

export const EMPTY_DROP_TRACE: AgenteDropTrace = {
  sessionId: null,
  count: 0,
  lastAt: null,
  lastReason: null,
  lastHttpStatus: null,
};

/** Uma queda de fala(s) a anotar no rastro. */
export interface AgenteDrop {
  sessionId: string;
  count: number;
  reason: DropReason;
  httpStatus: number | null;
  at: number;
}

const STATUSES: readonly DeliveryStatus[] = ['ok', 'offline', 'failed', 'rejected'];
const REASONS: readonly DropReason[] = ['failed', 'rejected', 'overflow'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function countOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Valor salvo -> status válido; lista branca de campos, status desconhecido vira `EMPTY_DELIVERY`. */
export function normalizeDelivery(raw: unknown): AgenteDelivery {
  if (!isRecord(raw)) return EMPTY_DELIVERY;
  const status = STATUSES.find((candidate) => candidate === raw.status);
  if (status === undefined) return EMPTY_DELIVERY;
  return {
    status,
    queued: countOrZero(raw.queued),
    overflow: countOrZero(raw.overflow),
    httpStatus: numberOrNull(raw.httpStatus),
    recoveredAt: numberOrNull(raw.recoveredAt),
  };
}

/** Valor salvo -> rastro válido; lista branca de 5 campos (sem texto de fala, sem chave). */
export function normalizeDropTrace(raw: unknown): AgenteDropTrace {
  if (!isRecord(raw) || typeof raw.sessionId !== 'string' || raw.sessionId.length === 0) {
    return EMPTY_DROP_TRACE;
  }
  const count = countOrZero(raw.count);
  if (count === 0) return EMPTY_DROP_TRACE;
  return {
    sessionId: raw.sessionId,
    count,
    lastAt: numberOrNull(raw.lastAt),
    lastReason: REASONS.find((candidate) => candidate === raw.lastReason) ?? null,
    lastHttpStatus: numberOrNull(raw.lastHttpStatus),
  };
}

/**
 * Para os painéis (só leitura): valor atual logo de cara e depois a cada mudança. Se um `onChanged`
 * chegar antes da leitura inicial resolver, a leitura já está velha e é descartada.
 */
function subscribeNormalized<T>(
  key: string,
  normalize: (raw: unknown) => T,
  fallback: T,
  listener: (value: T) => void,
): Unsubscribe {
  let live = true;
  let gotChange = false;

  readLocal<unknown>(key)
    .then((raw) => {
      if (live && !gotChange) listener(normalize(raw));
    })
    .catch(() => {
      if (live && !gotChange) listener(fallback);
    });
  const stop = onLocalChange<unknown>(key, (raw) => {
    if (!live) return;
    gotChange = true;
    listener(normalize(raw));
  });
  return () => {
    live = false;
    stop();
  };
}

export async function loadDelivery(): Promise<AgenteDelivery> {
  return normalizeDelivery(await readLocal<unknown>(STORAGE_KEYS.agenteDelivery));
}

/** Escritor único = service worker; valor inteiro, sem ler antes. Nunca escreve o rastro. */
export function writeDelivery(record: AgenteDelivery): Promise<void> {
  return writeLocal(STORAGE_KEYS.agenteDelivery, normalizeDelivery(record));
}

export function subscribeDelivery(listener: (delivery: AgenteDelivery) => void): Unsubscribe {
  return subscribeNormalized(STORAGE_KEYS.agenteDelivery, normalizeDelivery, EMPTY_DELIVERY, listener);
}

export async function loadDropTrace(): Promise<AgenteDropTrace> {
  return normalizeDropTrace(await readLocal<unknown>(STORAGE_KEYS.agenteDropTrace));
}

export function subscribeDropTrace(listener: (trace: AgenteDropTrace) => void): Unsubscribe {
  return subscribeNormalized(STORAGE_KEYS.agenteDropTrace, normalizeDropTrace, EMPTY_DROP_TRACE, listener);
}

/** Fila única de escrita do rastro: duas quedas seguidas nunca se apagam (padrão do store de associações). */
let dropQueue: Promise<unknown> = Promise.resolve();

/**
 * Anota falas que a Taqciti desistiu de entregar. Mesma sessão soma a contagem; outra sessão
 * recomeça com a contagem nova; `lastAt`/`lastReason`/`lastHttpStatus` são sempre os da última queda.
 */
export function recordDroppedUtterances(drop: AgenteDrop): Promise<void> {
  if (!Number.isInteger(drop.count) || drop.count <= 0) return Promise.resolve();
  const next = dropQueue.catch(() => undefined).then(async () => {
    const current = await loadDropTrace();
    const sameSession = current.sessionId === drop.sessionId;
    const trace: AgenteDropTrace = {
      sessionId: drop.sessionId,
      count: (sameSession ? current.count : 0) + drop.count,
      lastAt: drop.at,
      lastReason: drop.reason,
      lastHttpStatus: drop.httpStatus,
    };
    await writeLocal(STORAGE_KEYS.agenteDropTrace, trace);
  });
  dropQueue = next;
  return next;
}
