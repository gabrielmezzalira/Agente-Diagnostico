/**
 * Repositório do histórico de reuniões em chrome.storage.local — a fonte da
 * verdade das transcrições. Registros ordenados do mais recente para o mais
 * antigo, com teto de tamanho. Statuses de eras anteriores da extensão
 * ("pending", "ignored", "discarded", "sent") são normalizados para "ready"
 * na leitura: nenhuma transcrição antiga se perde na migração.
 */
import type { HistoryStatus, MeetingRecord } from '@/shared/types/domain';
import { MAX_HISTORY_RECORDS, STORAGE_KEYS } from '@/shared/config/constants';
import { loadAssociations, removeAssociations } from '@/shared/config/agenteAssociationStore';
import { UNSENT_STATES, selectRecordsToKeep } from '@/features/history/eviction';
import { logger } from '@/shared/services/log';
import { readLocal, writeLocal } from '@/shared/services/storage';

const VALID_STATUSES: readonly HistoryStatus[] = ['recording', 'ready'];

function normalizeRecord(record: MeetingRecord): MeetingRecord {
  if ((VALID_STATUSES as readonly string[]).includes(record.status)) return record;
  return { ...record, status: 'ready' };
}

export async function listHistory(): Promise<MeetingRecord[]> {
  const raw = (await readLocal<MeetingRecord[]>(STORAGE_KEYS.history)) ?? [];
  return raw.map(normalizeRecord);
}

/**
 * Quem a evicção não pode tocar: reunião cuja associação ainda não foi enviada (modelo B, D-04).
 * As associações vêm do cache do store (sem nova leitura de storage a cada gravação). Se não der
 * para lê-las, protege TUDO — melhor passar do teto por um instante do que apagar às cegas.
 */
async function loadProtectionRule(): Promise<(id: string) => boolean> {
  try {
    const associations = await loadAssociations();
    return (id) => {
      const state = associations[id]?.state;
      return state !== undefined && UNSENT_STATES.includes(state);
    };
  } catch (error) {
    logger.error('ler as associações para a evicção falhou — nada será removido', error);
    return () => true;
  }
}

export async function upsertRecord(record: MeetingRecord): Promise<void> {
  const history = await listHistory();
  const previous = history.find((item) => item.id === record.id);
  const merged = previous ? { ...previous, ...record } : record;
  const without = history.filter((r) => r.id !== record.id);
  const sorted = [merged, ...without].sort((a, b) => b.startedAt - a.startedAt);
  // Modelo B: reunião não enviada nunca é evictada (teto suave); só enviadas/sem associação saem.
  const { kept, evicted } = selectRecordsToKeep(
    sorted,
    MAX_HISTORY_RECORDS,
    await loadProtectionRule(),
  );
  await writeLocal(STORAGE_KEYS.history, kept);
  if (evicted.length > 0) {
    await removeAssociations(evicted).catch((error: unknown) =>
      logger.error('limpar a associação das reuniões evictadas falhou', error),
    );
  }
}

export async function getRecord(id: string): Promise<MeetingRecord | null> {
  const history = await listHistory();
  return history.find((r) => r.id === id) ?? null;
}

export async function patchRecord(
  id: string,
  patch: Partial<Pick<MeetingRecord, 'title' | 'status'>>,
): Promise<void> {
  const history = await listHistory();
  const next = history.map((r) => (r.id === id ? { ...r, ...patch } : r));
  await writeLocal(STORAGE_KEYS.history, next);
}

export async function deleteRecord(id: string): Promise<void> {
  const history = await listHistory();
  await writeLocal(
    STORAGE_KEYS.history,
    history.filter((r) => r.id !== id),
  );
}

/**
 * Registros presos em "recording" que não são a sessão viva (navegador caiu
 * no meio da reunião) viram "ready": a transcrição capturada até a queda
 * fica disponível no histórico — nada se perde.
 */
export async function finalizeStaleRecordings(liveMeetingId: string | null): Promise<void> {
  const history = await listHistory();
  let changed = false;
  const next = history.map((r) => {
    if (r.status === 'recording' && r.id !== liveMeetingId) {
      changed = true;
      return { ...r, status: 'ready' as const };
    }
    return r;
  });
  if (changed) await writeLocal(STORAGE_KEYS.history, next);
}
