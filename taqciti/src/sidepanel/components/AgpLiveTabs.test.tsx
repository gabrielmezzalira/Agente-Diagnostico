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
