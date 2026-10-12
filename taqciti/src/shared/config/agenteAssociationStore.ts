/**
 * Onde moram as associações reunião → sessão do Agente (Fase 8, TAQ-02, D-01/D-12): um mapa
 * `meetingId → MeetingAssociation` na chave própria `taq:agenteAssociations` de `storage.local`.
 *
 * ESCRITOR ÚNICO = o service worker, sempre com o VALOR INTEIRO e por uma fila serializada: duas
 * aplicações simultâneas nunca se apagam e a segunda enxerga o resultado da primeira (mesmo padrão
 * de `patchAgenteConfig`). O mapa fica em cache na memória, atualizado na mesma operação que grava —
 * o streamer lê o cache, nunca um `onChanged` atrasado. Os painéis só LEEM, por `subscribeAssociations`.
 * Fica de fora de `taq:history` de propósito: aquele read-modify-write sem fila repetiria o WR-01 da Fase 7.
 *
 * Nada de segredo aqui: `normalizeAssociations` reconstrói cada entrada só com os campos conhecidos.
 */
import type { Unsubscribe } from '@/shared/types/domain';
import {
  ASSOCIATION_ERRORS,
  ASSOCIATION_ORIGINS,
  ASSOCIATION_STATES,
  reduceAssociation,
  type AssociationEvent,
  type MeetingAssociation,
  type SeedSent,
} from '@/features/agente/association';
import { onLocalChange, readLocal, writeLocal } from '@/shared/services/storage';
import { STORAGE_KEYS } from './constants';

export type AssociationMap = Readonly<Record<string, MeetingAssociation>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** `{}` é semente válida ("nada enviado ainda"); só um valor que não é objeto vira "sem semente". */
function normalizeSeed(raw: unknown): SeedSent | undefined {
  if (!isRecord(raw)) return undefined;
  const seed: Record<string, number> = {};
  for (const [key, count] of Object.entries(raw)) {
    if (isCount(count)) seed[key] = count;
  }
  return seed;
}

/** Campos do encerramento (B4-b): `true` só vale como `true`; prazo e tentativas, inteiros >= 0. */
function normalizeClose(entry: MeetingAssociation, raw: Record<string, unknown>): void {
  if (raw.sessionFinished === true) entry.sessionFinished = true;
  if (isCount(raw.finishBy)) entry.finishBy = raw.finishBy;
  if (isCount(raw.finishTries)) entry.finishTries = raw.finishTries;
  if (raw.finishGaveUp === true) entry.finishGaveUp = true;
}

function normalizeEntry(key: string, raw: unknown): MeetingAssociation | null {
  if (!isRecord(raw) || raw.meetingId !== key) return null;
  const state = ASSOCIATION_STATES.find((candidate) => candidate === raw.state);
  if (state === undefined) return null;

  const entry: MeetingAssociation = { meetingId: key, state };
  if (typeof raw.clientName === 'string') entry.clientName = raw.clientName;
  if (typeof raw.sessionId === 'string') entry.sessionId = raw.sessionId;
  const origin = ASSOCIATION_ORIGINS.find((candidate) => candidate === raw.origin);
  if (origin !== undefined) entry.origin = origin;
  const error = ASSOCIATION_ERRORS.find((candidate) => candidate === raw.error);
  if (error !== undefined) entry.error = error;
  if (isRecord(raw.sendProgress) && isCount(raw.sendProgress.done) && isCount(raw.sendProgress.total)) {
    entry.sendProgress = { done: raw.sendProgress.done, total: raw.sendProgress.total };
  }
  const seedSent = normalizeSeed(raw.seedSent);
  if (seedSent !== undefined) entry.seedSent = seedSent;
  normalizeClose(entry, raw);
  return entry;
}

