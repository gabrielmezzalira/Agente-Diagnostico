import { describe, expect, it } from 'vitest';
import { AGENTE_CONFIG_SEARCH, readWideViewRequest } from './route';

describe('readWideViewRequest', () => {
  /*
   * O caminho de abertura que não pede nada: o ícone da extensão e o menu de
   * painel lateral do Chrome. Ali a tela tem mesmo que vir da fase da reunião.
   */
  it('sem query, não força tela nenhuma', () => {
    expect(readWideViewRequest('')).toEqual({
      history: false,
      recordId: null,
      agenteConfig: false,
    });
    expect(readWideViewRequest('?')).toEqual({
      history: false,
      recordId: null,
      agenteConfig: false,
    });
  });

  /*
   * O botão do rodapé do histórico, que era o defeito: com uma reunião em curso
   * a aba abria na transcrição ao vivo e a lista ficava inalcançável.
   */
  it('view=history pede o histórico, sem reunião alvo', () => {
    expect(readWideViewRequest('?view=history')).toEqual({
      history: true,
      recordId: null,
      agenteConfig: false,
    });
  });

  it('uma reunião alvo já implica o histórico', () => {
    expect(readWideViewRequest('?record=abc-123')).toEqual({
      history: true,
      recordId: 'abc-123',
      agenteConfig: false,
    });
    expect(readWideViewRequest('?view=history&record=abc-123')).toEqual({
      history: true,
      recordId: 'abc-123',
      agenteConfig: false,
    });
  });

  /* `?record=` sozinho não é um pedido de reunião — é uma URL truncada. */
  it('record vazio ou só espaços não vale como alvo', () => {
    expect(readWideViewRequest('?record=')).toEqual({
      history: false,
      recordId: null,
      agenteConfig: false,
    });
    expect(readWideViewRequest('?record=%20%20')).toEqual({
      history: false,
      recordId: null,
      agenteConfig: false,
    });
  });

  it('ignora parâmetros que não são dele', () => {
    expect(readWideViewRequest('?utm_source=x&view=summary')).toEqual({
      history: false,
      recordId: null,
      agenteConfig: false,
    });
  });

  /*
   * A tela de configuração do Agente Diagnóstico (Fase 7, plano 03): mesmo
   * mecanismo de `?view=history`, mas sem implicar história nenhuma.
   */
  it('view=agente pede a tela do Agente Diagnóstico', () => {
    expect(readWideViewRequest('?view=agente')).toEqual({
      history: false,
      recordId: null,
      agenteConfig: true,
    });
  });

  /* Só o valor exato conta — nada de match parcial ou case-insensitive. */
  it('só o valor exato "agente" ativa a tela — maiúsculas ou plural não contam', () => {
    expect(readWideViewRequest('?view=AGENTE').agenteConfig).toBe(false);
    expect(readWideViewRequest('?view=agentes').agenteConfig).toBe(false);
  });

  it('AGENTE_CONFIG_SEARCH é a query string exata que ativa a tela', () => {
    expect(AGENTE_CONFIG_SEARCH).toBe('?view=agente');
    expect(readWideViewRequest(AGENTE_CONFIG_SEARCH).agenteConfig).toBe(true);
  });
});
