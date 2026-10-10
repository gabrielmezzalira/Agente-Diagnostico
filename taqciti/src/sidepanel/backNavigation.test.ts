import { describe, expect, it } from 'vitest';
import { canGoBackWithinExtension } from './backNavigation';

const HISTORY_PAGE = 'chrome-extension://abcdef/src/sidepanel/index.html?view=history';
const CONFIG_PAGE = 'chrome-extension://abcdef/src/sidepanel/index.html?view=agente';
/** Aba com mais de uma entrada: há para onde voltar. */
const WITH_HISTORY = 2;

describe('canGoBackWithinExtension', () => {
  it('referrer é outra página da própria extensão: pode voltar no histórico', () => {
    expect(canGoBackWithinExtension(HISTORY_PAGE, CONFIG_PAGE, WITH_HISTORY)).toBe(true);
  });

  it('referrer vazio (aba aberta direto, ícone, menu do painel): não volta', () => {
    expect(canGoBackWithinExtension('', CONFIG_PAGE, WITH_HISTORY)).toBe(false);
  });

  it('referrer de um site externo: não volta, para não tirar a pessoa da extensão', () => {
    expect(
      canGoBackWithinExtension('https://meet.google.com/abc-defg-hij', CONFIG_PAGE, WITH_HISTORY),
    ).toBe(false);
  });

  it('referrer de OUTRA extensão: não volta', () => {
    expect(
      canGoBackWithinExtension(
        'chrome-extension://outra/index.html?view=history',
        CONFIG_PAGE,
        WITH_HISTORY,
      ),
    ).toBe(false);
  });

  it('referrer que não é uma URL válida: não volta', () => {
    expect(canGoBackWithinExtension('isto nao e url', CONFIG_PAGE, WITH_HISTORY)).toBe(false);
  });

  it('página atual que não é uma URL válida: não volta', () => {
    expect(canGoBackWithinExtension(HISTORY_PAGE, '', WITH_HISTORY)).toBe(false);
  });

  it('aba nova com uma entrada só no histórico (WR-05): não volta, mesmo com referrer da extensão', () => {
    expect(canGoBackWithinExtension(HISTORY_PAGE, CONFIG_PAGE, 1)).toBe(false);
  });

  it('histórico vazio (0): não volta', () => {
    expect(canGoBackWithinExtension(HISTORY_PAGE, CONFIG_PAGE, 0)).toBe(false);
  });
});
