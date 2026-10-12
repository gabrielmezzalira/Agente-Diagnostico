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
const NOW = Date.parse('2026-10-12T20:00:10Z');
const q = (id: string, over: Partial<AgpQuestion> = {}): AgpQuestion => ({
  id, text: `Pergunta ${id}?`, block: 'negocio', lens: 'produto', status: 'queued', expiresAt: null, ...over,
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
  await act(async () => root.render(<AgpQuestionsPanel feed={feed} nowMs={NOW} />));
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

  it('a pergunta vencida some; a fixada continua', async () => {
    await show({
      sessionId: SID,
      connection: 'live',
      questions: [
        q('vencida', { expiresAt: '2026-10-12T20:00:05Z' }),
        q('valida', { expiresAt: '2026-10-12T20:00:30Z' }),
        q('fixa', { status: 'pinned', expiresAt: '2000-01-01T00:00:00Z' }),
      ],
    });
    expect(text()).not.toContain('Pergunta vencida?');
    expect(text()).toContain('Pergunta valida?');
    expect(text()).toContain('Pergunta fixa?');
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
