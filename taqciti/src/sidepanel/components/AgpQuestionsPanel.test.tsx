/**
 * O painel AGP (Fase 10): cada estado do espelho do Agente. Só apresentação, por props — sem storage.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AgpQuestion } from '@/features/agente/agpQuestions';
import type { AgpFeed } from '@/shared/config/agpQuestionsStore';
import { AgpQuestionsPanel } from './AgpQuestionsPanel';

const SID = '11111111-1111-1111-1111-111111111111';
const q = (id: string, over: Partial<AgpQuestion> = {}): AgpQuestion => ({
  id, text: `Pergunta ${id}?`, block: 'negocio', lens: 'produto', status: 'queued', ...over,
});

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

async function show(feed: AgpFeed) {
  await act(async () => root.render(<AgpQuestionsPanel feed={feed} />));
}
const text = () => host.textContent ?? '';

describe('AgpQuestionsPanel', () => {
  it('sem sessão vinculada: só o aviso, nunca pergunta', async () => {
    await show({ sessionId: null, connection: 'idle', questions: [q('a')] });
    expect(text()).toContain('Vincule esta reunião a um cliente');
    expect(text()).not.toContain('Pergunta a?');
  });

  it('sessão que não está ativa (4004): avisa e não lista', async () => {
    await show({ sessionId: SID, connection: 'idle', questions: [] });
    expect(text()).toContain('A sessão do Agente não está ativa');
  });

  it('ao vivo e vazio: explica que as perguntas aparecem conforme o Agente gera', async () => {
    await show({ sessionId: SID, connection: 'live', questions: [] });
    expect(text()).toContain('Nenhuma pergunta por enquanto');
    expect(host.querySelector('[role="status"]')).toBeNull();
  });

  it('mostra cada pergunta com a lente, e "Fixada" quando for o caso', async () => {
    await show({
      sessionId: SID,
      connection: 'live',
      questions: [q('a'), q('b', { lens: 'dados' }), q('c', { lens: null, status: 'pinned' })],
    });
    const items = Array.from(host.querySelectorAll('li')).map((li) => li.textContent);
    expect(items).toEqual(['ProdutoPergunta a?', 'DadosPergunta b?', 'FixadaPergunta c?']);
  });

  it.each(['connecting', 'reconnecting'] as const)('%s não desenha faixa própria (ela mora na linha das abas) e mantém as perguntas', async (connection) => {
    await show({ sessionId: SID, connection, questions: [q('a')] });
    expect(host.querySelector('[role="status"]')).toBeNull();
    expect(text()).toContain('Pergunta a?');
  });
});

describe('AgpQuestionsPanel — estado "Pausado" e faixa fixa (10-07)', () => {
  it('paused com perguntas: sem faixa própria, e a lista recebida continua visível', async () => {
    await show({ sessionId: SID, connection: 'paused', questions: [q('a'), q('b', { lens: 'dados' })] });
    expect(host.querySelector('[role="status"]')).toBeNull();
    const items = Array.from(host.querySelectorAll('li')).map((li) => li.textContent);
    expect(items).toEqual(['ProdutoPergunta a?', 'DadosPergunta b?']);
  });

  it('paused sem perguntas: aviso próprio, sem a frase do ao vivo', async () => {
    await show({ sessionId: SID, connection: 'paused', questions: [] });
    expect(text()).toContain('Nenhuma pergunta foi recebida antes da pausa.');
    expect(text()).not.toContain('Nenhuma pergunta por enquanto');
  });

  it('ao vivo: nenhuma faixa de status', async () => {
    await show({ sessionId: SID, connection: 'live', questions: [q('a')] });
    expect(host.querySelector('[role="status"]')).toBeNull();
  });

  it('a lista não é aria-live', async () => {
    await show({ sessionId: SID, connection: 'live', questions: [q('a')] });
    expect(host.querySelector('[aria-live]')).toBeNull();
  });
});

describe('AgpQuestionsPanel — rolagem, texto longo e emblemas (10-07, M-3)', () => {
  it('a região rolável usa scroll-region e entra na ordem de tabulação', async () => {
    await show({ sessionId: SID, connection: 'live', questions: [q('a')] });
    const scroller = host.querySelector('ul')?.parentElement;
    expect(scroller?.classList.contains('scroll-region')).toBe(true);
    expect(scroller?.getAttribute('tabindex')).toBe('0');
    expect(scroller?.classList.contains('outline-none')).toBe(true);
  });

  it('pergunta sem lente e não fixada: o cartão só tem o parágrafo do texto', async () => {
    await show({ sessionId: SID, connection: 'live', questions: [q('a', { lens: null, status: 'queued' })] });
    const li = host.querySelector('li');
    expect(li?.children).toHaveLength(1);
    expect(li?.querySelector('div')).toBeNull();
    expect(li?.textContent).toBe('Pergunta a?');
  });

  it('pergunta com lente: a linha de emblemas existe', async () => {
    await show({ sessionId: SID, connection: 'live', questions: [q('a')] });
    expect(host.querySelector('li div')).not.toBeNull();
  });

  it('o texto quebra (break-words) e o cartão anima a entrada respeitando movimento reduzido', async () => {
    await show({ sessionId: SID, connection: 'live', questions: [q('a')] });
    const li = host.querySelector('li');
    expect(li?.querySelector('p')?.classList.contains('break-words')).toBe(true);
    expect(li?.classList.contains('animate-fade-in')).toBe(true);
    expect(li?.classList.contains('motion-reduce:animate-none')).toBe(true);
  });
});

describe('AgpQuestionsPanel — aviso sem vínculo por superfície (10-09, M-5)', () => {
  const FIRST = 'Vincule esta reunião a um cliente para ver aqui as perguntas do Agente.';
  const SECOND = 'O vínculo é feito no painel do TaqCITi dentro do Meet.';
  const unlinked: AgpFeed = { sessionId: null, connection: 'idle', questions: [] };

  it('saída larga sem vínculo: as duas frases, a primeira idêntica à de sempre', async () => {
    await act(async () => root.render(<AgpQuestionsPanel feed={unlinked} surface="wide" />));
    expect(text()).toContain(FIRST);
    expect(text()).toContain(SECOND);
    expect(text()).toBe(`${FIRST} ${SECOND}`);
  });

  it.each([
    ['sem surface (padrão)', undefined],
    ['surface="panel"', 'panel'],
  ] as const)('%s: só a primeira frase, nunca a do vínculo no Meet', async (_label, surface) => {
    await act(async () => root.render(<AgpQuestionsPanel feed={unlinked} surface={surface} />));
    expect(text()).toBe(FIRST);
    expect(text()).not.toContain(SECOND);
  });

  it('com vínculo, a superfície larga não muda nada nos outros avisos', async () => {
    await act(async () => root.render(<AgpQuestionsPanel feed={{ sessionId: SID, connection: 'idle', questions: [] }} surface="wide" />));
    expect(text()).toBe('A sessão do Agente não está ativa. Não há perguntas para mostrar.');
  });
});
