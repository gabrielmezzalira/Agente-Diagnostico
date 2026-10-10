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

/**
 * `true` quando `referrer` é uma página da mesma origem (a mesma extensão) que `currentUrl`
 * **e** existe uma entrada anterior no histórico da aba. Numa aba nova (Ctrl/Cmd+clique, clique do
 * meio) o referrer continua sendo da extensão, mas o histórico tem uma entrada só: `history.back()`
 * não faria nada e o botão ficaria morto — melhor deixar o `href="?"` agir.
 */
export function canGoBackWithinExtension(
  referrer: string,
  currentUrl: string,
  historyLength: number,
): boolean {
  if (historyLength <= 1) return false;
  const referrerOrigin = originKey(referrer);
  const currentOrigin = originKey(currentUrl);
  return referrerOrigin !== null && referrerOrigin === currentOrigin;
}
