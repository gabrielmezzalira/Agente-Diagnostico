/**
 * Casos de borda do delta palavra-a-palavra (D-07) — cada teste aqui
 * corresponde a uma forma real de a Taqciti reescrever/rolar/reaproveitar
 * uma linha de legenda (ver aggregator.ts:49-95 e mergeCaption.ts:89-124),
 * não a uma propriedade abstrata da função.
 */
import { describe, expect, it } from 'vitest';
import type { LiveSegment, MeetingSessionState } from '@/shared/types/domain';
import {
  computeSegmentDeltas,
  planStreamStep,
  primeCursor,
  segmentKey,
  splitWords,
  type StreamCursor,
} from './wordDelta';

const SESSION_ID = '11111111-1111-1111-1111-111111111111';

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

function session(overrides: Partial<MeetingSessionState> = {}): MeetingSessionState {
  return {
    meetingId: 'm1',
    meetingCode: 'abc-defg-hij',
    provider: 'google-meet',
    tabId: 1,
    title: 'Reunião de teste',
    titleAuto: false,
    startedAt: 1000,
    endedAt: null,
    captionsEnabled: true,
    participants: [],
    presentNow: [],
    speakersObserved: [],
    segments: [],
    sealedCaptionIds: [],
    droppedSegments: 0,
    reconnectCount: 0,
    captureDegradedCount: 0,
    lastChunkAt: null,
    wasDiscardedAndRestarted: false,
    captionLanguage: 'unknown',
    languageWarningDismissed: false,
    chunksSinceLanguageCheck: 0,
    ...overrides,
  };
}

describe('splitWords / segmentKey', () => {
  it('separa por whitespace unicode; acento, cedilha, NBSP e emoji não alteram a contagem', () => {
    expect(splitWords('ação  orçamento 🚀 ok')).toEqual(['ação', 'orçamento', '🚀', 'ok']);
    expect(splitWords('a b')).toEqual(['a', 'b']);
  });

  it('descarta tokens vazios (múltiplos espaços, texto vazio)', () => {
    expect(splitWords('   ')).toEqual([]);
    expect(splitWords('')).toEqual([]);
  });

  it('a chave é ${índice}:${captionId} — não só captionId', () => {
    expect(segmentKey({ captionId: 'c1' }, 0)).toBe('0:c1');
    expect(segmentKey({ captionId: 'c1' }, 1)).toBe('1:c1');
  });
});

describe('computeSegmentDeltas — crescimento e segmentos concorrentes', () => {
  it('segmento que cresce gera delta só com as palavras novas', () => {
    const cursor: StreamCursor = { meetingId: 'm1', sessionId: SESSION_ID, sent: { '0:c1': 1 } };
    const { deltas, cursor: next } = computeSegmentDeltas(cursor, [segment({ text: 'olá tudo bem' })]);
    expect(deltas).toEqual([{ key: '0:c1', text: 'tudo bem', speaker: 'Ana' }]);
    expect(next.sent['0:c1']).toBe(3);
  });

  it('dois segmentos concorrentes (c1, c2 alternando) mantêm contagens independentes', () => {
    let cursor: StreamCursor = { meetingId: 'm1', sessionId: SESSION_ID, sent: {} };
    let segments: LiveSegment[] = [
      segment({ captionId: 'c1', text: 'um' }),
      segment({ captionId: 'c2', text: 'dois' }),
    ];
    let step = computeSegmentDeltas(cursor, segments);
    expect(step.deltas).toEqual([
      { key: '0:c1', text: 'um', speaker: 'Ana' },
      { key: '1:c2', text: 'dois', speaker: 'Ana' },
    ]);

    cursor = step.cursor;
    segments = [
      segment({ captionId: 'c1', text: 'um mais' }),
      segment({ captionId: 'c2', text: 'dois' }),
    ];
    step = computeSegmentDeltas(cursor, segments);
    expect(step.deltas).toEqual([{ key: '0:c1', text: 'mais', speaker: 'Ana' }]);
  });
});

describe('computeSegmentDeltas — captionId reaproveitado', () => {
  it('segmento novo com o mesmo captionId (troca de falante) é enviado INTEIRO, sem cortar pela contagem do anterior', () => {
    const cursor: StreamCursor = { meetingId: 'm1', sessionId: SESSION_ID, sent: { '0:c1': 4 } };
    const segments: LiveSegment[] = [
      segment({ captionId: 'c1', speaker: 'Ana', text: 'primeira fala longa aqui' }),
      segment({ captionId: 'c1', speaker: 'Bruno', text: 'outra pessoa falou' }),
    ];
    const { deltas } = computeSegmentDeltas(cursor, segments);
    expect(deltas).toEqual([{ key: '1:c1', text: 'outra pessoa falou', speaker: 'Bruno' }]);
  });
});

