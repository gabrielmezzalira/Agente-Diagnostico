/**
 * Teste do cartão de fim da reunião e do envio em partes (D-09, D-10, D-11,
 * UI-SPEC §5). Mesmo padrão de Toggle.test.tsx: createRoot + act.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgenteEndPrompt, type EndPromptView } from './AgenteEndPrompt';

const FAILED_TEXT = 'O envio parou na parte 7 de 30. O que já chegou continua no Agente.';
const CLOSED_TEXT =
  'A sessão no Agente já foi encerrada. O restante entra na transcrição, mas o relatório precisa ser gerado de novo.';
const SUPPORT_TEXT =
  'A transcrição continua guardada na Taqciti. Você pode copiá-la ou baixá-la enquanto isso.';

describe('AgenteEndPrompt', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  function render(
    view: EndPromptView,
    handlers: { onSelectClient?: () => void; onDiscard?: () => void; onResume?: () => void } = {},
  ) {
    act(() => {
      root.render(<AgenteEndPrompt view={view} {...handlers} />);
    });
    return host.firstElementChild as HTMLElement;
  }

  const buttons = () => Array.from(host.querySelectorAll<HTMLButtonElement>('button'));
  const longName = 'Cliente '.repeat(26).trim();

  it('ask: título, corpo, Selecionar cliente (primary) e Descartar (danger/80) em linha', () => {
    const onSelectClient = vi.fn();
    const onDiscard = vi.fn();
    render({ kind: 'ask' }, { onSelectClient, onDiscard });

    expect(host.textContent).toContain('Enviar esta reunião ao Agente?');
    expect(host.textContent).toContain(
      'Ela está guardada só na Taqciti. Escolha o cliente ou descarte.',
    );
    const [select, discard] = buttons();
    expect(buttons()).toHaveLength(2);
    expect(select!.textContent).toBe('Selecionar cliente');
    expect(discard!.textContent).toBe('Descartar');
    expect(discard!.className).toContain('text-danger/80');
    expect(select!.parentElement).toBe(discard!.parentElement);
    expect(select!.parentElement!.className).toContain('flex');

    act(() => select!.click());
    act(() => discard!.click());
    expect(onSelectClient).toHaveBeenCalledTimes(1);
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it('sending: "Enviando para {cliente}…" com trilho "1 de 1" e nenhum botão Cancelar', () => {
    render({ kind: 'sending', clientName: 'Empresa X', done: 1, total: 1 });

    expect(host.textContent).toContain('Enviando para Empresa X…');
    expect(host.querySelector('.tabular-nums')?.textContent).toBe('1 de 1');
    expect(host.textContent).not.toContain('Cancelar');
    // O único botão do ProgressRail é o "Voltar" desabilitado e invisível.
    const enabled = buttons().filter((button) => !button.disabled);
    expect(enabled).toHaveLength(0);
  });

  it('sending: progresso em partes mostra "{x} de {y}" uma única vez', () => {
    render({ kind: 'sending', clientName: 'Empresa X', done: 4, total: 30 });

    expect(host.textContent!.split('4 de 30')).toHaveLength(2);
  });

  it('sending: nome de 200+ caracteres vira title com o nome completo e truncate', () => {
    render({ kind: 'sending', clientName: longName, done: 1, total: 3 });

    const nameEl = host.querySelector<HTMLElement>(`[title="${longName}"]`)!;
    expect(nameEl).not.toBeNull();
    expect(nameEl.className).toContain('truncate');
  });

  it('sent: Icon check em text-primary + "Reunião enviada para {cliente}."', () => {
    render({ kind: 'sent', clientName: 'Empresa X' });

    expect(host.textContent).toContain('Reunião enviada para Empresa X.');
    expect(host.querySelector('svg.text-primary')).not.toBeNull();
  });

  it('sent: nome longo truncado com title', () => {
    render({ kind: 'sent', clientName: longName });

    const nameEl = host.querySelector<HTMLElement>(`[title="${longName}"]`)!;
    expect(nameEl).not.toBeNull();
    expect(nameEl.className).toContain('truncate');
  });

  it('failed: texto de parada em warning + linha de apoio, sem botão e sem danger', () => {
    render({ kind: 'failed', done: 7, total: 30 });

    const status = host.querySelector('[role="status"]')!;
    expect(status.textContent).toBe(FAILED_TEXT);
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.className).toContain('border-[#f2c94c]/25');
    expect(host.textContent).toContain(SUPPORT_TEXT);
    expect(buttons()).toHaveLength(0);
    expect(host.innerHTML).not.toContain('text-danger');
    expect(host.textContent).not.toContain('Continuar envio');
  });

  it('failed sem sessionClosed: nenhuma linha extra de sessão encerrada', () => {
    render({ kind: 'failed', done: 7, total: 30 });
    expect(host.textContent).not.toContain('já foi encerrada');
  });

  it('failed com onResume: botão "Continuar envio" (secondary) no lugar da linha de apoio; o clique chama onResume', () => {
    const onResume = vi.fn();
    render({ kind: 'failed', done: 7, total: 30 }, { onResume });

    expect(host.querySelector('[role="status"]')!.textContent).toBe(FAILED_TEXT);
    expect(buttons()).toHaveLength(1);
    expect(buttons()[0]!.textContent).toBe('Continuar envio');
    expect(host.textContent).not.toContain(SUPPORT_TEXT);
    expect(host.innerHTML).not.toContain('text-danger');
    act(() => buttons()[0]!.click());
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it('failed com sessionClosed (DA-2): a linha exata do UI-SPEC em warning, com ou sem o botão', () => {
    render({ kind: 'failed', done: 7, total: 30, sessionClosed: true });
    expect(host.textContent).toContain(CLOSED_TEXT);
    expect(host.textContent).toContain(SUPPORT_TEXT);
    expect(buttons()).toHaveLength(0);
    const closed = Array.from(host.querySelectorAll('p')).find((p) => p.textContent === CLOSED_TEXT)!;
    expect(closed.className).toContain('border-[#f2c94c]/25');

    render({ kind: 'failed', done: 7, total: 30, sessionClosed: true }, { onResume: vi.fn() });
    expect(host.textContent).toContain(CLOSED_TEXT);
    expect(buttons().map((b) => b.textContent)).toEqual(['Continuar envio']);
    // a linha de aviso vem acima do botão
    const text = host.textContent ?? '';
    expect(text.indexOf(CLOSED_TEXT)).toBeLessThan(text.indexOf('Continuar envio'));
  });

  it('linked-note: "Enviada para {cliente}" em text-caption text-muted, com nome truncado', () => {
    const note = render({ kind: 'linked-note', clientName: longName });

    expect(note.textContent).toBe(`Enviada para ${longName}`);
    expect(note.className).toContain('text-caption');
    expect(note.className).toContain('text-muted');
    const nameEl = host.querySelector<HTMLElement>(`[title="${longName}"]`)!;
    expect(nameEl.className).toContain('truncate');
  });

  it('o nome do cliente é texto literal, nunca HTML', () => {
    render({ kind: 'sent', clientName: '<img src=x onerror=alert(1)>' });

    expect(host.querySelector('img')).toBeNull();
    expect(host.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});
