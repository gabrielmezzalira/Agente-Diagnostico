/**
 * Trava de layout do painel injetado no Meet (não há teste de composição do PanelApp, e o jsdom não calcula
 * layout): a janela é um `grid` de largura fixa e QUALQUER texto longo que não quebra linha (nome de cliente na
 * barra de vínculo, título da reunião) alarga a coluna implícita do grid, porque item de grid tem largura mínima
 * automática igual ao conteúdo. O corpo e o cabeçalho passam dos 396 px, o `overflow-hidden` corta o que sobra e os
 * botões do cabeçalho e o "Finalizar" somem para fora do painel (medido no Meet real: corpo de 684 px).
 *
 * O `truncate` da barra só atua se a coluna for limitada. As LINHAS já eram (`minmax(0,1fr)`); as COLUNAS têm de
 * ser também. Se alguém tirar `grid-cols-[minmax(0,1fr)]` do `<section>`, este teste avisa antes do Meet.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compactLayoutFor } from './compactLayout';

const PANEL_APP = readFileSync(resolve(process.cwd(), 'src/content/ui/PanelApp.tsx'), 'utf-8');

describe('PanelApp — a janela não alarga com texto longo', () => {
  it('o <section> do painel limita as linhas E as colunas do grid', () => {
    const linha = PANEL_APP.split('\n').find((l) => l.includes('grid-rows-[auto_minmax(0,1fr)]'));
    expect(linha, 'não achei o <section> do painel (grid-rows-[auto_minmax(0,1fr)])').toBeDefined();
    expect(linha).toContain('grid-cols-[minmax(0,1fr)]');
  });
});

describe('PanelApp — o aviso de legendas divide a faixa do vínculo (10-14, G-10-7)', () => {
  const FRASE = 'As legendas do Meet pararam de chegar. Religando sozinho.';

  it('o aviso passa pelo stripNotice do AgenteLiveSlot (uma ligação só)', () => {
    expect(PANEL_APP.split('stripNotice={').length - 1).toBe(1);
    expect(PANEL_APP).toContain('stripNotice={ctx.captureHealthy ? null : CAPTURE_STALL_NOTICE}');
  });

  it('existe uma cópia só do texto do aviso no PanelApp', () => {
    expect(PANEL_APP.split(FRASE).length - 1).toBe(1);
  });
});

describe('PanelApp — o aviso de conta vazio não reserva espaço (10-14, G-10-7)', () => {
  it('o wrapper do AccountBoundaryNotice tem empty:hidden (e segue com mb-2 shrink-0)', () => {
    const linhas = PANEL_APP.split('\n');
    const i = linhas.findIndex((l) => l.includes('<AccountBoundaryNotice boundary={session.accountBoundary} compact />'));
    expect(i, 'não achei o AccountBoundaryNotice do LiveBody').toBeGreaterThan(0);
    const wrapper = linhas[i - 1]!;
    expect(wrapper).toContain('empty:hidden');
    expect(wrapper).toContain('mb-2');
    expect(wrapper).toContain('shrink-0');
  });
});

describe('PanelApp — o compacto esconde o nome da reunião e junta as estatísticas aos botões (10-17, G-10-7)', () => {
  it('só o tamanho compacto esconde o campo "Nome da reunião"', () => {
    expect(compactLayoutFor('compact').showMeetingTitleField).toBe(false);
    expect(compactLayoutFor('regular').showMeetingTitleField).toBe(true);
    expect(compactLayoutFor('tall').showMeetingTitleField).toBe(true);
  });

  it('o title do PanelHeader usa a regra do compacto e mantém a regra antiga do histórico', () => {
    const inicio = PANEL_APP.indexOf('<PanelHeader');
    expect(inicio, 'não achei o <PanelHeader no PanelApp').toBeGreaterThan(-1);
    const fim = PANEL_APP.indexOf('status={', inicio);
    expect(fim, 'não achei o status={ depois do <PanelHeader').toBeGreaterThan(inicio);
    const trecho = PANEL_APP.slice(inicio, fim);
    expect(trecho).toContain('showMeetingTitleField');
    expect(trecho).toContain("route.kind !== 'auto'");
  });

  it('o campo "Nome da reunião" continua existindo uma vez só (médio e alto renomeiam como antes)', () => {
    expect(PANEL_APP.split('aria-label="Nome da reunião"').length - 1).toBe(1);
  });

  it('só o tamanho compacto põe as estatísticas na linha dos botões', () => {
    expect(compactLayoutFor('compact').statsInControlsRow).toBe(true);
    expect(compactLayoutFor('regular').statsInControlsRow).toBe(false);
    expect(compactLayoutFor('tall').statsInControlsRow).toBe(false);
  });

  it('no LiveControls, {stats} fica depois do copiar e antes do ícone do Finalizar', () => {
    const inicio = PANEL_APP.indexOf('function LiveControls(');
    expect(inicio, 'não achei function LiveControls(').toBeGreaterThan(-1);
    const fim = PANEL_APP.indexOf('const LANGUAGE_NAMES', inicio);
    expect(fim, 'não achei const LANGUAGE_NAMES depois do LiveControls').toBeGreaterThan(inicio);
    const trecho = PANEL_APP.slice(inicio, fim);
    const copiar = trecho.indexOf('<CopyIcon />');
    const stats = trecho.indexOf('{stats}');
    const parar = trecho.indexOf('name="stop"');
    expect(copiar).toBeGreaterThan(-1);
    expect(stats).toBeGreaterThan(copiar);
    expect(parar).toBeGreaterThan(stats);
  });

  it('o LiveBody decide o lugar das estatísticas com statsInControlsRow e passa stats={ ao LiveControls', () => {
    const inicio = PANEL_APP.indexOf('function LiveBody(');
    expect(inicio, 'não achei function LiveBody(').toBeGreaterThan(-1);
    const fim = PANEL_APP.indexOf('function PanelHeader(', inicio);
    expect(fim, 'não achei function PanelHeader( depois do LiveBody').toBeGreaterThan(inicio);
    const trecho = PANEL_APP.slice(inicio, fim);
    expect(trecho).toContain('statsInControlsRow');
    expect(trecho).toContain('stats={');
  });

  it('as classes da linha própria, da linha dos botões e a raiz do LiveControls aparecem uma vez só', () => {
    const vezes = (trecho: string) => PANEL_APP.split(trecho).length - 1;
    expect(vezes('mt-2.5 shrink-0 px-1 text-caption')).toBe(1);
    expect(vezes('min-w-0 flex-1 px-1 text-caption leading-tight')).toBe(1);
    expect(vezes('mt-2.5 flex shrink-0 items-center gap-1.5')).toBe(1);
  });
});
