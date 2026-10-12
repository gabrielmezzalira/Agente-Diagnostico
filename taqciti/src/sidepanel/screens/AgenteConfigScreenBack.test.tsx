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
import type { Platform } from '@/shared/platform/types';

const RUNTIME_STUB = { getURL: (path: string) => `chrome-extension://taqciti/${path}` };

/**
 * Plataforma falsa (08-18): a tela passou a usar `useClientDirectory`, e `usePlatform()` lança fora de
 * `<PlatformProvider>`. A lista de clientes fica indisponível — com ela, o campo de ID aparece (D-02,
 * plano B), como na Fase 7 —, e as assinaturas não emitem nada.
 */
const UNAVAILABLE_PLATFORM: Platform = {
  kind: 'extension',
  send: <R,>() => Promise.resolve({ ok: false, error: 'unavailable' } as R),
  subscribeMeeting: () => () => {},
  subscribeHistory: () => () => {},
};

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
    delete (window.history as { length?: number }).length;
  });

  function setReferrer(value: string, historyLength = 2): void {
    Object.defineProperty(document, 'referrer', { value, configurable: true });
    // O jsdom começa a aba com 1 entrada; o padrão aqui (2) simula uma aba com para onde voltar.
    Object.defineProperty(window.history, 'length', { value: historyLength, configurable: true });
  }

  /** Clica no Voltar e devolve se o clique foi cancelado (defaultPrevented). */
  async function clickBack(): Promise<boolean> {
    installChromeStorageMock({ local: {}, session: {}, extra: { runtime: RUNTIME_STUB } });
    const { PlatformProvider } = await import('@/shared/platform/context');
    const { AgenteConfigScreen } = await import('./AgenteConfigScreen');
    await act(async () => {
      root.render(
        <PlatformProvider platform={UNAVAILABLE_PLATFORM}>
          <AgenteConfigScreen />
        </PlatformProvider>,
      );
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

  it('aba nova (histórico de 1 entrada) com referrer da extensão: não cancela o href (WR-05)', async () => {
    setReferrer(`${window.location.origin}/src/sidepanel/index.html?view=history`, 1);

    expect(await clickBack()).toBe(false);
    expect(backSpy).not.toHaveBeenCalled();
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
