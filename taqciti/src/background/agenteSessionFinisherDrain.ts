/**
 * Espera a fila de envio de UMA sessão esvaziar (Fase 8, B4-b, plano 08-27). Quando a reunião acaba, a
 * última fala pode ainda estar em voo; encerrar a sessão antes dela chegar tiraria a análise ao vivo dela.
 * A espera é limitada pela graça (10 s em produção): passada a graça, quem chamou decide o que fazer com
 * a fila ainda cheia (armar o prazo de 5 min). Só portas injetadas — sem `chrome` nem relógio próprio.
 */

export interface QueueDrainOptions {
  /** Quantas falas da sessão ainda esperam entrega. */
  count: () => Promise<number>;
  sleep: (ms: number) => Promise<void>;
  /** Quanto esperar, no máximo, pela fila esvaziar. */
  graceMs: number;
  /** De quanto em quanto tempo conferir a fila de novo. */
  checkMs: number;
}

/** Verdadeiro quando a fila da sessão ficou vazia dentro da graça; falso quando a graça acabou com falas nela. */
export async function waitForQueueDrain(options: QueueDrainOptions): Promise<boolean> {
  const { count, sleep, graceMs, checkMs } = options;
  let waited = 0;
  for (;;) {
    if ((await count()) === 0) return true;
    if (waited >= graceMs) return false;
    await sleep(checkMs);
    waited += checkMs;
  }
}
