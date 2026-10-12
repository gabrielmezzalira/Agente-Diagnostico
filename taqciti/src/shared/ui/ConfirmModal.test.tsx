/**
 * Teste de componente do ConfirmModal: o rótulo do botão de recusa (padrão
 * "Cancelar", sobrescrevível por `cancelLabel` — UI-SPEC da Fase 8) e os três
 * caminhos que cancelam (botão, Esc, clique no fundo). Clique dentro da caixa
 * NÃO cancela. Mesmo padrão de Toggle.test.tsx (createRoot + act, sem
 * testing-library).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmModal } from './ConfirmModal';

describe('ConfirmModal', () => {
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

  function render(props: { open?: boolean; cancelLabel?: string; onCancel?: () => void }) {
    act(() => {
      root.render(
        <ConfirmModal
          open={props.open ?? true}
          title="Apagar do histórico?"
          description="Essa ação não pode ser desfeita."
          confirmLabel="Apagar"
          cancelLabel={props.cancelLabel}
          onConfirm={() => {}}
          onCancel={props.onCancel ?? (() => {})}
        />,
      );
    });
  }

  function buttonByText(text: string): HTMLButtonElement | undefined {
    return Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);
  }

  it('sem cancelLabel o botão de recusa mostra "Cancelar"', () => {
    render({});

    expect(buttonByText('Cancelar')).toBeDefined();
  });

  it('com cancelLabel o botão de recusa mostra o texto novo e chama onCancel uma vez', () => {
    const onCancel = vi.fn();
    render({ cancelLabel: 'Manter reunião', onCancel });

    expect(buttonByText('Cancelar')).toBeUndefined();
    const refuse = buttonByText('Manter reunião');
    expect(refuse).toBeDefined();

    act(() => refuse!.click());
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Esc chama onCancel; clique no fundo chama; clique dentro da caixa não chama', () => {
    const onCancel = vi.fn();
    render({ onCancel });

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onCancel).toHaveBeenCalledTimes(1);

    const box = host.querySelector('h2')!.parentElement!;
    act(() => box.click());
    expect(onCancel).toHaveBeenCalledTimes(1);

    const overlay = host.querySelector<HTMLElement>('[role="dialog"]')!;
    act(() => overlay.click());
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('fechado (open=false) não renderiza nada', () => {
    render({ open: false });

    expect(host.innerHTML).toBe('');
  });
});
