/**
 * Teste da barra de vínculo ao vivo (D-12, D-18, UI-SPEC §4). Mesmo padrão de
 * Toggle.test.tsx: createRoot + act, sem testing-library.
 *
 * A barra só desenha o "modelo de visão" que recebe — a tradução do estado do
 * domínio para ele é do hook de fiação (plano 08-14).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgenteBindingBar, type BindingBarView } from './AgenteBindingBar';

const OFFLINE_TEXT =
  'O Agente está fora do ar. Guardando as falas aqui e reenviando quando ele voltar.';
const STOPPED_TEXT =
  'O envio parou na parte 7 de 30. O que já chegou continua no Agente.';

describe('AgenteBindingBar', () => {
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

  function render(view: BindingBarView, onSelectClient?: () => void) {
    act(() => {
      root.render(<AgenteBindingBar view={view} onSelectClient={onSelectClient} />);
    });
    return host.firstElementChild as HTMLElement;
  }

  it('deferred: mostra "Sem cliente" e o botão Selecionar cliente chama onSelectClient', () => {
    const onSelectClient = vi.fn();
    render({ kind: 'deferred' }, onSelectClient);

    expect(host.textContent).toContain('Sem cliente. A transcrição fica só aqui.');
    const button = host.querySelector<HTMLButtonElement>('button')!;
    expect(button.textContent).toBe('Selecionar cliente');
    expect(button.className).toContain('shrink-0');

    act(() => button.click());
    expect(onSelectClient).toHaveBeenCalledTimes(1);
  });

  it('linking: texto de envio sem contador e "3 de 12" aparece uma única vez (no trilho)', () => {
    render({ kind: 'linking', done: 3, total: 12 });

    expect(host.textContent).toContain('Enviando o que já foi falado…');
    expect(host.textContent!.split('3 de 12')).toHaveLength(2);
    expect(host.querySelector('.tabular-nums')?.textContent).toBe('3 de 12');
  });

  it('linked: ponto verde, texto em text-glow e nome longo truncado com title', () => {
    const longName = 'Cliente '.repeat(26).trim();
    expect(longName.length).toBeGreaterThanOrEqual(200);
    const bar = render({ kind: 'linked', clientName: longName });

    expect(host.textContent).toContain('Enviando ao vivo para');
    expect(bar.className).toContain('text-glow');
    const nameEl = host.querySelector<HTMLElement>(`[title="${longName}"]`)!;
    expect(nameEl).not.toBeNull();
    expect(nameEl.className).toContain('truncate');
    expect(nameEl.className).toContain('min-w-0');
    expect(host.querySelector('.bg-primary')).not.toBeNull();
  });

  it('linked: o nome do cliente é texto literal, nunca HTML', () => {
    render({ kind: 'linked', clientName: '<img src=x onerror=alert(1)>' });

    expect(host.querySelector('img')).toBeNull();
    expect(host.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('offline: aviso warning com role status, aria-live polite e singular "1 fala na fila"', () => {
    render({ kind: 'offline', clientName: 'Empresa X', queued: 1 });

    const status = host.querySelector('[role="status"]')!;
    expect(status).not.toBeNull();
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toContain(OFFLINE_TEXT);
    expect(status.textContent).toContain('1 fala na fila');
    expect(status.textContent).not.toContain('1 falas');
    expect(status.className).toContain('border-[#f2c94c]/25');
    expect(status.className).toContain('text-[#f7dd8f]');
  });

  it('offline: plural "5 falas na fila" com tabular-nums', () => {
    render({ kind: 'offline', clientName: 'Empresa X', queued: 5 });

    expect(host.textContent).toContain('5 falas na fila');
    expect(host.querySelector('.tabular-nums')).not.toBeNull();
  });

  it('rejected: mostra exatamente o texto recebido, como aviso warning', () => {
    const text = 'O Agente recusou a chave. Confira a chave de API nas configurações.';
    render({ kind: 'rejected', text });

    const status = host.querySelector('[role="status"]')!;
    expect(status.textContent).toBe(text);
    expect(status.className).toContain('border-[#f2c94c]/25');
  });

  it('stopped: texto de parada em warning, sem text-danger em nenhum estado de parada', () => {
    render({ kind: 'stopped', done: 7, total: 30 });

    const status = host.querySelector('[role="status"]')!;
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toBe(STOPPED_TEXT);
    expect(host.innerHTML).not.toContain('text-danger');

    render({ kind: 'offline', clientName: 'Empresa X', queued: 2 });
    expect(host.innerHTML).not.toContain('text-danger');
    render({ kind: 'rejected', text: 'recusada' });
    expect(host.innerHTML).not.toContain('text-danger');
  });

  it.each<BindingBarView>([
    { kind: 'deferred' },
    { kind: 'linking', done: 1, total: 2 },
    { kind: 'linked', clientName: 'Empresa X' },
    { kind: 'offline', clientName: 'Empresa X', queued: 3 },
    { kind: 'rejected', text: 'recusada' },
    { kind: 'stopped', done: 1, total: 2 },
  ])('$kind: contêiner de uma linha com no mínimo 40 px', (view) => {
    const bar = render(view);

    expect(bar.className).toContain('min-h-[40px]');
    expect(bar.className).toContain('flex');
    expect(bar.className).toContain('items-center');
  });
});
