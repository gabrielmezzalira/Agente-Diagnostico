/**
 * "← Voltar" da tela do Agente (IN-04): volta para a tela de origem (por
 * exemplo `?view=history`) quando a página anterior é da própria extensão;
 * caso contrário mantém a navegação padrão para "?".
 *
 * O jsdom serve a página em `http://localhost:3000/`; "mesma origem" aqui é
 * essa origem. O caso `chrome-extension://` está em backNavigation.test.ts.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeStorageMock } from '@/test/chromeStorageMock';

const RUNTIME_STUB = { getURL: (path: string) => `chrome-extension://taqciti/${path}` };

describe('AgenteConfigScreen — botão Voltar', () => {
  let host: HTMLDivElement;
  let root: Root;
  let backSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    backSpy.mockRestore();
    delete (document as { referrer?: string }).referrer;
  });

  function setReferrer(value: string): void {
    Object.defineProperty(document, 'referrer', { value, configurable: true });
  }

  /** Clica no Voltar e devolve se o clique foi cancelado (defaultPrevented). */
  async function clickBack(): Promise<boolean> {
    installChromeStorageMock({ local: {}, session: {}, extra: { runtime: RUNTIME_STUB } });
    const { AgenteConfigScreen } = await import('./AgenteConfigScreen');
    await act(async () => {
      root.render(<AgenteConfigScreen />);
    });

    const link = [...host.querySelectorAll('a')].find((a) => /voltar/i.test(a.textContent ?? ''))!;
    // O jsdom não implementa navegação: o listener só observa e cancela o resto.
    let prevented = false;
    const observe = (event: Event) => {
      prevented = event.defaultPrevented;
      event.preventDefault();
    };
    document.addEventListener('click', observe);
    await act(async () => {
      link.click();
    });
    document.removeEventListener('click', observe);
    return prevented;
  }

  it('referrer da própria extensão: chama history.back() e cancela o href', async () => {
    setReferrer(`${window.location.origin}/src/sidepanel/index.html?view=history`);

    expect(await clickBack()).toBe(true);
    expect(backSpy).toHaveBeenCalledTimes(1);
  });

  it('referrer vazio: não chama history.back() e deixa o href="?" agir', async () => {
    setReferrer('');

    expect(await clickBack()).toBe(false);
    expect(backSpy).not.toHaveBeenCalled();
    expect(host.querySelector('a[href="?"]')).not.toBeNull();
  });

  it('referrer externo: não chama history.back()', async () => {
    setReferrer('https://meet.google.com/abc-defg-hij');

    expect(await clickBack()).toBe(false);
    expect(backSpy).not.toHaveBeenCalled();
  });
});
