/**
 * Aviso amarelo de uma faixa só (G-10-7): o alarme de captura ("as legendas pararam de chegar")
 * desenhado sozinho, quando não existe a barra de vínculo para dividir a caixa com ele.
 *
 * Apresentacional puro. O texto vem de fora como constante do código (nunca HTML).
 */
export function StripNotice({ children }: { children: string }) {
  return (
    <p className="mb-2 shrink-0 rounded-control border border-[#f2c94c]/25 bg-[#f2c94c]/10 px-3 py-2 text-caption leading-relaxed text-[#f7dd8f]">
      {children}
    </p>
  );
}
