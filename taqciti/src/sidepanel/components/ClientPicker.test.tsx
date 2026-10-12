/**
 * Teste de componente do ClientPicker (D-08, UI-SPEC §3): estados da lista, busca sem acento,
 * seleção em DOIS passos (clicar na linha só marca; quem confirma é o botão do rodapé), teclado e
 * texto de cliente renderizado como texto. Mesmo padrão de Toggle.test.tsx (createRoot + act).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientSummary } from '@/features/agente/clientDirectory';
import { ClientPicker } from './ClientPicker';

type PickerProps = Parameters<typeof ClientPicker>[0];

const CLIENTS: ClientSummary[] = [
  { id: 'c-beta', client: 'Beta SA', name: 'Beta SA' },
  { id: 'c-acai', client: 'Açaí Ltda', name: 'Pipeline de vendas' },
  { id: 'c-sp', client: 'São Paulo Tech', name: 'Dashboard' },
];

describe('ClientPicker — lista, busca e seleção', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  function render(overrides: Partial<PickerProps> = {}) {
    const props: PickerProps = {
      status: 'ready',
      clients: CLIENTS,
      mode: 'live',
      busy: false,
      error: null,
      onConfirm: () => {},
      onCreate: () => {},
      onManualId: () => {},
      onRetry: () => {},
      onBack: () => {},
      ...overrides,
    };
    act(() => root.render(<ClientPicker {...props} />));
  }

  const buttonByText = (text: string) =>
    Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);
  const searchInput = () => host.querySelector<HTMLInputElement>('input')!;
  const rows = () => Array.from(host.querySelectorAll<HTMLLIElement>('ul[aria-label="Clientes"] > li'));
  const rowButton = (index: number) => rows()[index]!.querySelector('button')!;

  function typeInto(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    act(() => {
      setter.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  it('loading: 4 linhas-esqueleto, "Carregando clientes…" polite, busca e criar desabilitados, sem campo de ID', () => {
    render({ status: 'loading', clients: [] });

    expect(host.querySelectorAll('[data-skeleton-row]')).toHaveLength(4);
    const live = host.querySelector('[aria-live="polite"]')!;
    expect(live.textContent).toBe('Carregando clientes…');
    expect(searchInput().disabled).toBe(true);
    expect(buttonByText('Criar cliente novo')!.disabled).toBe(true);
    expect(host.textContent).not.toContain('ID da sessão do Agente');
  });

  it('ready sem clientes: mensagem de vazio, corpo e ação "Criar cliente novo"', () => {
    render({ clients: [] });

    expect(host.textContent).toContain('Nenhum cliente cadastrado ainda.');
    expect(host.textContent).toContain('Crie o primeiro para vincular esta reunião.');
    expect(buttonByText('Criar cliente novo')!.disabled).toBe(false);
    expect(rows()).toHaveLength(0);
  });

  it('ready com 3 clientes: contador, ordem alfabética, sem dica quando projeto = cliente; "acai" -> Resultados · 1', () => {
    render();

    expect(host.textContent).toContain('3 clientes');
    expect(rows().map((li) => li.getAttribute('title'))).toEqual(['Açaí Ltda', 'Beta SA', 'São Paulo Tech']);
    expect(rows()[0]!.textContent).toContain('Pipeline de vendas');
    // "Beta SA" tem projeto igual ao cliente: só o rótulo, sem linha de dica.
    expect(rows()[1]!.querySelectorAll('.text-caption')).toHaveLength(0);

    typeInto(searchInput(), 'acai');

    expect(host.textContent).toContain('Resultados · 1');
    expect(rows()).toHaveLength(1);
  });

  it('busca sem resultado: "Nenhum cliente com “xyz”." e a ação "Criar cliente “xyz”"', () => {
    render();
    typeInto(searchInput(), 'xyz');

    expect(host.textContent).toContain('Nenhum cliente com “xyz”.');
    expect(buttonByText('Criar cliente “xyz”')).toBeDefined();
    expect(rows()).toHaveLength(0);
  });

  it('clicar na linha seleciona sem confirmar; de novo desmarca; outra linha troca a seleção', () => {
    const onConfirm = vi.fn();
    render({ onConfirm });

    act(() => rowButton(0).click());
    expect(rowButton(0).getAttribute('aria-pressed')).toBe('true');
    expect(onConfirm).not.toHaveBeenCalled();

    act(() => rowButton(0).click());
    expect(rowButton(0).getAttribute('aria-pressed')).toBe('false');

    act(() => rowButton(0).click());
    act(() => rowButton(1).click());
    expect(rowButton(0).getAttribute('aria-pressed')).toBe('false');
    expect(rowButton(1).getAttribute('aria-pressed')).toBe('true');
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('CTA do rodapé: "Vincular reunião" (live) / "Enviar reunião" (ended); desabilitado sem seleção; confirma uma vez', () => {
    const onConfirm = vi.fn();
    render({ onConfirm });
    expect(buttonByText('Vincular reunião')!.disabled).toBe(true);

    // Ordem alfabética: a linha 0 é "Açaí Ltda" (c-acai).
    act(() => rowButton(0).click());
    expect(buttonByText('Vincular reunião')!.disabled).toBe(false);
    act(() => buttonByText('Vincular reunião')!.click());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(CLIENTS[1]);

    render({ mode: 'ended', onConfirm });
    expect(buttonByText('Enviar reunião')).toBeDefined();
    expect(host.textContent).toContain('A transcrição guardada será enviada para a sessão deste cliente.');
  });

  it('busy: CTA "Vinculando…"/"Enviando…" desabilitado e lista com aria-busy', () => {
    render({ busy: true });
    expect(buttonByText('Vinculando…')!.disabled).toBe(true);
    expect(host.querySelector('ul[aria-label="Clientes"]')!.getAttribute('aria-busy')).toBe('true');

    render({ busy: true, mode: 'ended' });
    expect(buttonByText('Enviando…')!.disabled).toBe(true);
  });

  it('status error: mensagem documentada e "Tentar de novo" chama onRetry', () => {
    const onRetry = vi.fn();
    render({ status: 'error', clients: [], onRetry });

    expect(host.textContent).toContain(
      'Não consegui carregar os clientes. Confira a conexão e tente de novo — ou cole abaixo o ID de uma sessão que já existe.',
    );
    act(() => buttonByText('Tentar de novo')!.click());
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('↓ no campo de busca foca a primeira linha; Esc chama onBack e não chega ao document', () => {
    const onBack = vi.fn();
    const documentListener = vi.fn();
    document.addEventListener('keydown', documentListener);
    render({ onBack });

    act(() => {
      searchInput().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    expect(document.activeElement).toBe(rowButton(0));

    act(() => {
      searchInput().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    act(() => {
      rowButton(0).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(onBack).toHaveBeenCalledTimes(2);
    expect(documentListener).not.toHaveBeenCalled();
    document.removeEventListener('keydown', documentListener);
  });

  it('nome com HTML aparece como texto literal e o li leva o nome completo em title', () => {
    const evil = '<img src=x onerror=alert(1)>';
    render({ clients: [{ id: 'c-evil', client: evil, name: evil }] });

    expect(host.querySelector('img')).toBeNull();
    expect(rows()[0]!.textContent).toContain(evil);
    expect(rows()[0]!.getAttribute('title')).toBe(evil);
  });
});
