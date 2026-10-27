/**
 * Plano puro do envio em partes (D-10, D-12): uma parte por segmento com texto,
 * id determinístico e a semente que casa com o cursor do streamer.
 */
import { describe, expect, it } from 'vitest';
import type { LiveSegment } from '@/shared/types/domain';
import {
  AGENTE_UPLOAD_BLOCK_SIZE,
  AGENTE_UPLOAD_PAUSE_MS,
  bulkChunkId,
  planCatchUp,
  planMeetingUpload,
  seedFromParts,
} from './meetingUploader';
import { segmentKey } from './wordDelta';

function segment(overrides: Partial<LiveSegment> = {}): LiveSegment {
  return {
    captionId: 'c1',
    speaker: 'Ana',
    text: 'olá',
    startOffsetMs: 0,
    endOffsetMs: 0,
    ...overrides,
  };
}

const s0 = segment({ captionId: 'c0', text: 'olá tudo bem', speaker: 'Ana' });
const s1 = segment({ captionId: 'c1', text: '   ', speaker: 'Bia' });
const s2 = segment({ captionId: 'c2', text: 'segunda fala', speaker: null });

describe('constantes de pacing', () => {
  it('usa blocos de 20 partes com pausa de 1 s (suposição A3 do RESEARCH)', () => {
    expect(AGENTE_UPLOAD_BLOCK_SIZE).toBe(20);
    expect(AGENTE_UPLOAD_PAUSE_MS).toBe(1000);
  });
});

describe('planMeetingUpload', () => {
  it('pula segmento vazio sem renumerar o índice e conta as palavras', () => {
    const parts = planMeetingUpload('m1', [s0, s1, s2]);

    expect(parts).toHaveLength(2);
    expect(parts[0]).toEqual({
      index: 0,
      key: segmentKey(s0, 0),
      chunkId: 'bulk:m1:0',
      text: 'olá tudo bem',
      speaker: 'Ana',
      words: 3,
    });
    expect(parts[1]).toEqual({
      index: 2,
      key: segmentKey(s2, 2),
      chunkId: 'bulk:m1:2',
      text: 'segunda fala',
      speaker: null,
      words: 2,
    });
  });

  it('mantém a ordem dos segmentos e preserva o falante', () => {
    const parts = planMeetingUpload('m1', [s2, s0]);

    expect(parts.map((part) => part.index)).toEqual([0, 1]);
    expect(parts.map((part) => part.speaker)).toEqual([null, 'Ana']);
    expect(parts.map((part) => part.text)).toEqual(['segunda fala', 'olá tudo bem']);
  });

  it('usa trim no texto da parte', () => {
    const [part] = planMeetingUpload('m1', [segment({ text: '  oi   mundo \n' })]);

    expect(part?.text).toBe('oi   mundo');
    expect(part?.words).toBe(2);
  });

  it('devolve lista vazia para reunião sem segmentos', () => {
    expect(planMeetingUpload('m1', [])).toEqual([]);
  });
});

describe('seedFromParts', () => {
  it('devolve por chave de segmento quantas palavras o envio cobriu', () => {
    const seed = seedFromParts(planMeetingUpload('m1', [s0, s1, s2]));

    expect(seed).toEqual({
      [segmentKey(s0, 0)]: 3,
      [segmentKey(s2, 2)]: 2,
    });
  });

  it('devolve objeto vazio para um plano vazio', () => {
    expect(seedFromParts([])).toEqual({});
  });
});

describe('bulkChunkId', () => {
  it('é determinístico: mesma reunião e mesmo índice dão o mesmo id', () => {
    expect(bulkChunkId('m1', 7)).toBe('bulk:m1:7');
    expect(bulkChunkId('m1', 7)).toBe(bulkChunkId('m1', 7));
    expect(bulkChunkId('m1', 8)).not.toBe(bulkChunkId('m1', 7));
  });
});

describe('planCatchUp (WR-04)', () => {
  const grown = segment({ captionId: 'c0', text: 'olá tudo bem com você hoje', speaker: 'Ana' }); // 6 palavras
  const parts = planMeetingUpload('m1', [grown, s2]);

  it('manda só as palavras que faltam, com chunk_id próprio e a mesma chave/índice', () => {
    const [part] = planCatchUp(parts, { [segmentKey(grown, 0)]: 3 });

    expect(part).toEqual({
      index: 0,
      key: segmentKey(grown, 0),
      chunkId: 'bulk:m1:0:3',
      text: 'com você hoje',
      speaker: 'Ana',
      words: 3,
      wordsFrom: 3,
    });
    expect(part?.chunkId).not.toBe(parts[0]?.chunkId); // senão o backend descartaria como duplicata
  });

  it('segmento completo, sem entrada ou além do tamanho não gera reposição', () => {
    expect(planCatchUp(parts, { [segmentKey(grown, 0)]: 6, [segmentKey(s2, 1)]: 99 })).toEqual([]);
    expect(planCatchUp(parts, {})).toEqual([]);
  });

  it('a semente da reposição conta as palavras já entregues + as novas (= o texto inteiro)', () => {
    const catchUp = planCatchUp(parts, { [segmentKey(grown, 0)]: 3 });
    expect(seedFromParts(catchUp)).toEqual({ [segmentKey(grown, 0)]: 6 });
  });
});
