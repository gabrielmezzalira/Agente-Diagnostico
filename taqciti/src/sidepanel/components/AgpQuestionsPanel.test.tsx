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

  it.each([
    ['connecting', 'Conectando ao Agente…'],
    ['reconnecting', 'Reconectando ao Agente…'],
  ] as const)('%s mostra o aviso de conexão e mantém as perguntas', async (connection, notice) => {
    await show({ sessionId: SID, connection, questions: [q('a')] });
    expect(host.querySelector('[role="status"]')?.textContent).toBe(notice);
    expect(text()).toContain('Pergunta a?');
  });
});

describe('AgpQuestionsPanel — estado "Pausado" e faixa fixa (10-07)', () => {
  const PAUSED_TEXT = 'Pausado · mostrando as últimas perguntas';
  const PAUSED_HINT =
    'A atualização volta sozinha quando a captura estiver gravando e o envio ao Agente estiver ligado.';

  it('paused com perguntas: faixa com ícone e dica, e a lista recebida continua visível', async () => {
    await show({ sessionId: SID, connection: 'paused', questions: [q('a'), q('b', { lens: 'dados' })] });
    const banner = host.querySelector('[role="status"]');
    expect(banner?.textContent).toContain(PAUSED_TEXT);
    expect(banner?.getAttribute('title')).toBe(PAUSED_HINT);
    expect(banner?.querySelector('svg')).not.toBeNull();
    const items = Array.from(host.querySelectorAll('li')).map((li) => li.textContent);
    expect(items).toEqual(['ProdutoPergunta a?', 'DadosPergunta b?']);
  });

  it('paused sem perguntas: aviso próprio, sem a frase do ao vivo', async () => {
    await show({ sessionId: SID, connection: 'paused', questions: [] });
    expect(text()).toContain('Nenhuma pergunta foi recebida antes da pausa.');
    expect(text()).not.toContain('Nenhuma pergunta por enquanto');
  });

  it.each(['connecting', 'reconnecting', 'paused'] as const)(
    '%s: a faixa fica fora da região que rola',
    async (connection) => {
      await show({ sessionId: SID, connection, questions: [q('a')] });
      const banner = host.querySelector('[role="status"]');
      const list = host.querySelector('ul');
      expect(banner).not.toBeNull();
      expect(list).not.toBeNull();
      const scroller = list?.parentElement;
      expect(scroller?.contains(banner)).toBe(false);
      expect(banner?.parentElement).toBe(scroller?.parentElement);
    },
  );

  it('ao vivo: nenhuma faixa de status', async () => {
    await show({ sessionId: SID, connection: 'live', questions: [q('a')] });
    expect(host.querySelector('[role="status"]')).toBeNull();
  });

  it('reconnecting: a faixa não tem ícone (só o pausado tem)', async () => {
    await show({ sessionId: SID, connection: 'reconnecting', questions: [q('a')] });
    expect(host.querySelector('[role="status"] svg')).toBeNull();
  });

  it('a lista não é aria-live', async () => {
    await show({ sessionId: SID, connection: 'live', questions: [q('a')] });
    expect(host.querySelector('[aria-live]')).toBeNull();
  });
});
