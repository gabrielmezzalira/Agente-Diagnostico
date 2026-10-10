/**
 * Casos de borda da política pura de agrupamento por fala (Fase 7, plano
 * 07-04, G-07-1/G-07-2, D-06 refinado). Timing de teste próprio (quietMs
 * 1000, maxWaitMs 4000) para provar que a política não depende dos valores
 * reais de produção — só o caso de coerência importa as constantes de
 * verdade (agenteConfig/constants).
 */
import { describe, expect, it } from 'vitest';
import type { SegmentDelta } from './wordDelta';
import {
  appendDeltas,
  EMPTY_PHRASE_BUFFER,
  buildPhraseRequests,
  nextPhraseDeadline,
  takeReadyPhrases,
  type PendingPhrase,
  type PhraseBuffer,
  type PhraseDestination,
  type PhraseTiming,
} from './phraseBatcher';
import {
  AGENTE_PHRASE_MAX_WAIT_MS,
  AGENTE_PHRASE_QUIET_MS,
  type AgenteConfig,
} from '@/shared/config/agenteConfig';
import { STATE_FLUSH_INTERVAL_MS } from '@/shared/config/constants';

const SESSION_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_SESSION_ID = '22222222-2222-2222-2222-222222222222';
const URL_A = 'https://agente-a.test';
const URL_B = 'https://agente-b.test';
const DEST_A: PhraseDestination = { backendUrl: URL_A, sessionId: SESSION_ID };
const OTHER_SESSION_DEST: PhraseDestination = { backendUrl: URL_A, sessionId: OTHER_SESSION_ID };
const TIMING: PhraseTiming = { quietMs: 1000, maxWaitMs: 4000 };

function delta(overrides: Partial<SegmentDelta> = {}): SegmentDelta {
  return { key: '0:c1', text: 'olá', speaker: 'Ana', ...overrides };
}

describe('phraseBatcher / append', () => {
  it('delta novo cria fala com firstAt = lastAt = now', () => {
    const buffer = appendDeltas(EMPTY_PHRASE_BUFFER, [delta()], DEST_A, 1000);
    expect(buffer).toEqual([
      { sessionId: SESSION_ID, backendUrl: URL_A, segmentKey: '0:c1', speaker: 'Ana', text: 'olá', firstAt: 1000, lastAt: 1000 },
    ]);
  });

  it('segundo delta da mesma (sessionId, key) concatena com um espaço e atualiza só lastAt', () => {
    const first = appendDeltas(EMPTY_PHRASE_BUFFER, [delta({ text: 'olá' })], DEST_A, 1000);
    const second = appendDeltas(first, [delta({ text: 'tudo bem' })], DEST_A, 1300);
    expect(second).toEqual([
      {
        sessionId: SESSION_ID,
        backendUrl: URL_A,
        segmentKey: '0:c1',
        speaker: 'Ana',
        text: 'olá tudo bem',
        firstAt: 1000,
        lastAt: 1300,
      },
    ]);
  });

  it('key diferente vira fala separada, na ordem de chegada', () => {
    const buffer = appendDeltas(
      EMPTY_PHRASE_BUFFER,
      [delta({ key: '0:c1', text: 'um' }), delta({ key: '1:c2', text: 'dois' })],
      DEST_A,
      1000,
    );
    expect(buffer.map((p) => p.segmentKey)).toEqual(['0:c1', '1:c2']);
    expect(buffer.map((p) => p.text)).toEqual(['um', 'dois']);
  });

  it('mesma key com sessionId diferente vira fala separada', () => {
    const first = appendDeltas(EMPTY_PHRASE_BUFFER, [delta({ text: 'olá' })], DEST_A, 1000);
    const withOther = appendDeltas(first, [delta({ text: 'oi' })], OTHER_SESSION_DEST, 1000);
    expect(withOther).toHaveLength(2);
    expect(withOther[0]).toMatchObject({ sessionId: SESSION_ID, text: 'olá' });
    expect(withOther[1]).toMatchObject({ sessionId: OTHER_SESSION_ID, backendUrl: URL_A, text: 'oi' });
  });

  it('mesma (sessionId, key) com backendUrl diferente vira fala separada (IN-11: o destino é parte da chave)', () => {
    const first = appendDeltas(EMPTY_PHRASE_BUFFER, [delta({ text: 'olá' })], DEST_A, 1000);
    const toB = appendDeltas(first, [delta({ text: 'oi' })], { backendUrl: URL_B, sessionId: SESSION_ID }, 1100);
    expect(toB).toHaveLength(2);
    expect(toB[0]).toMatchObject({ backendUrl: URL_A, sessionId: SESSION_ID, text: 'olá' });
    expect(toB[1]).toMatchObject({ backendUrl: URL_B, sessionId: SESSION_ID, text: 'oi' });
  });

  it('deltas vazios devolvem o MESMO buffer (sem alocar)', () => {
    const buffer = appendDeltas(EMPTY_PHRASE_BUFFER, [delta()], DEST_A, 1000);
    expect(appendDeltas(buffer, [], DEST_A, 2000)).toBe(buffer);
  });

  it("speaker null seguido de 'Ana' deixa a fala com 'Ana'", () => {
    const first = appendDeltas(EMPTY_PHRASE_BUFFER, [delta({ speaker: null, text: 'oi' })], DEST_A, 1000);
    const second = appendDeltas(first, [delta({ speaker: 'Ana', text: 'tudo bem' })], DEST_A, 1200);
    expect(second[0]?.speaker).toBe('Ana');
  });

  it('delta com speaker null não apaga um speaker já conhecido', () => {
    const first = appendDeltas(EMPTY_PHRASE_BUFFER, [delta({ speaker: 'Ana', text: 'oi' })], DEST_A, 1000);
    const second = appendDeltas(first, [delta({ speaker: null, text: 'tudo bem' })], DEST_A, 1200);
    expect(second[0]?.speaker).toBe('Ana');
  });
});

