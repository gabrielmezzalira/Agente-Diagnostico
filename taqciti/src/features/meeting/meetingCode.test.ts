/**
 * Regra única de "qual é a sala desta URL" (plano 08-28, CR-02): tabela dos formatos de endereço do Meet nos
 * dois modos. Teste invariante: todo formato suportado da MESMA sala devolve o MESMO código — vermelho no
 * instante em que alguém reintroduzir uma regra presa a um formato.
 */
import { describe, expect, it } from 'vitest';
import { meetingCodeFromPath } from './meetingCode';

const CODE = 'abc-defg-hij';

describe('meetingCodeFromPath — modo exato (padrão, content script)', () => {
  it.each([
    ['formato antigo', `/${CODE}`, CODE],
    ['formato novo', `/meet/${CODE}`, CODE],
    ['caixa do código preservada', `/${CODE.toUpperCase()}`, CODE.toUpperCase()],
    ['prefixo /MEET/ sem diferenciar caixa', `/MEET/${CODE}`, CODE],
  ])('%s: %s -> código', (_nome, path, esperado) => {
    expect(meetingCodeFromPath(path)).toBe(esperado);
  });

  it.each([
    ['subcaminho no formato novo', `/meet/${CODE}/extra`],
    ['subcaminho no formato antigo', `/${CODE}/extra`],
    ['barra final', `/${CODE}/`],
    ['raiz', '/'],
    ['landing', '/landing'],
    ['/meet sem código', '/meet'],
    ['/meet/ sem código', '/meet/'],
    ['código curto', '/meet/abc'],
    ['outro prefixo', `/outro/${CODE}`],
    ['código comprido demais', '/abc-defg-hijk'],
    ['caminho vazio', ''],
  ])('%s: %s -> null', (_nome, path) => {
    expect(meetingCodeFromPath(path)).toBeNull();
  });
});

describe('meetingCodeFromPath — modo com subcaminho (service worker)', () => {
  const opts = { allowSubpath: true };

  it.each([
    ['formato antigo', `/${CODE}`],
    ['formato novo', `/meet/${CODE}`],
    ['/MEET/ em maiúsculas', `/MEET/${CODE}`],
    ['subcaminho no formato novo', `/meet/${CODE}/extra`],
    ['subcaminho no formato antigo', `/${CODE}/extra`],
    ['barra final', `/${CODE}/`],
  ])('%s: %s -> código', (_nome, path) => {
    expect(meetingCodeFromPath(path, opts)).toBe(CODE);
  });

  it('preserva a caixa do código', () => {
    expect(meetingCodeFromPath(`/${CODE.toUpperCase()}`, opts)).toBe(CODE.toUpperCase());
  });

  it.each(['/', '/landing', '/meet', '/meet/', '/meet/abc', `/outro/${CODE}`, '/abc-defg-hijk', ''])(
    '%s -> null',
    (path) => {
      expect(meetingCodeFromPath(path, opts)).toBeNull();
    },
  );
});

describe('meetingCodeFromPath — sem estado escondido', () => {
  it.each([undefined, { allowSubpath: true }])('chamada repetida dá o mesmo resultado (opções %j)', (opts) => {
    const first = meetingCodeFromPath(`/meet/${CODE}`, opts);
    expect(meetingCodeFromPath(`/meet/${CODE}`, opts)).toBe(first);
    expect(meetingCodeFromPath(`/meet/${CODE}`, opts)).toBe(CODE);
  });
});
