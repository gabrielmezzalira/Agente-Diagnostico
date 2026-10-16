/**
 * Teste de componente do Toggle (liga/desliga): papel de switch, estado exposto
 * por `aria-checked`, clique dispara `onChange` com o valor novo e `disabled`
 * não dispara. Mesmo padrão de TranscriptView.test.tsx (createRoot + act, sem
 * testing-library).
 *
 * O teclado (Espaço/Enter) é do próprio <button> nativo — o navegador converte
 * a tecla em clique. O jsdom não faz essa conversão, então aqui garantimos o
 * que a garante: o elemento é um <button type="button"> focável, sem tabindex
 * negativo nem handler de tecla próprio (que dispararia duas vezes).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Toggle } from './Toggle';

describe('Toggle', () => {
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

  function render(props: { checked: boolean; disabled?: boolean; onChange?: (next: boolean) => void }) {
    act(() => {
      root.render(
        <Toggle
          checked={props.checked}
          disabled={props.disabled}
          onChange={props.onChange ?? (() => {})}
          label="Enviar ao Agente"
        />,
      );
    });
    return host.querySelector<HTMLButtonElement>('[role="switch"]')!;
  }

  it('expõe role="switch" com o rótulo como nome acessível', () => {
    const toggle = render({ checked: false });

    expect(toggle).not.toBeNull();
    expect(toggle.textContent).toContain('Enviar ao Agente');
  });

  it('aria-checked reflete a prop checked', () => {
    expect(render({ checked: false }).getAttribute('aria-checked')).toBe('false');
    expect(render({ checked: true }).getAttribute('aria-checked')).toBe('true');
  });

  it('clicar dispara onChange com o valor oposto ao atual', () => {
    const onChange = vi.fn();
    const toggle = render({ checked: false, onChange });

    act(() => toggle.click());
    expect(onChange).toHaveBeenLastCalledWith(true);

    const ligado = render({ checked: true, onChange });
    act(() => ligado.click());
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it('é um <button type="button"> focável — Espaço e Enter vêm do navegador', () => {
    const toggle = render({ checked: false });

    expect(toggle.tagName).toBe('BUTTON');
    expect(toggle.type).toBe('button');
    expect(toggle.tabIndex).toBeGreaterThanOrEqual(0);
  });

  it('disabled não dispara onChange', () => {
    const onChange = vi.fn();
    const toggle = render({ checked: false, disabled: true, onChange });

    act(() => toggle.click());

    expect(toggle.disabled).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });
});
