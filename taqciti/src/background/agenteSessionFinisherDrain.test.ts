/**
 * Espera pelo esvaziamento da fila de envio da sessão (plano 08-27, Task 2, B4-b): a última fala ainda
 * pode estar em voo quando a reunião acaba, então o agendador espera até a graça de 10 s antes de decidir.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  AGENTE_FINISH_DRAIN_CHECK_MS,
  AGENTE_FINISH_DRAIN_GRACE_MS,
} from '@/features/agente/finishPolicy';
import { waitForQueueDrain } from './agenteSessionFinisherDrain';

const timing = { graceMs: AGENTE_FINISH_DRAIN_GRACE_MS, checkMs: AGENTE_FINISH_DRAIN_CHECK_MS };

function countsOf(...values: number[]) {
  const queue = [...values];
  return vi.fn(() => Promise.resolve(queue.length > 1 ? (queue.shift() as number) : (queue[0] as number)));
}

describe('waitForQueueDrain', () => {
  it('fila já vazia -> verdadeiro sem dormir', async () => {
    const sleep = vi.fn(() => Promise.resolve());

    await expect(waitForQueueDrain({ count: countsOf(0), sleep, ...timing })).resolves.toBe(true);

    expect(sleep).not.toHaveBeenCalled();
  });

  it('contagens 1, 1, 0 -> verdadeiro depois de dormir 2 vezes, de 1 s cada', async () => {
    const sleep = vi.fn(() => Promise.resolve());

    await expect(waitForQueueDrain({ count: countsOf(1, 1, 0), sleep, ...timing })).resolves.toBe(true);

    expect(sleep.mock.calls).toEqual([[1_000], [1_000]]);
  });

  it('fila sempre cheia -> falso depois de esgotar a graça de 10 s (10 esperas)', async () => {
    const sleep = vi.fn(() => Promise.resolve());

    await expect(waitForQueueDrain({ count: countsOf(1), sleep, ...timing })).resolves.toBe(false);

    expect(sleep).toHaveBeenCalledTimes(10);
  });

  it('esvazia na última conferência da graça -> ainda verdadeiro', async () => {
    const sleep = vi.fn(() => Promise.resolve());
    const count = countsOf(...Array<number>(10).fill(1), 0);

    await expect(waitForQueueDrain({ count, sleep, ...timing })).resolves.toBe(true);

    expect(sleep).toHaveBeenCalledTimes(10);
  });
});
