/**
 * Esc contido (Pitfall 11): o painel ouve Esc em `document` e recolhe a janela. Dentro do seletor
 * e do formulário de cliente novo o Esc só volta um passo; por isso para a propagação (a do React
 * e a nativa) antes de avisar quem decide o que "voltar" significa.
 *
 * Devolve `true` quando a tecla era Esc (e foi tratada), para o chamador não olhar outras teclas.
 */
import type { KeyboardEvent } from 'react';

export function containEscape(event: KeyboardEvent<HTMLElement>, onEscape: () => void): boolean {
  if (event.key !== 'Escape') return false;
  event.stopPropagation();
  event.nativeEvent.stopImmediatePropagation();
  onEscape();
  return true;
}
