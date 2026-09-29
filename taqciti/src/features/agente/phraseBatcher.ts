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
import {
  buildExtensionChunkRequest,
  type AgenteConfig,
  type ExtensionChunkRequest,
} from '@/shared/config/agenteConfig';
import type { SegmentDelta } from './wordDelta';

/** Para onde uma fala vai: backend + sessão, fixados quando a fala é aberta (IN-11, D-04). */
export interface PhraseDestination {
  backendUrl: string;
  sessionId: string;
}

/** Uma fala em formação: texto acumulado de um segmento até ser liberada. */
export interface PendingPhrase {
  sessionId: string;
  /**
   * URL do backend em que a fala foi acumulada (IN-11). Opcional só por
   * compatibilidade: o snapshot gravado antes do IN-11 não tem este campo, e
   * essa fala sai para a URL da config atual (comportamento anterior).
   */
  backendUrl?: string;
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
 * Acrescenta os deltas novos ao buffer: delta cujo (destino, key) já tem
 * fala pendente concatena com um espaço (atualiza só lastAt/speaker); delta
 * novo abre uma fala no fim do buffer. Nunca muta o buffer nem as falas de
 * entrada; deltas vazios devolvem o MESMO buffer (sem alocar).
 */
export function appendDeltas(
  buffer: PhraseBuffer,
  deltas: readonly SegmentDelta[],
  destination: PhraseDestination,
  now: number,
): PhraseBuffer {
  if (deltas.length === 0) return buffer;

  const next: PendingPhrase[] = buffer.slice();
  for (const delta of deltas) {
    const index = next.findIndex(
      (phrase) =>
        phrase.sessionId === destination.sessionId &&
        phrase.backendUrl === destination.backendUrl &&
        phrase.segmentKey === delta.key,
    );
    if (index === -1) {
      next.push({
        sessionId: destination.sessionId,
        backendUrl: destination.backendUrl,
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
 * mesma (destino, key) abre uma fala NOVA em `appendDeltas` (firstAt novo).
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

/**
 * Monta uma requisição `ExtensionChunk` por fala liberada, cada uma para o
 * destino (URL do backend + session_id) em que foi acumulada (D-04, IN-11) —
 * nunca o da config atual. A chave `x-agente-key` continua a da config atual:
 * segredo não é gravado no snapshot. Fala do formato antigo, sem `backendUrl`,
 * usa a URL da config atual.
 */
export function buildPhraseRequests(
  config: AgenteConfig,
  phrases: readonly PendingPhrase[],
): ExtensionChunkRequest[] {
  return phrases.map((phrase) =>
    buildExtensionChunkRequest(
      {
        ...config,
        agenteBackendUrl: phrase.backendUrl ?? config.agenteBackendUrl,
        agenteSessionId: phrase.sessionId,
      },
      { text: phrase.text, speaker: phrase.speaker },
    ),
  );
}
