/**
 * Decisão do "← Voltar" das telas abertas por link dentro da própria extensão.
 *
 * O `href="?"` cai no roteamento por fase e perde a tela de origem: quem veio
 * de `?view=history` acabava na tela da reunião de agora. `history.back()`
 * devolve a pessoa exatamente para onde ela estava — mas só é seguro quando a
 * página anterior é da própria extensão. Se a aba foi aberta direto (ícone,
 * menu do painel) ou veio de fora, voltar no histórico a tiraria da extensão;
 * nesse caso vale o `href="?"` de sempre.
 *
 * Pura de propósito: recebe as duas URLs em vez de ler `document`/`window`.
 */

/** Só `protocol` + `host` — `URL.origin` devolve "null" para `chrome-extension:` fora do Chrome. */
function originKey(rawUrl: string): string | null {
  try {
    const { protocol, host } = new URL(rawUrl);
    return `${protocol}//${host}`;
  } catch {
    return null;
  }
}

/** `true` quando `referrer` é uma página da mesma origem (a mesma extensão) que `currentUrl`. */
export function canGoBackWithinExtension(referrer: string, currentUrl: string): boolean {
  const referrerOrigin = originKey(referrer);
  const currentOrigin = originKey(currentUrl);
  return referrerOrigin !== null && referrerOrigin === currentOrigin;
}
