/**
 * O storage do painel AGP (Fase 10): normalização com lista branca, escrita direta e assinatura.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseAgpMessage, type AgpQuestion } from '@/features/agente/agpQuestions';
import { installChromeStorageMock } from '@/test/chromeStorageMock';
import { EMPTY_AGP_FEED, loadAgpFeed, normalizeAgpFeed, subscribeAgpFeed, writeAgpFeed } from './agpQuestionsStore';

const SID = '11111111-1111-1111-1111-111111111111';
const question = { id: 'q1', text: 'Qual o gargalo?', block: 'negocio', lens: 'dados', status: 'queued' };

describe('normalizeAgpFeed', () => {
  it.each([null, undefined, 5, 'x', [], {}, { sessionId: '' }, { sessionId: 7 }])('%j -> vazio', (raw) => {
    expect(normalizeAgpFeed(raw)).toEqual(EMPTY_AGP_FEED);
  });
  it('sem sessão nunca guarda pergunta', () => {
    expect(normalizeAgpFeed({ sessionId: null, connection: 'live', questions: [question] })).toEqual(EMPTY_AGP_FEED);
  });
  it('conexão desconhecida vira idle e pergunta inválida cai fora, sem campo extra', () => {
    const feed = normalizeAgpFeed({
      sessionId: SID,
      connection: 'quebrada',
      questions: [{ ...question, segredo: 'x' }, { id: '' }],
    });
    expect(feed).toEqual({ sessionId: SID, connection: 'idle', questions: [question] });
  });
});

describe('ida e volta pela normalização (CR-01)', () => {
  it('tudo que o parse do backend devolve sobrevive à normalização do store, campo a campo', () => {
    const parsed = parseAgpMessage(
      JSON.stringify({
        event: 'question_new',
        data: { id: 'q9', text: 'Quem decide?', block: 'negocio', source: 'auto', status: 'pinned', lens: 'dados', expires_at: '2099-01-01T00:00:00Z' },
      }),
    );
    expect(parsed).toMatchObject({ kind: 'new' });
    const stored = (parsed as { question: AgpQuestion }).question;
    const feed = normalizeAgpFeed({ sessionId: SID, connection: 'live', questions: [stored] });
    expect(feed.questions).toEqual([stored]);
    expect(feed.questions[0]).toEqual({ id: 'q9', text: 'Quem decide?', block: 'negocio', lens: 'dados', status: 'pinned' });
  });
});

describe('leitura, escrita e assinatura', () => {
  beforeEach(() => {
    installChromeStorageMock();
  });

  it('escreve o valor inteiro e lê de volta', async () => {
    await writeAgpFeed({ sessionId: SID, connection: 'live', questions: [{ ...question, lens: 'dados', status: 'queued' }] });
    expect(await loadAgpFeed()).toMatchObject({ sessionId: SID, connection: 'live' });
  });

  it('sem nada salvo, lê vazio', async () => {
    expect(await loadAgpFeed()).toEqual(EMPTY_AGP_FEED);
  });

  it('o assinante recebe o valor atual e depois cada mudança', async () => {
    const listener = vi.fn();
    const stop = subscribeAgpFeed(listener);
    await vi.waitFor(() => expect(listener).toHaveBeenCalledWith(EMPTY_AGP_FEED));
    await writeAgpFeed({ sessionId: SID, connection: 'connecting', questions: [] });
    await vi.waitFor(() => expect(listener).toHaveBeenLastCalledWith({ sessionId: SID, connection: 'connecting', questions: [] }));
    stop();
  });
});
