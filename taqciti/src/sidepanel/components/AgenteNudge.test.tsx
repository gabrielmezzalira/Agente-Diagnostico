/**
 * Teste de componente do AgenteNudge (bolha "!" do aviso de reunião detectada,
 * D-07 / UI-SPEC §1): nome acessível, só anima enquanto `bouncing`, duas
 * ancoragens (cabeçalho clicável, cápsula decorativa), cor de aviso (nunca o
 * verde da marca) e nenhum foco roubado ao montar. Mesmo padrão de
 * Toggle.test.tsx (createRoot + act, sem testing-library).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgenteNudge } from './AgenteNudge';

const NAME = 'Reunião detectada. Escolher o cliente no Agente.';

describe('AgenteNudge', () => {
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

  function render(props: { anchor: 'capsule' | 'header'; bouncing: boolean; onActivate?: () => void }) {
    act(() => {
      root.render(<AgenteNudge {...props} />);
    });
  }

  it('no cabeçalho é um botão com aria-label e title exatos, caixa de 32px e círculo de 20px em warning', () => {
    render({ anchor: 'header', bouncing: true });

    const button = host.querySelector<HTMLButtonElement>('button')!;
    expect(button).not.toBeNull();
    expect(button.type).toBe('button');
    expect(button.getAttribute('aria-label')).toBe(NAME);
    expect(button.getAttribute('title')).toBe(NAME);
    expect(button.className).toContain('h-8');
    expect(button.className).toContain('w-8');

    const circle = button.querySelector<HTMLElement>('span')!;
    expect(circle.className).toContain('h-5');
    expect(circle.className).toContain('w-5');
    expect(circle.className).toContain('bg-[#F2C94C]');
    expect(circle.className).not.toContain('bg-primary');
    expect(circle.querySelector('svg')).not.toBeNull();
  });

  it('anima com animate-nudge enquanto bouncing e fica parada quando não', () => {
    render({ anchor: 'header', bouncing: true });
    expect(host.innerHTML).toContain('animate-nudge');

    render({ anchor: 'header', bouncing: false });
    expect(host.innerHTML).not.toContain('animate-nudge');
    expect(host.querySelector('button')).not.toBeNull();
  });

  it('clicar na bolha do cabeçalho chama onActivate uma vez', () => {
    const onActivate = vi.fn();
    render({ anchor: 'header', bouncing: true, onActivate });

    act(() => host.querySelector<HTMLButtonElement>('button')!.click());

    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('na cápsula é decorativa: aria-hidden, sem botão, sem pointer events, 4px para fora do canto', () => {
    render({ anchor: 'capsule', bouncing: true });

    expect(host.querySelector('button')).toBeNull();
    const bubble = host.firstElementChild as HTMLElement;
    expect(bubble.getAttribute('aria-hidden')).toBe('true');
    expect(bubble.className).toContain('pointer-events-none');
    expect(bubble.className).toContain('-right-1');
    expect(bubble.className).toContain('-top-1');
    expect(bubble.className).toContain('bg-[#F2C94C]');
    expect(bubble.className).toContain('animate-nudge');
  });

  it('montar não muda o foco do documento (sem autoFocus)', () => {
    const outside = document.createElement('input');
    document.body.append(outside);
    outside.focus();

    render({ anchor: 'header', bouncing: true });
    expect(document.activeElement).toBe(outside);

    render({ anchor: 'capsule', bouncing: true });
    expect(document.activeElement).toBe(outside);

    outside.remove();
  });
});
