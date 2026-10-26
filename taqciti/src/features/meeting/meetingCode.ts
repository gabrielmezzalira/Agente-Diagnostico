/**
 * Regra ÚNICA de "qual é a sala desta URL" do Meet (Fase 8, plano 08-28, CR-02). Puro: sem DOM, sem `chrome`.
 *
 * O Meet escreve o endereço de dois jeitos: `meet.google.com/<código>` e, desde que passou a reescrever a URL,
 * `meet.google.com/meet/<código>`. O CR-02 nasceu de DUAS regras que divergiram: o content script aprendeu o
 * formato novo e o service worker continuou olhando só o primeiro pedaço do caminho (que agora é a palavra
 * "meet"), encerrando reuniões ao vivo a cada mudança de URL. Por isso os dois lados usam esta função.
 *
 * Dois modos, da MESMA gramática (3-4-3 de letras e dígitos, prefixo `meet/` opcional, sem diferenciar caixa):
 * - exato (padrão, content script): o caminho termina logo depois do código. Erra para o lado de não ver
 *   reunião onde não há.
 * - `allowSubpath` (service worker): depois do código pode vir `/algo`. Erra para o lado de não encerrar uma
 *   reunião que continua na mesma sala.
 *
 * O código volta exatamente como veio no caminho (sem mudar a caixa): quem compara decide a caixa. As
 * expressões não usam as flags `g`/`y`, então não guardam posição entre chamadas.
 */
export interface MeetingCodeFromPathOptions {
  /** Aceita um subcaminho depois do código (`/<código>/algo`). Padrão: false (modo exato). */
  allowSubpath?: boolean;
}

const CODE = '([a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3})';
const EXACT_PATH = new RegExp(`^/(?:meet/)?${CODE}$`, 'i');
const SUBPATH_PATH = new RegExp(`^/(?:meet/)?${CODE}(?:/|$)`, 'i');

/** O código da sala em `pathname` (sem `?query` nem `#hash`), ou `null` se o caminho não é de uma sala. */
export function meetingCodeFromPath(
  pathname: string,
  options: MeetingCodeFromPathOptions = {},
): string | null {
  const pattern = options.allowSubpath === true ? SUBPATH_PATH : EXACT_PATH;
  return pattern.exec(pathname)?.[1] ?? null;
}
