/**
 * Plano puro do envio em partes (D-10, D-12) — sem `chrome`, `fetch` nem timers.
 *
 * Quando uma reunião inteira precisa ir ao Agente de uma vez (a guardada, no fim — D-09; ou
 * "tudo o que já foi falado", quando o cliente é escolhido no meio — D-12), ela vira uma lista
 * de PARTES, na ordem em que foi falada: uma por segmento com texto. Quem manda as partes, de
 * uma em uma e com pausa entre blocos, é o `meetingUploadRunner.ts`.
 *
 * O id de cada parte é DETERMINÍSTICO (`bulk:{meetingId}:{índice}`): os segmentos não mudam
 * depois do fim da reunião, então retomar um envio interrompido recria exatamente os mesmos ids
 * (base para a idempotência da decisão B3; o envio do id no corpo da requisição fica para o 08-19).
 *
 * A chave de cada parte é a MESMA do cursor do streamer (`segmentKey`), por isso `seedFromParts`
 * pode ser entregue ao streamer como semente: ele continua dali sem perder nem repetir palavras.
 */
import type { LiveSegment } from '@/shared/types/domain';
import { segmentKey, splitWords } from './wordDelta';

/**
 * Partes enviadas antes de uma pausa. SUPOSIÇÃO A3 do RESEARCH: o backend nunca recebeu rajada;
 * o valor é validado no teste manual D-20(a) e pode ser ajustado ali.
 */
export const AGENTE_UPLOAD_BLOCK_SIZE = 20;

/** Pausa entre blocos, em ms. Também suposição A3 — validar no D-20(a). */
export const AGENTE_UPLOAD_PAUSE_MS = 1_000;

export interface UploadPart {
  /** Posição do segmento na reunião (não é renumerada quando um segmento vazio é pulado). */
  index: number;
  /** Chave do cursor do streamer: `${índice}:${captionId}`. */
  key: string;
  /** Id estável da parte: `bulk:{meetingId}:{índice}`. */
  chunkId: string;
  text: string;
  speaker: string | null;
  /** Palavras do texto — o que a semente informa ao streamer. */
  words: number;
  /**
   * Só nas partes de reposição (`planCatchUp`): quantas palavras do segmento já tinham sido entregues antes.
   * `text` traz apenas o que falta e o `chunkId` leva o sufixo `:{wordsFrom}`.
   */
  wordsFrom?: number;
}

export function bulkChunkId(meetingId: string, index: number): string {
  return `bulk:${meetingId}:${index}`;
}

/** Uma parte por segmento com texto, na ordem da reunião; segmento sem palavras é pulado. */
export function planMeetingUpload(
  meetingId: string,
  segments: readonly LiveSegment[],
): UploadPart[] {
  const parts: UploadPart[] = [];

  segments.forEach((segment, index) => {
    const text = segment.text.trim();
    const words = splitWords(text).length;
    if (words === 0) return;

    parts.push({
      index,
      key: segmentKey(segment, index),
      chunkId: bulkChunkId(meetingId, index),
      text,
      speaker: segment.speaker,
      words,
    });
  });

  return parts;
}

/**
 * Reposição (WR-04): o que falta de cada segmento que cresceu DEPOIS de parte dele ter sido entregue.
 * `sentWords` é o que o envio parado confirmou por chave; segmento sem entrada (ou já completo) não gera parte.
 * O `chunk_id` ganha o sufixo `:{palavras já entregues}` — sem ele o backend, que só deduplica pela string do id,
 * descartaria a reposição como se fosse a parte original.
 */
export function planCatchUp(
  parts: readonly UploadPart[],
  sentWords: Readonly<Record<string, number>>,
): UploadPart[] {
  const catchUp: UploadPart[] = [];
  for (const part of parts) {
    const from = sentWords[part.key];
    const words = splitWords(part.text);
    if (from === undefined || from >= words.length) continue;
    const rest = words.slice(from);
    catchUp.push({
      ...part,
      chunkId: `${part.chunkId}:${from}`,
      text: rest.join(' '),
      words: rest.length,
      wordsFrom: from,
    });
  }
  return catchUp;
}

/** Palavras cobertas pelo envio, por chave de segmento — a semente do cursor do streamer (D-12). */
export function seedFromParts(parts: readonly UploadPart[]): Record<string, number> {
  const seed: Record<string, number> = {};
  for (const part of parts) {
    seed[part.key] = (part.wordsFrom ?? 0) + part.words;
  }
  return seed;
}
