/**
 * A URL do WebSocket da sessão (Fase 10): esquema certo, prefixo preservado e recusa de entrada inválida.
 */
import { describe, expect, it } from 'vitest';
import { buildAgpSocketUrl } from './agenteRoutes';

const SID = '11111111-1111-1111-1111-111111111111';

describe('buildAgpSocketUrl', () => {
  it('https vira wss, http de loopback vira ws', () => {
    expect(buildAgpSocketUrl('https://agente.exemplo.com', SID)).toBe(`wss://agente.exemplo.com/ws/${SID}`);
    expect(buildAgpSocketUrl('http://localhost:8000', SID)).toBe(`ws://localhost:8000/ws/${SID}`);
  });
  it('preserva um prefixo de caminho e ignora a barra final', () => {
    expect(buildAgpSocketUrl('https://exemplo.com/api/', SID)).toBe(`wss://exemplo.com/api/ws/${SID}`);
  });
  it.each([
    ['http fora do loopback', 'http://exemplo.com', SID],
    ['com query', 'https://exemplo.com?x=1', SID],
    ['esquema ftp', 'ftp://exemplo.com', SID],
    ['vazia', '', SID],
    ['id fora do formato', 'https://exemplo.com', 'nao-e-uuid'],
    ['id vazio', 'https://exemplo.com', ''],
  ])('recusa: %s', (_name, url, id) => {
    expect(buildAgpSocketUrl(url, id)).toBeNull();
  });
});