describe('phraseBatcher / takeReady', () => {
  it('antes do silêncio nada sai', () => {
    const buffer = appendDeltas(EMPTY_PHRASE_BUFFER, [delta()], DEST_A, 1000);
    const { ready, buffer: remaining } = takeReadyPhrases(buffer, 1000 + TIMING.quietMs - 1, TIMING, false);
    expect(ready).toEqual([]);
    expect(remaining).toEqual(buffer);
  });

  it('com now - lastAt exatamente igual a quietMs a fala sai (limite inclusivo)', () => {
    const buffer = appendDeltas(EMPTY_PHRASE_BUFFER, [delta()], DEST_A, 1000);
    const { ready, buffer: remaining } = takeReadyPhrases(buffer, 1000 + TIMING.quietMs, TIMING, false);
    expect(ready).toHaveLength(1);
    expect(remaining).toEqual([]);
  });

  it('crescendo sem parar, a fala sai quando now - firstAt atinge maxWaitMs mesmo sem silêncio', () => {
    let buffer = appendDeltas(EMPTY_PHRASE_BUFFER, [delta({ text: 'um' })], DEST_A, 0);
    // Cresce a cada 900ms (< quietMs) até o teto — nunca fica em silêncio.
    buffer = appendDeltas(buffer, [delta({ text: 'dois' })], DEST_A, 900);
    buffer = appendDeltas(buffer, [delta({ text: 'três' })], DEST_A, 1800);
    buffer = appendDeltas(buffer, [delta({ text: 'quatro' })], DEST_A, 2700);
    buffer = appendDeltas(buffer, [delta({ text: 'cinco' })], DEST_A, 3600);
    // now - lastAt (3600) = 400 < quietMs (1000): silêncio não bateu; mas now - firstAt (0) = 4000 = maxWaitMs.
    const { ready } = takeReadyPhrases(buffer, 4000, TIMING, false);
    expect(ready).toHaveLength(1);
    expect(ready[0]?.text).toBe('um dois três quatro cinco');
  });

  it('flushAll libera todas mesmo sem silêncio nem teto (reunião saiu de recording)', () => {
    const buffer = appendDeltas(EMPTY_PHRASE_BUFFER, [delta()], DEST_A, 1000);
    const { ready, buffer: remaining } = takeReadyPhrases(buffer, 1000, TIMING, true);
    expect(ready).toHaveLength(1);
    expect(remaining).toEqual([]);
  });

  it('o que sai é removido e o restante mantém a ordem', () => {
    let buffer = appendDeltas(EMPTY_PHRASE_BUFFER, [delta({ key: '0:c1', text: 'um' })], DEST_A, 0);
    buffer = appendDeltas(buffer, [delta({ key: '1:c2', text: 'dois' })], DEST_A, 100);
    buffer = appendDeltas(buffer, [delta({ key: '2:c3', text: 'três' })], DEST_A, 200);
    // now bem depois do quietMs de '0:c1'/'1:c2', mas '2:c3' ainda dentro do silêncio.
    const now = 200 + TIMING.quietMs - 50;
    const { ready, buffer: remaining } = takeReadyPhrases(buffer, now, TIMING, false);
    expect(ready.map((p) => p.segmentKey)).toEqual(['0:c1', '1:c2']);
    expect(remaining.map((p) => p.segmentKey)).toEqual(['2:c3']);
  });

  it('buffer de entrada congelado (Object.freeze) não é mutado', () => {
    const built = appendDeltas(EMPTY_PHRASE_BUFFER, [delta()], DEST_A, 1000);
    const frozen = Object.freeze(built.map((p) => Object.freeze({ ...p }))) as PhraseBuffer;

    const { ready } = takeReadyPhrases(frozen, 1000 + TIMING.quietMs, TIMING, false);

    expect(ready).toHaveLength(1);
    expect(frozen[0]).toEqual({
      sessionId: SESSION_ID,
      backendUrl: URL_A,
      segmentKey: '0:c1',
      speaker: 'Ana',
      text: 'olá',
      firstAt: 1000,
      lastAt: 1000,
    });
  });
});

