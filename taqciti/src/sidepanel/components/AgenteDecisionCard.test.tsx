/**
 * Teste de componente do AgenteDecisionCard ("Esta reunião é de qual cliente?",
 * D-06 / UI-SPEC §2): cópia exata, os três caminhos que significam "Depois"
 * (botão, ×, Esc) e o Esc contido — o painel ouve Esc em `document` e minimizaria
 * a janela junto (Pitfall 11). Mesmo padrão de Toggle.test.tsx (createRoot + act).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgenteDecisionCard } from './AgenteDecisionCard';

describe('AgenteDecisionCard', () => {
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

  function render(handlers: { onSelect?: () => void; onDefer?: () => void } = {}) {
    act(() => {
      root.render(
        <AgenteDecisionCard onSelect={handlers.onSelect ?? (() => {})} onDefer={handlers.onDefer ?? (() => {})} />,
      );
    });
  }

  function buttonByText(text: string): HTMLButtonElement {
    return Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim() === text)!;
  }

  it('mostra título e corpo exatos do UI-SPEC', () => {
    render();

    expect(host.textContent).toContain('Esta reunião é de qual cliente?');
    expect(host.textContent).toContain(
      'Enquanto você não escolher, a Taqciti só guarda a transcrição neste navegador. Nada vai para o Agente.',
    );
    expect(host.querySelector('[role="region"]')!.getAttribute('aria-label')).toBe(
      'Esta reunião é de qual cliente?',
    );
  });

  it('"Selecionar cliente agora" chama onSelect e não onDefer', () => {
    const onSelect = vi.fn();
    const onDefer = vi.fn();
    render({ onSelect, onDefer });

    act(() => buttonByText('Selecionar cliente agora').click());

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onDefer).not.toHaveBeenCalled();
  });

  it('"Depois" e o × ("Fechar aviso") chamam onDefer', () => {
    const onDefer = vi.fn();
    render({ onDefer });

    act(() => buttonByText('Depois').click());
    expect(onDefer).toHaveBeenCalledTimes(1);

    const close = host.querySelector<HTMLButtonElement>('button[aria-label="Fechar aviso"]')!;
    expect(close).not.toBeNull();
    act(() => close.click());
    expect(onDefer).toHaveBeenCalledTimes(2);
  });

  it('Esc com o foco no cartão chama onDefer uma vez e não chega ao listener de document', () => {
    const onDefer = vi.fn();
    const documentListener = vi.fn();
    document.addEventListener('keydown', documentListener);
    render({ onDefer });

    const inside = buttonByText('Depois');
    act(() => {
      inside.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(onDefer).toHaveBeenCalledTimes(1);
    expect(documentListener).not.toHaveBeenCalled();
    document.removeEventListener('keydown', documentListener);
  });

  it('outras teclas dentro do cartão não chamam onDefer e continuam propagando', () => {
    const onDefer = vi.fn();
    const documentListener = vi.fn();
    document.addEventListener('keydown', documentListener);
    render({ onDefer });

    act(() => {
      buttonByText('Depois').dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    });

    expect(onDefer).not.toHaveBeenCalled();
    expect(documentListener).toHaveBeenCalledTimes(1);
    document.removeEventListener('keydown', documentListener);
  });

  it('montar não muda o foco do documento (sem autoFocus)', () => {
    const outside = document.createElement('input');
    document.body.append(outside);
    outside.focus();

    render();

    expect(document.activeElement).toBe(outside);
    outside.remove();
  });
});
