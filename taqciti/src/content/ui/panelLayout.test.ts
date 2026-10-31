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