describe('phraseBatcher / depois do envio', () => {
  it('um delta novo da mesma key abre uma fala NOVA (firstAt novo), nunca reabre a já enviada', () => {
    const buffer = appendDeltas(EMPTY_PHRASE_BUFFER, [delta({ text: 'olá' })], DEST_A, 1000);
    const { ready, buffer: afterSend } = takeReadyPhrases(buffer, 1000 + TIMING.quietMs, TIMING, false);
    expect(ready).toHaveLength(1);
    expect(afterSend).toEqual([]);

    const reopened = appendDeltas(afterSend, [delta({ text: 'boa noite' })], DEST_A, 5000);
    expect(reopened).toEqual([
      { sessionId: SESSION_ID, backendUrl: URL_A, segmentKey: '0:c1', speaker: 'Ana', text: 'boa noite', firstAt: 5000, lastAt: 5000 },
    ]);
  });
});

describe('phraseBatcher / nextPhraseDeadline', () => {
  it('buffer vazio devolve null', () => {
    expect(nextPhraseDeadline(EMPTY_PHRASE_BUFFER, TIMING)).toBeNull();
  });

  it('1 fala: min(lastAt + quietMs, firstAt + maxWaitMs)', () => {
    const buffer = appendDeltas(EMPTY_PHRASE_BUFFER, [delta()], DEST_A, 1000);
    // lastAt=1000, firstAt=1000: min(1000+1000, 1000+4000) = 2000.
    expect(nextPhraseDeadline(buffer, TIMING)).toBe(2000);
  });

  it('várias falas: o menor prazo entre todas', () => {
    let buffer = appendDeltas(EMPTY_PHRASE_BUFFER, [delta({ key: '0:c1' })], DEST_A, 1000);
    buffer = appendDeltas(buffer, [delta({ key: '1:c2' })], DEST_A, 1800);
    // '0:c1': min(1000+1000, 1000+4000) = 2000. '1:c2': min(1800+1000, 1800+4000) = 2800.
    expect(nextPhraseDeadline(buffer, TIMING)).toBe(2000);
  });
});

describe('phraseBatcher / coerência', () => {
  it('AGENTE_PHRASE_QUIET_MS > STATE_FLUSH_INTERVAL_MS e AGENTE_PHRASE_MAX_WAIT_MS > AGENTE_PHRASE_QUIET_MS', () => {
    expect(AGENTE_PHRASE_QUIET_MS).toBeGreaterThan(STATE_FLUSH_INTERVAL_MS);
    expect(AGENTE_PHRASE_MAX_WAIT_MS).toBeGreaterThan(AGENTE_PHRASE_QUIET_MS);
  });
});

describe('phraseBatcher / buildPhraseRequests (IN-11)', () => {
  const CONFIG: AgenteConfig = {
    agenteBackendUrl: URL_B,
    streamingEnabled: true,
    agenteSessionId: OTHER_SESSION_ID,
    agenteApiKey: 's3cr3t',
    confirmedMeetingId: '',
    boundMeetingId: '',
  };

  it('a requisição usa o session_id guardado na fala, não o da config atual', () => {
    const buffer = appendDeltas(EMPTY_PHRASE_BUFFER, [delta({ text: 'olá' })], DEST_A, 1000);
    const [request] = buildPhraseRequests({ ...CONFIG, agenteBackendUrl: URL_A }, buffer);
    expect(request?.url).toBe(`${URL_A}/webhook/extension`);
    expect(JSON.parse(request?.init.body as string)).toMatchObject({ session_id: SESSION_ID, text: 'olá' });
  });

  it('fala acumulada para outro backend é descartada — a chave da config atual não vai para o backend antigo', () => {
    const buffer = appendDeltas(EMPTY_PHRASE_BUFFER, [delta({ text: 'olá' })], DEST_A, 1000);
    // CONFIG aponta para URL_B (com a chave de B): a fala de A não pode sair.
    expect(buildPhraseRequests(CONFIG, buffer)).toEqual([]);
  });

  it('IN-01/IN-04: num lote misto sai só o que é da URL atual, na ordem, e a diferença é o nº de descartadas', () => {
    const phrase = (backendUrl: string, text: string) => ({
      sessionId: SESSION_ID,
      backendUrl,
      segmentKey: `0:${text}`,
      speaker: 'Ana',
      text,
      firstAt: 1,
      lastAt: 1,
    });
    const phrases = [phrase(URL_A, 'antiga'), phrase(URL_B, 'primeira'), phrase(URL_B, 'segunda')];

    const requests = buildPhraseRequests(CONFIG, phrases);

    expect(requests.map((r) => JSON.parse(r.init.body as string).text)).toEqual(['primeira', 'segunda']);
    expect(phrases.length - requests.length).toBe(1);
  });

  it('IN-01: fala sem backendUrl (dado malformado que escapou do restore) nunca sai para a URL atual', () => {
    const malformed = { sessionId: SESSION_ID, segmentKey: '0:c1', speaker: 'Ana', text: 'olá', firstAt: 1, lastAt: 1 };
    expect(buildPhraseRequests(CONFIG, [malformed as unknown as PendingPhrase])).toEqual([]);
  });
});