describe('computeSegmentDeltas — reescrita e encolhimento (mergeCaption.ts caso 2b/3)', () => {
  it('correção de acento/pontuação no fim ("o orcamento" -> "o orçamento.") não gera envio', () => {
    const cursor: StreamCursor = { meetingId: 'm1', sessionId: SESSION_ID, sent: { '0:c1': 2 } };
    const { deltas, cursor: next } = computeSegmentDeltas(cursor, [segment({ text: 'o orçamento.' })]);
    expect(deltas).toEqual([]);
    expect(next.sent['0:c1']).toBe(2);
  });

  it('texto que perde palavras não gera envio; a contagem guardada continua a máxima', () => {
    const cursor: StreamCursor = { meetingId: 'm1', sessionId: SESSION_ID, sent: { '0:c1': 5 } };
    const { deltas, cursor: next } = computeSegmentDeltas(cursor, [segment({ text: 'só três aqui' })]);
    expect(deltas).toEqual([]);
    expect(next.sent['0:c1']).toBe(5);
  });
});

describe('computeSegmentDeltas — limpeza (CLEAR_TRANSCRIPT)', () => {
  it('depois de segments vazios, chaves antigas somem do cursor; um segmento novo no mesmo índice é enviado inteiro', () => {
    const cursor: StreamCursor = { meetingId: 'm1', sessionId: SESSION_ID, sent: { '0:c1': 4 } };
    const cleared = computeSegmentDeltas(cursor, []);
    expect(cleared.deltas).toEqual([]);
    expect(cleared.cursor.sent).toEqual({});

    const { deltas } = computeSegmentDeltas(cleared.cursor, [segment({ captionId: 'c9', text: 'nova fala aqui' })]);
    expect(deltas).toEqual([{ key: '0:c9', text: 'nova fala aqui', speaker: 'Ana' }]);
  });
});

describe('casos vazios', () => {
  it('segments vazios não geram deltas', () => {
    const cursor: StreamCursor = { meetingId: 'm1', sessionId: SESSION_ID, sent: {} };
    expect(computeSegmentDeltas(cursor, []).deltas).toEqual([]);
  });

  it('sessão nula mantém o cursor anterior, sem deltas', () => {
    const prev: StreamCursor = { meetingId: 'm1', sessionId: SESSION_ID, sent: { '0:c1': 2 } };
    const step = planStreamStep(prev, null, { sessionId: SESSION_ID });
    expect(step.cursor).toBe(prev);
    expect(step.deltas).toEqual([]);
  });

  it('binding nulo devolve cursor null, independente do estado anterior', () => {
    const prev: StreamCursor = { meetingId: 'm1', sessionId: SESSION_ID, sent: {} };
    const step = planStreamStep(prev, session(), null);
    expect(step.cursor).toBeNull();
    expect(step.deltas).toEqual([]);
  });

  it('segmento de 1 palavra gera exatamente 1 delta com essa palavra', () => {
    const cursor: StreamCursor = { meetingId: 'm1', sessionId: SESSION_ID, sent: {} };
    const { deltas } = computeSegmentDeltas(cursor, [segment({ text: 'oi' })]);
    expect(deltas).toEqual([{ key: '0:c1', text: 'oi', speaker: 'Ana' }]);
  });
});

describe('codificação', () => {
  it('o delta enviado usa espaço simples, sem re-normalização NFC/NFD do texto sanitizado', () => {
    const cursor: StreamCursor = { meetingId: 'm1', sessionId: SESSION_ID, sent: {} };
    const { deltas } = computeSegmentDeltas(cursor, [segment({ text: 'ação  orçamento 🚀 ok' })]);
    expect(deltas[0]?.text).toBe('ação orçamento 🚀 ok');
  });
});

describe('idempotência', () => {
  it('rodar computeSegmentDeltas duas vezes com os mesmos segmentos não reenvia nada na segunda', () => {
    const cursor: StreamCursor = { meetingId: 'm1', sessionId: SESSION_ID, sent: {} };
    const segments = [segment({ text: 'olá tudo bem' })];
    const first = computeSegmentDeltas(cursor, segments);
    const second = computeSegmentDeltas(first.cursor, segments);
    expect(second.deltas).toEqual([]);
    expect(second.cursor).toEqual(first.cursor);
  });
});

describe('primeCursor', () => {
  it('marca todas as palavras atuais como já enviadas — nada sai retroativamente (D-09)', () => {
    const s = session({ segments: [segment({ text: 'já estava aqui' })] });
    const cursor = primeCursor(s, SESSION_ID);
    expect(cursor).toEqual({ meetingId: 'm1', sessionId: SESSION_ID, sent: { '0:c1': 3 } });
  });
});

