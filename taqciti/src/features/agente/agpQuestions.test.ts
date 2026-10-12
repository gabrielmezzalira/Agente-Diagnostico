/**
 * As perguntas do AGP (Fase 10): leitura das mensagens do WebSocket, lista e visibilidade. Inclui lixo na
 * entrada — o backend é de outro time e o storage nunca pode receber campo fora da lista branca.
 */
import { describe, expect, it } from 'vitest';
import {
  AGP_MAX_QUESTIONS,
  applyAgpMessage,
  parseAgpMessage,
  toAgpQuestion,
  type AgpQuestion,
} from './agpQuestions';

const raw = (over: Record<string, unknown> = {}) => ({
  id: 'q1',
  text: 'Qual é o gargalo hoje?',
  block: 'negocio',
  source: 'auto',
  status: 'queued',
  generated_at: '2026-10-12T20:00:00Z',
  expires_at: '2026-10-12T20:00:30Z',
  lens: 'produto',
  ...over,
});
const q = (id: string, over: Partial<AgpQuestion> = {}): AgpQuestion => ({
  id, text: `pergunta ${id}`, block: 'negocio', lens: 'produto', status: 'queued', ...over,
});

describe('toAgpQuestion', () => {
  it('só copia a lista branca de campos', () => {
    expect(toAgpQuestion(raw({ segredo: 'x' }))).toEqual({
      id: 'q1', text: 'Qual é o gargalo hoje?', block: 'negocio', lens: 'produto', status: 'queued',
    });
  });
  it('lente ausente ou desconhecida vira null (modo vendas)', () => {
    expect(toAgpQuestion(raw({ lens: null }))?.lens).toBeNull();
    expect(toAgpQuestion(raw({ lens: 'financeiro' }))?.lens).toBeNull();
  });
  it.each([
    ['sem id', raw({ id: '' })],
    ['texto vazio', raw({ text: '   ' })],
    ['status dismissed', raw({ status: 'dismissed' })],
    ['não é objeto', 'texto'],
    ['nulo', null],
  ])('rejeita: %s', (_name, value) => {
    expect(toAgpQuestion(value)).toBeNull();
  });
});

describe('parseAgpMessage', () => {
  it('initial_state: lista só as válidas', () => {
    const msg = parseAgpMessage(JSON.stringify({ event: 'initial_state', data: { questions: [raw(), raw({ id: '' }), 5] } }));
    expect(msg).toEqual({ kind: 'initial', questions: [expect.objectContaining({ id: 'q1' })] });
  });
  it('initial_state sem questions vira lista vazia', () => {
    expect(parseAgpMessage(JSON.stringify({ event: 'initial_state', data: {} }))).toEqual({ kind: 'initial', questions: [] });
  });
  it('question_new e question_expired', () => {
    expect(parseAgpMessage(JSON.stringify({ event: 'question_new', data: raw() }))).toMatchObject({ kind: 'new' });
    expect(parseAgpMessage(JSON.stringify({ event: 'question_expired', data: { id: 'q1' } }))).toEqual({ kind: 'expired', id: 'q1' });
  });
  it.each([
    ['json inválido', '{nao'],
    ['evento que não interessa', JSON.stringify({ event: 'budget_update', data: {} })],
    ['sem event', JSON.stringify({ data: {} })],
    ['question_new inválida', JSON.stringify({ event: 'question_new', data: { id: 'x' } })],
    ['expired sem id', JSON.stringify({ event: 'question_expired', data: {} })],
    ['array', '[]'],
  ])('ignora: %s', (_name, text) => {
    expect(parseAgpMessage(text)).toBeNull();
  });
});

describe('applyAgpMessage', () => {
  it('initial substitui a lista', () => {
    expect(applyAgpMessage([q('a')], { kind: 'initial', questions: [q('b')] })).toEqual([q('b')]);
  });
  it('new acrescenta; repetida devolve a mesma referência', () => {
    const list = [q('a')];
    expect(applyAgpMessage(list, { kind: 'new', question: q('b') })).toEqual([q('a'), q('b')]);
    expect(applyAgpMessage(list, { kind: 'new', question: q('a') })).toBe(list);
  });
  it('expired remove; id desconhecido devolve a mesma referência', () => {
    const list = [q('a'), q('b')];
    expect(applyAgpMessage(list, { kind: 'expired', id: 'a' })).toEqual([q('b')]);
    expect(applyAgpMessage(list, { kind: 'expired', id: 'zzz' })).toBe(list);
  });
  it('respeita o teto defensivo, descartando as mais antigas', () => {
    const many = Array.from({ length: AGP_MAX_QUESTIONS }, (_, i) => q(`p${i}`));
    const next = applyAgpMessage(many, { kind: 'new', question: q('novo') });
    expect(next).toHaveLength(AGP_MAX_QUESTIONS);
    expect(next[0]?.id).toBe('p1');
    expect(next.at(-1)?.id).toBe('novo');
  });
});

describe('tetos de tamanho (WR-03)', () => {
  it('corta texto e bloco enormes e recusa id enorme', () => {
    const question = toAgpQuestion(raw({ text: 'x'.repeat(5_000), block: 'b'.repeat(500) }));
    expect(question?.text).toHaveLength(1_000);
    expect(question?.block).toHaveLength(64);
    expect(toAgpQuestion(raw({ id: 'i'.repeat(129) }))).toBeNull();
  });
});

describe('o teto não derruba as fixadas primeiro (WR-02)', () => {
  it('estourando o teto, saem as mais antigas NÃO fixadas; a fixada do começo continua', () => {
    const list = [q('fixa', { status: 'pinned' }), ...Array.from({ length: AGP_MAX_QUESTIONS - 1 }, (_, i) => q(`p${i}`))];
    const next = applyAgpMessage(list, { kind: 'new', question: q('novo') });
    expect(next).toHaveLength(AGP_MAX_QUESTIONS);
    expect(next.map((x) => x.id)).toContain('fixa');
    expect(next.map((x) => x.id)).not.toContain('p0');
    expect(next.at(-1)?.id).toBe('novo');
  });
});
