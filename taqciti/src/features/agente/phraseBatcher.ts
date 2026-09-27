/**
 * Política pura da janela de agrupamento por fala (Fase 7, plano 07-04, G-07-1/
 * G-07-2, D-06 refinado): o flush de 250 ms (`STATE_FLUSH_INTERVAL_MS`,
 * `constants.ts`) é controle de custo da gravação local da Taqciti — persistir
 * e retransmitir o estado inteiro a cada legenda. O envio ao Agente precisa de
 * granularidade de FALA, não de flush, então as palavras novas de cada
 * segmento (já calculadas, uma única vez, por `wordDelta.ts`) ficam aqui num
 * buffer até a fala terminar (silêncio), atingir o teto de espera, ou a
 * reunião sair de 'recording'.
 *
 * Este módulo NUNCA recalcula delta — as palavras chegam do wordDelta já
 * prontas, uma única vez; aqui elas só são acumuladas e liberadas. Sem
 * `chrome`, `fetch`, `setTimeout` nem `Date.now` — só funções puras, testáveis
 * sem mock nenhum.
 */
import type { SegmentDelta } from './wordDelta';

/** Uma fala em formação: texto acumulado de um segmento até ser liberada. */
export interface PendingPhrase {
  sessionId: string;
  segmentKey: string;
  speaker: string | null;
  text: string;
  /** epoch ms da primeira palavra desta fala (teto de espera). */
  firstAt: number;
  /** epoch ms da última palavra nova (janela de silêncio). */
  lastAt: number;
}

export type PhraseBuffer = readonly PendingPhrase[];

export const EMPTY_PHRASE_BUFFER: PhraseBuffer = Object.freeze([]) as PhraseBuffer;

export interface PhraseTiming {
  /** Fala sai depois deste tempo sem palavra nova. */
  quietMs: number;
  /** Fala sai no máximo depois deste tempo desde a primeira palavra pendente. */
  maxWaitMs: number;
}

/**
 * Acrescenta os deltas novos ao buffer: delta cujo (sessionId, key) já tem
 * fala pendente concatena com um espaço (atualiza só lastAt/speaker); delta
 * novo abre uma fala no fim do buffer. Nunca muta o buffer nem as falas de
 * entrada; deltas vazios devolvem o MESMO buffer (sem alocar).
 */
export function appendDeltas(
  buffer: PhraseBuffer,
  deltas: readonly SegmentDelta[],
  sessionId: string,
  now: number,
): PhraseBuffer {
  if (deltas.length === 0) return buffer;

  const next: PendingPhrase[] = buffer.slice();
  for (const delta of deltas) {
    const index = next.findIndex(
      (phrase) => phrase.sessionId === sessionId && phrase.segmentKey === delta.key,
    );
    if (index === -1) {
      next.push({
        sessionId,
        segmentKey: delta.key,
        speaker: delta.speaker,
        text: delta.text,
        firstAt: now,
        lastAt: now,
      });
    } else {
      const prev = next[index]!;
      next[index] = {
        ...prev,
        text: `${prev.text} ${delta.text}`,
        lastAt: now,
        speaker: delta.speaker ?? prev.speaker,
      };
    }
  }
  return next;
}

/**
 * Separa as falas prontas para sair (silêncio, teto, ou `flushAll` — reunião
 * saiu de 'recording') das que continuam esperando; ambas mantêm a ordem do
 * buffer original. Uma fala liberada nunca é reaberta: o próximo delta da
 * mesma (sessionId, key) abre uma fala NOVA em `appendDeltas` (firstAt novo).
 */
export function takeReadyPhrases(
  buffer: PhraseBuffer,
  now: number,
  timing: PhraseTiming,
  flushAll: boolean,
): { buffer: PhraseBuffer; ready: PendingPhrase[] } {
  if (buffer.length === 0) return { buffer: EMPTY_PHRASE_BUFFER, ready: [] };

  const ready: PendingPhrase[] = [];
  const remaining: PendingPhrase[] = [];
  for (const phrase of buffer) {
    const isReady =
      flushAll ||
      now - phrase.lastAt >= timing.quietMs ||
      now - phrase.firstAt >= timing.maxWaitMs;
    if (isReady) {
      ready.push(phrase);
    } else {
      remaining.push(phrase);
    }
  }
  return { buffer: remaining, ready };
}

/**
 * Menor prazo entre as falas pendentes (`null` se o buffer estiver vazio) —
 * usado para rearmar o único timer da janela no streamer.
 */
export function nextPhraseDeadline(buffer: PhraseBuffer, timing: PhraseTiming): number | null {
  if (buffer.length === 0) return null;

  let earliest: number | null = null;
  for (const phrase of buffer) {
    const deadline = Math.min(phrase.lastAt + timing.quietMs, phrase.firstAt + timing.maxWaitMs);
    if (earliest === null || deadline < earliest) {
      earliest = deadline;
    }
  }
  return earliest;
}