describe('planStreamStep — prime, reunião nova, troca de sessão', () => {
  it('prev nulo + binding: prime sem deltas; só palavras depois do prime são enviadas', () => {
    const s = session({ segments: [segment({ text: 'já estava aqui' })] });
    const primed = planStreamStep(null, s, { sessionId: SESSION_ID });
    expect(primed.deltas).toEqual([]);
    expect(primed.cursor?.sent['0:c1']).toBe(3);

    const grown = session({ segments: [segment({ text: 'já estava aqui e mais' })] });
    const step = planStreamStep(primed.cursor, grown, { sessionId: SESSION_ID });
    expect(step.deltas).toEqual([{ key: '0:c1', text: 'e mais', speaker: 'Ana' }]);
  });

  it('meetingId novo com o MESMO session_id: espera — nada vai para a sessão da reunião anterior', () => {
    const prev: StreamCursor = { meetingId: 'm1', sessionId: SESSION_ID, sent: { '0:c1': 2 } };
    const newMeeting = session({ meetingId: 'm2', segments: [segment({ text: 'fala nova' })] });
    const step = planStreamStep(prev, newMeeting, { sessionId: SESSION_ID });
    expect(step.deltas).toEqual([]);
    expect(step.cursor).toBe(prev);
    // CR-01: a espera deixa de ser silenciosa — o streamer avisa a tela.
    expect(step.waitingForNewMeeting).toBe(true);
  });

  it('CR-01: reunião nova confirmada com o MESMO session_id sai desde o início dela', () => {
    const prev: StreamCursor = { meetingId: 'm1', sessionId: SESSION_ID, sent: { '0:c1': 2 } };
    const newMeeting = session({ meetingId: 'm2', segments: [segment({ text: 'fala nova aqui' })] });
    const step = planStreamStep(prev, newMeeting, {
      sessionId: SESSION_ID,
      confirmedMeetingId: 'm2',
    });
    expect(step.waitingForNewMeeting).toBeUndefined();
    expect(step.deltas.map((d) => d.text)).toEqual(['fala nova aqui']);
    expect(step.cursor).toEqual({ meetingId: 'm2', sessionId: SESSION_ID, sent: { '0:c1': 3 } });
  });

  it('CR-01: confirmação de OUTRA reunião não libera a atual', () => {
    const prev: StreamCursor = { meetingId: 'm1', sessionId: SESSION_ID, sent: { '0:c1': 2 } };
    const newMeeting = session({ meetingId: 'm3', segments: [segment({ text: 'outra reunião' })] });
    const step = planStreamStep(prev, newMeeting, {
      sessionId: SESSION_ID,
      confirmedMeetingId: 'm2',
    });
    expect(step.deltas).toEqual([]);
    expect(step.waitingForNewMeeting).toBe(true);
  });

  it('meetingId novo com session_id NOVO: prime para a reunião nova', () => {
    const prev: StreamCursor = { meetingId: 'm1', sessionId: SESSION_ID, sent: { '0:c1': 2 } };
    const newSessionId = '22222222-2222-2222-2222-222222222222';
    const newMeeting = session({ meetingId: 'm2', segments: [segment({ text: 'fala nova aqui' })] });
    const step = planStreamStep(prev, newMeeting, { sessionId: newSessionId });
    expect(step.deltas).toEqual([]);
    expect(step.cursor).toEqual({ meetingId: 'm2', sessionId: newSessionId, sent: { '0:c1': 3 } });
  });

  it('sessionId trocado na MESMA reunião: nada já enviado é reenviado; cursor.sessionId passa a ser o novo', () => {
    const prev: StreamCursor = { meetingId: 'm1', sessionId: SESSION_ID, sent: { '0:c1': 3 } };
    const newSessionId = '22222222-2222-2222-2222-222222222222';
    const sameMeeting = session({ meetingId: 'm1', segments: [segment({ text: 'já estava aqui' })] });
    const step = planStreamStep(prev, sameMeeting, { sessionId: newSessionId });
    expect(step.deltas).toEqual([]);
    expect(step.cursor?.sessionId).toBe(newSessionId);
  });
});

describe('contrato com o agrupador (phraseBatcher, plano 07-04) — sem mudar wordDelta.ts', () => {
  it('deltas de um segmento que cresce em passos (1, 3, 4, 6 palavras), unidos por espaço, são exatamente o texto final, sem repetir nem pular', () => {
    let cursor: StreamCursor = { meetingId: 'm1', sessionId: SESSION_ID, sent: {} };
    const passos = ['um', 'um dois três', 'um dois três quatro', 'um dois três quatro cinco seis'];
    const coletado: string[] = [];

    for (const texto of passos) {
      const { deltas, cursor: proximo } = computeSegmentDeltas(cursor, [segment({ text: texto })]);
      cursor = proximo;
      for (const d of deltas) coletado.push(d.text);
    }

    expect(coletado.join(' ')).toBe('um dois três quatro cinco seis');
  });
});
