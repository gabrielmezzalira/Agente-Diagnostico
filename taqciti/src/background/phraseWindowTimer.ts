/**
 * O único timer da janela por fala do streamer do Agente (Fase 7, plano
 * 07-04): arma para o próximo prazo do buffer ou, depois de um tick que
 * falhou, para uma nova tentativa (WR-12). Nunca existem dois vivos.
 */
export function createPhraseWindowTimer(onFire: () => void) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  function fire(): void {
    timer = null;
    onFire();
  }

  function cancel(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  /** Rearma para `deadline` (epoch ms); `null` só cancela. */
  function armAt(deadline: number | null, now: number): void {
    cancel();
    if (deadline !== null) {
      timer = setTimeout(fire, Math.max(0, deadline - now));
    }
  }

  /** Arma só se nada estiver armado — usado pelo retry defensivo do tick (WR-12). */
  function armIfIdle(delayMs: number): void {
    if (timer === null) {
      timer = setTimeout(fire, delayMs);
    }
  }

  return { armAt, armIfIdle, cancel };
}
