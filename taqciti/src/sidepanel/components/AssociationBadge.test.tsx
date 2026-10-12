/**
 * Teste do selo de associação do histórico (UI-SPEC §6): cada estado vira um
 * `Badge` com o tom do contrato. Mesmo padrão de Toggle.test.tsx.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AssociationBadge, type AssociationBadgeState } from './AssociationBadge';

const WARNING_TONE = 'bg-amber-400/12';
const PRIMARY_TONE = 'bg-primary/14';

describe('AssociationBadge', () => {
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

  function render(state: AssociationBadgeState) {
    act(() => {
      root.render(<AssociationBadge state={state} />);
    });
    return host.firstElementChild as HTMLElement;
  }

  it('no-client: "Sem cliente" em warning', () => {
    const badge = render('no-client');

    expect(badge.textContent).toBe('Sem cliente');
    expect(badge.className).toContain(WARNING_TONE);
  });

  it('sending: "Enviando" em primary, com ponto animate-pulse-dot', () => {
    const badge = render('sending');

    expect(badge.textContent).toBe('Enviando');
    expect(badge.className).toContain(PRIMARY_TONE);
    expect(badge.querySelector('.animate-pulse-dot')).not.toBeNull();
  });

  it('sent: "Enviada" em primary, sem ponto', () => {
    const badge = render('sent');

    expect(badge.textContent).toBe('Enviada');
    expect(badge.className).toContain(PRIMARY_TONE);
    expect(badge.querySelector('.animate-pulse-dot')).toBeNull();
  });

  it('stopped: "Envio parou" em warning, nunca danger', () => {
    const badge = render('stopped');

    expect(badge.textContent).toBe('Envio parou');
    expect(badge.className).toContain(WARNING_TONE);
    expect(badge.className).not.toContain('text-danger');
  });
});
