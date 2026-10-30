/**
 * As abas "Transcrição | AGP" (Fase 10): transcrição por padrão, troca de aba e leitura do storage que o
 * service worker escreve (`chrome.storage.local` simulado, o mesmo caminho de produção).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '@/shared/config/constants';
import { installChromeStorageMock } from '@/test/chromeStorageMock';
import { AgpLiveTabs } from './AgpLiveTabs';

const SID = '11111111-1111-1111-1111-111111111111';
const question = (id: string, lens: string) => ({
  id, text: `Pergunta ${id}?`, block: 'negocio', lens, status: 'queued',
});

let host: HTMLDivElement;
let root: Root;
let mock: ReturnType<typeof installChromeStorageMock>;

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  mock = installChromeStorageMock();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<AgpLiveTabs><p>TRANSCRICAO</p></AgpLiveTabs>));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

const tab = (name: string) => Array.from(host.querySelectorAll('[role="tab"]')).find((el) => el.textContent?.startsWith(name)) as HTMLElement;
const click = (el: HTMLElement) => act(async () => el.click());
const writeFeed = (value: unknown) => act(async () => { await mock.local.set({ [STORAGE_KEYS.agpQuestions]: value }); });

describe('AgpLiveTabs', () => {
  it('abre na transcrição; a aba AGP está presente mas não selecionada', () => {
    expect(host.textContent).toContain('TRANSCRICAO');
    expect(tab('Transcrição').getAttribute('aria-selected')).toBe('true');
    expect(tab('AGP').getAttribute('aria-selected')).toBe('false');
  });

  it('sem vínculo, a aba AGP mostra o aviso e nenhuma pergunta', async () => {
    await click(tab('AGP'));
    expect(host.textContent).not.toContain('TRANSCRICAO');
    expect(host.textContent).toContain('Vincule esta reunião a um cliente');
  });

  it('o que o service worker grava aparece na aba, com a lente, e o contador sobe', async () => {
    await writeFeed({ sessionId: SID, connection: 'live', questions: [question('a', 'produto'), question('b', 'dados')] });
    expect(tab('AGP').textContent).toBe('AGP2');
    await click(tab('AGP'));
    expect(Array.from(host.querySelectorAll('li')).map((li) => li.textContent)).toEqual([
      'ProdutoPergunta a?',
      'DadosPergunta b?',
    ]);
  });

  it('chega pergunta nova com a aba aberta, sem recarregar', async () => {
    await writeFeed({ sessionId: SID, connection: 'live', questions: [question('a', 'produto')] });
    await click(tab('AGP'));
    await writeFeed({ sessionId: SID, connection: 'live', questions: [question('a', 'produto'), question('c', 'dados')] });
    expect(host.querySelectorAll('li')).toHaveLength(2);
  });

  it('o vínculo some (a call acabou): a aba volta ao aviso', async () => {
    await writeFeed({ sessionId: SID, connection: 'live', questions: [question('a', 'produto')] });
    await click(tab('AGP'));
    await writeFeed({ sessionId: null, connection: 'idle', questions: [] });
    expect(host.textContent).toContain('Vincule esta reunião a um cliente');
    expect(host.querySelectorAll('li')).toHaveLength(0);
  });

  it('voltar para Transcrição devolve a transcrição', async () => {
    await click(tab('AGP'));
    await click(tab('Transcrição'));
    expect(host.textContent).toContain('TRANSCRICAO');
  });
});

describe('AgpLiveTabs — aviso sem vínculo por superfície (10-09, M-5)', () => {
  const FIRST = 'Vincule esta reunião a um cliente para ver aqui as perguntas do Agente.';
  const SECOND = 'O vínculo é feito no painel do TaqCITi dentro do Meet.';

  it('surface="wide" sem vínculo: a aba AGP também diz onde vincular', async () => {
    const wideHost = document.createElement('div');
    document.body.append(wideHost);
    const wideRoot = createRoot(wideHost);
    try {
      await act(async () => wideRoot.render(<AgpLiveTabs surface="wide"><p>TRANSCRICAO</p></AgpLiveTabs>));
      const agp = Array.from(wideHost.querySelectorAll('[role="tab"]')).find((el) => el.textContent?.startsWith('AGP')) as HTMLElement;
      await click(agp);
      expect(wideHost.textContent).toContain(FIRST);
      expect(wideHost.textContent).toContain(SECOND);
    } finally {
      await act(async () => wideRoot.unmount());
      wideHost.remove();
    }
  });

  it('sem surface (painel do Meet): só a primeira frase', async () => {
    await click(tab('AGP'));
    expect(host.textContent).toContain(FIRST);
    expect(host.textContent).not.toContain(SECOND);
  });
});

describe('AgpLiveTabs — abas acessíveis (10-09, M-4)', () => {
  const tabpanel = () => host.querySelector('[role="tabpanel"]') as HTMLElement;
  const focusTab = (el: HTMLElement) => act(async () => el.focus());
  /** Dispara a tecla no elemento e devolve o evento, para conferir se o padrão do navegador foi evitado. */
  const press = async (el: HTMLElement, key: string) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    await act(async () => { el.dispatchEvent(event); });
    return event;
  };

  it('0 perguntas: a aba AGP não tem aria-label e o contador não aparece', () => {
    expect(tab('AGP').hasAttribute('aria-label')).toBe(false);
    expect(tab('AGP').textContent).toBe('AGP');
  });

  it('1 pergunta: aria-label no singular e o texto visível continua "AGP1"', async () => {
    await writeFeed({ sessionId: SID, connection: 'live', questions: [question('a', 'produto')] });
    expect(tab('AGP').getAttribute('aria-label')).toBe('AGP, 1 pergunta');
    expect(tab('AGP').textContent).toBe('AGP1');
  });

  it('2 ou mais perguntas: aria-label no plural e o texto visível continua "AGP2"', async () => {
    await writeFeed({ sessionId: SID, connection: 'live', questions: [question('a', 'produto'), question('b', 'dados')] });
    expect(tab('AGP').getAttribute('aria-label')).toBe('AGP, 2 perguntas');
    expect(tab('AGP').textContent).toBe('AGP2');
  });

  it('a aba Transcrição nunca tem aria-label', async () => {
    await writeFeed({ sessionId: SID, connection: 'live', questions: [question('a', 'produto')] });
    expect(tab('Transcrição').hasAttribute('aria-label')).toBe(false);
  });

  it('cada aba tem id e aria-controls; o tabpanel é rotulado pela aba selecionada', async () => {
    expect(tabpanel()).not.toBeNull();
    for (const name of ['Transcrição', 'AGP']) {
      expect(tab(name).id).not.toBe('');
      expect(tab(name).getAttribute('aria-controls')).toBe(tabpanel().id);
    }
    expect(tabpanel().getAttribute('aria-labelledby')).toBe(tab('Transcrição').id);
    await click(tab('AGP'));
    expect(tabpanel().getAttribute('aria-labelledby')).toBe(tab('AGP').id);
    expect(tab('Transcrição').id).not.toBe(tab('AGP').id);
  });

  it('o tabpanel guarda o corpo da aba e mantém o layout flex que deixa a transcrição rolar', async () => {
    expect(tabpanel().textContent).toContain('TRANSCRICAO');
    for (const cls of ['flex', 'min-h-0', 'flex-1', 'flex-col']) expect(tabpanel().classList.contains(cls)).toBe(true);
    await click(tab('AGP'));
    expect(tabpanel().textContent).toContain('Vincule esta reunião');
  });

  it('tabIndex móvel: 0 na aba selecionada e -1 na outra', async () => {
    expect(tab('Transcrição').tabIndex).toBe(0);
    expect(tab('AGP').tabIndex).toBe(-1);
    await click(tab('AGP'));
    expect(tab('Transcrição').tabIndex).toBe(-1);
    expect(tab('AGP').tabIndex).toBe(0);
  });

  it('ArrowRight no foco em Transcrição seleciona AGP e leva o foco; ArrowLeft volta', async () => {
    await focusTab(tab('Transcrição'));
    const right = await press(tab('Transcrição'), 'ArrowRight');
    expect(right.defaultPrevented).toBe(true);
    expect(tab('AGP').getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tab('AGP'));
    const left = await press(tab('AGP'), 'ArrowLeft');
    expect(left.defaultPrevented).toBe(true);
    expect(tab('Transcrição').getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tab('Transcrição'));
    expect(host.textContent).toContain('TRANSCRICAO');
  });

  it('só as setas esquerda e direita mexem nas abas; outras teclas passam intactas', async () => {
    await focusTab(tab('Transcrição'));
    for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' ', 'Tab']) {
      const event = await press(tab('Transcrição'), key);
      expect(event.defaultPrevented).toBe(false);
      expect(tab('Transcrição').getAttribute('aria-selected')).toBe('true');
    }
  });

  it('as abas têm altura h-8 e não usam py-1', () => {
    for (const name of ['Transcrição', 'AGP']) {
      expect(tab(name).classList.contains('h-8')).toBe(true);
      expect(tab(name).classList.contains('py-1')).toBe(false);
    }
  });

  it('duas instâncias ao mesmo tempo não repetem ids', async () => {
    const otherHost = document.createElement('div');
    document.body.append(otherHost);
    const otherRoot = createRoot(otherHost);
    try {
      await act(async () => otherRoot.render(<AgpLiveTabs><p>OUTRA</p></AgpLiveTabs>));
      const ids = [...host.querySelectorAll('[id]'), ...otherHost.querySelectorAll('[id]')].map((el) => el.id);
      expect(ids.length).toBeGreaterThanOrEqual(6);
      expect(new Set(ids).size).toBe(ids.length);
    } finally {
      await act(async () => otherRoot.unmount());
      otherHost.remove();
    }
  });
});
