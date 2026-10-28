/**
 * O que o painel "AGP" lê (Fase 10, TAQ-05): a sessão que o service worker está seguindo, o estado da conexão
 * e as perguntas espelhadas do Agente. Em `chrome.storage.local` (o content script do Meet não lê
 * `storage.session`, Pitfall 3). Escritor único = service worker (`background/agpQuestionsFeed.ts`); a UI só
 * assina. Lista branca de campos: nenhuma chave nem fala de reunião tem lugar aqui.
 */
import { toAgpQuestion, type AgpQuestion } from '@/features/agente/agpQuestions';
import { readLocal, writeLocal } from '@/shared/services/storage';
import type { Unsubscribe } from '@/shared/types/domain';
import { subscribeNormalized } from './agenteDeliveryStore';
import { STORAGE_KEYS } from './constants';

/** `idle` = sem sessão-alvo (nada vinculado ou reunião fora do ar); `reconnecting` = a conexão caiu e vai de novo. */
export type AgpConnection = 'idle' | 'connecting' | 'live' | 'reconnecting';

export interface AgpFeed {
  /** Sessão seguida agora; `null` = nenhuma (o painel mostra o aviso de vínculo). */
  sessionId: string | null;
  connection: AgpConnection;
  questions: readonly AgpQuestion[];
}

export const EMPTY_AGP_FEED: AgpFeed = { sessionId: null, connection: 'idle', questions: [] };

const CONNECTIONS: readonly AgpConnection[] = ['idle', 'connecting', 'live', 'reconnecting'];

/** Valor salvo -> estado válido; sem sessão nunca há pergunta (nunca mostra de sessão "esquecida"). */
export function normalizeAgpFeed(raw: unknown): AgpFeed {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return EMPTY_AGP_FEED;
  const record = raw as Record<string, unknown>;
  const sessionId = typeof record.sessionId === 'string' && record.sessionId.length > 0 ? record.sessionId : null;
  if (sessionId === null) return EMPTY_AGP_FEED;
  const connection = CONNECTIONS.find((candidate) => candidate === record.connection) ?? 'idle';
  const list = Array.isArray(record.questions) ? record.questions : [];
  const questions = list.map(toAgpQuestion).filter((q): q is AgpQuestion => q !== null);
  return { sessionId, connection, questions };
}

export async function loadAgpFeed(): Promise<AgpFeed> {
  return normalizeAgpFeed(await readLocal<unknown>(STORAGE_KEYS.agpQuestions));
}

/** Escritor único = service worker; valor inteiro, sem ler antes. */
export function writeAgpFeed(feed: AgpFeed): Promise<void> {
  return writeLocal(STORAGE_KEYS.agpQuestions, normalizeAgpFeed(feed));
}

/** Para os painéis (só leitura): valor atual logo de cara e depois a cada mudança. */
export function subscribeAgpFeed(listener: (feed: AgpFeed) => void): Unsubscribe {
  return subscribeNormalized(STORAGE_KEYS.agpQuestions, normalizeAgpFeed, EMPTY_AGP_FEED, listener);
}
