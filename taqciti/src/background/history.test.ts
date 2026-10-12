/**
 * Histórico local (plano 08-13, Task 1): a evicção do teto de reuniões nunca apaga uma reunião
 * que ainda não foi para o Agente (modelo B, D-04) e leva junto a associação das removidas.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeStorageMock } from '@/test/chromeStorageMock';
import { selectRecordsToKeep, UNSENT_STATES } from '@/features/history/eviction';
import { MAX_HISTORY_RECORDS, STORAGE_KEYS } from '@/shared/config/constants';
import type { AssociationState } from '@/features/agente/association';
import type { MeetingRecord } from '@/shared/types/domain';

function makeRecord(index: number): MeetingRecord {
  return {
    id: `m${index}`,
    title: `Reunião ${index}`,
    startedAt: index * 1000,
    endedAt: index * 1000 + 500,
    durationSeconds: 1,
    participants: [],
    segments: [],
    status: 'ready',
    metadata: { capturedCaptions: true, droppedSegments: 0, reconnectCount: 0, wasDiscardedAndRestarted: false },
  };
}

/** `count` registros m1..m<count>, o m1 é o mais antigo. */
function makeHistory(count: number): MeetingRecord[] {
  return Array.from({ length: count }, (_, i) => makeRecord(i + 1)).reverse();
}

describe('selectRecordsToKeep', () => {
  const ids = (records: readonly { id: string }[]) => records.map((r) => r.id);

  it('100 + 1 sem proteção: mantém os 100 mais novos e evicta o mais antigo', () => {
    const { kept, evicted } = selectRecordsToKeep(makeHistory(101), 100, () => false);
    expect(kept).toHaveLength(100);
    expect(evicted).toEqual(['m1']);
  });

  it('o mais antigo protegido sobrevive e sai o mais antigo NÃO protegido', () => {
    const { kept, evicted } = selectRecordsToKeep(makeHistory(101), 100, (id) => id === 'm1');
    expect(ids(kept)).toContain('m1');
    expect(evicted).toEqual(['m2']);
    expect(kept).toHaveLength(100);
  });

  it('tudo protegido: mantém todos (teto suave) e não evicta nada', () => {
    const { kept, evicted } = selectRecordsToKeep(makeHistory(101), 100, () => true);
    expect(kept).toHaveLength(101);
    expect(evicted).toEqual([]);
  });

  it('preserva a ordem de entrada (mais recente primeiro)', () => {
    const input = makeHistory(101);
    const { kept } = selectRecordsToKeep(input, 100, (id) => id === 'm1');
    expect(ids(kept)).toEqual(ids(input).filter((id) => id !== 'm2'));
  });

  it('os sete estados não enviados estão protegidos; linked e sent não', () => {
    expect([...UNSENT_STATES].sort()).toEqual(
      ['choosing', 'deferred', 'ended-unsent', 'linking', 'pending', 'send-failed', 'sending'].sort(),
    );
    expect(UNSENT_STATES).not.toContain('linked');
    expect(UNSENT_STATES).not.toContain('sent');
  });
});

async function freshHistory(seed: MeetingRecord[], states: Record<string, AssociationState>) {
  const associations = Object.fromEntries(
    Object.entries(states).map(([id, state]) => [id, { meetingId: id, state }]),
  );
  const mock = installChromeStorageMock({
    local: {
      [STORAGE_KEYS.history]: seed,
      [STORAGE_KEYS.agenteAssociations]: associations,
    },
  });
  const history = await import('./history');
  return { mock, history };
}

describe('upsertRecord com evicção protegida', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('semente: 100 registros + 1 novo com o mais antigo ended-unsent — ele fica e sai o mais antigo enviado', async () => {
    const seed = makeHistory(MAX_HISTORY_RECORDS);
    const { mock, history } = await freshHistory(seed, {
      m1: 'ended-unsent',
      m2: 'sent',
      m3: 'linked',
    });
    await history.upsertRecord(makeRecord(101));

    const saved = (mock.local.values[STORAGE_KEYS.history] as MeetingRecord[]).map((r) => r.id);
    expect(saved).toHaveLength(MAX_HISTORY_RECORDS);
    expect(saved).toContain('m1');
    expect(saved).not.toContain('m2');
    expect(saved[0]).toBe('m101');
  });

  it('remove a associação das reuniões evictadas e mantém a das protegidas', async () => {
    const { mock, history } = await freshHistory(makeHistory(MAX_HISTORY_RECORDS), {
      m1: 'sent',
      m2: 'ended-unsent',
    });
    await history.upsertRecord(makeRecord(101));

    const map = mock.local.values[STORAGE_KEYS.agenteAssociations] as Record<string, unknown>;
    expect(map).not.toHaveProperty('m1');
    expect(map).toHaveProperty('m2');
  });

  it('reunião sem associação (anterior à Fase 8) é evictável', async () => {
    const { mock, history } = await freshHistory(makeHistory(MAX_HISTORY_RECORDS), {});
    await history.upsertRecord(makeRecord(101));

    const saved = (mock.local.values[STORAGE_KEYS.history] as MeetingRecord[]).map((r) => r.id);
    expect(saved).toHaveLength(MAX_HISTORY_RECORDS);
    expect(saved).not.toContain('m1');
  });
});