/** Valor salvo -> mapa válido; ausente ou malformado vira `{}`. Lista branca de campos (T-08-02). */
export function normalizeAssociations(raw: unknown): AssociationMap {
  if (!isRecord(raw)) return {};
  const map: Record<string, MeetingAssociation> = {};
  for (const [key, value] of Object.entries(raw)) {
    const entry = normalizeEntry(key, value);
    if (entry !== null) map[key] = entry;
  }
  return map;
}

let cache: Promise<AssociationMap> | null = null;
let queue: Promise<unknown> = Promise.resolve();

/** Carrega o storage uma única vez; se a leitura falhar, a próxima chamada tenta de novo. */
function ensureLoaded(): Promise<AssociationMap> {
  if (cache === null) {
    cache = readLocal<unknown>(STORAGE_KEYS.agenteAssociations).then(normalizeAssociations);
    cache.catch(() => {
      cache = null;
    });
  }
  return cache;
}

/** Fila única de escrita: cada operação espera a anterior (e sobrevive à falha dela). */
function enqueue<T>(run: () => Promise<T>): Promise<T> {
  const next = queue.catch(() => undefined).then(run);
  queue = next;
  return next;
}

/** Grava o mapa INTEIRO e só então troca o cache — gravação que falha não deixa o cache à frente do storage. */
async function commit(next: AssociationMap): Promise<void> {
  await writeLocal(STORAGE_KEYS.agenteAssociations, next);
  cache = Promise.resolve(next);
}

export function loadAssociations(): Promise<AssociationMap> {
  return ensureLoaded();
}

export async function getAssociation(meetingId: string): Promise<MeetingAssociation | null> {
  return (await ensureLoaded())[meetingId] ?? null;
}

export interface ApplyResult {
  applied: boolean;
  association: MeetingAssociation | null;
}

/** Aplica o evento à associação da reunião; só grava quando o reducer mudou alguma coisa. */
export function applyAssociationEvent(meetingId: string, event: AssociationEvent): Promise<ApplyResult> {
  return enqueue(async () => {
    const map = await ensureLoaded();
    const current = map[meetingId] ?? null;
    const next = reduceAssociation(current, meetingId, event);
    if (next === current) return { applied: false, association: current };
    const updated: Record<string, MeetingAssociation> = { ...map };
    if (next === null) delete updated[meetingId];
    else updated[meetingId] = next;
    await commit(updated);
    return { applied: true, association: next };
  });
}

/** Remove as associações pedidas (descartar um cliente, limpeza de reuniões antigas). */
export function removeAssociations(meetingIds: readonly string[]): Promise<void> {
  return enqueue(async () => {
    const map = await ensureLoaded();
    const updated: Record<string, MeetingAssociation> = { ...map };
    let changed = false;
    for (const id of meetingIds) {
      if (id in updated) {
        delete updated[id];
        changed = true;
      }
    }
    if (changed) await commit(updated);
  });
}

export function removeAssociation(meetingId: string): Promise<void> {
  return removeAssociations([meetingId]);
}

/** A semente já foi adotada pelo streamer: some do storage, para um reinício não reaproveitá-la. */
export async function clearSeed(meetingId: string): Promise<void> {
  await applyAssociationEvent(meetingId, { type: 'seed-consumed' });
}

/**
 * Para os painéis (só leitura): entrega o mapa atual logo de cara e depois a cada mudança. Se um
 * `onChanged` chegar antes da leitura inicial resolver, a leitura já está velha e é descartada.
 */
export function subscribeAssociations(listener: (map: AssociationMap) => void): Unsubscribe {
  let live = true;
  let gotChange = false;

  void readLocal<unknown>(STORAGE_KEYS.agenteAssociations).then((raw) => {
    if (live && !gotChange) listener(normalizeAssociations(raw));
  });
  const stop = onLocalChange<unknown>(STORAGE_KEYS.agenteAssociations, (raw) => {
    if (!live) return;
    gotChange = true;
    listener(normalizeAssociations(raw));
  });
  return () => {
    live = false;
    stop();
  };
}
