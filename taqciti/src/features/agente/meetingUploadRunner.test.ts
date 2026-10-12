/**
 * Executor serial do envio em partes (D-10): ordem, um em voo, pausa entre blocos,
 * novas tentativas, parada no primeiro problema e retomada. `send` e `sleep` são fakes.
 */
import { describe, expect, it } from 'vitest';
import { runMeetingUpload } from './meetingUploadRunner';
import type { UploadPart } from './meetingUploader';
import type { SendAttemptResult } from './sendRetryPolicy';

const OK: SendAttemptResult = { kind: 'response', ok: true, status: 202 };
const NETWORK_DOWN: SendAttemptResult = { kind: 'network-error' };

function response(status: number): SendAttemptResult {
  return { kind: 'response', ok: status >= 200 && status < 300, status };
}

function makeParts(count: number): UploadPart[] {
  return Array.from({ length: count }, (_, index) => ({
    index,
    key: `${index}:c${index}`,
    chunkId: `bulk:m1:${index}`,
    text: `fala ${index}`,
    speaker: 'Ana',
    words: 2,
  }));
}

function makeSleep() {
  const calls: number[] = [];
  return {
    calls,
    sleep: async (ms: number) => {
      calls.push(ms);
    },
  };
}

describe('runMeetingUpload', () => {
  it('envia 45 partes na ordem, com 2 pausas de 1000 ms e progresso 1..45', async () => {
    const parts = makeParts(45);
    const sent: number[] = [];
    const progress: Array<[number, number]> = [];
    const { calls, sleep } = makeSleep();

    const outcome = await runMeetingUpload({
      parts,
      send: async (part) => {
        sent.push(part.index);
        return OK;
      },
      sleep,
      onProgress: (done, total) => progress.push([done, total]),
    });

    expect(outcome).toEqual({ status: 'completed' });
    expect(sent).toEqual(parts.map((part) => part.index));
    expect(calls).toEqual([1000, 1000]);
    expect(progress).toHaveLength(45);
    expect(progress[0]).toEqual([1, 45]);
    expect(progress[44]).toEqual([45, 45]);
  });

  it('não pausa depois da última parte, mesmo quando ela fecha um bloco', async () => {
    const { calls, sleep } = makeSleep();

    const outcome = await runMeetingUpload({
      parts: makeParts(20),
      send: async () => OK,
      sleep,
    });

    expect(outcome).toEqual({ status: 'completed' });
    expect(calls).toEqual([]);
  });

  it('nunca tem mais de uma requisição em voo', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const { sleep } = makeSleep();

    await runMeetingUpload({
      parts: makeParts(12),
      send: async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await Promise.resolve();
        inFlight -= 1;
        return OK;
      },
      sleep,
    });

    expect(maxInFlight).toBe(1);
  });

  it('erro de rede constante na parte 6: 1 + 3 novas tentativas, para e não envia as seguintes', async () => {
    const sent: number[] = [];
    const { calls, sleep } = makeSleep();

    const outcome = await runMeetingUpload({
      parts: makeParts(10),
      send: async (part) => {
        sent.push(part.index);
        return part.index === 6 ? NETWORK_DOWN : OK;
      },
      sleep,
    });

    expect(outcome).toEqual({ status: 'failed', done: 6, verdict: 'retryable' });
    expect(sent.filter((index) => index === 6)).toHaveLength(4);
    expect(sent.some((index) => index > 6)).toBe(false);
    expect(calls).toEqual([1000, 2000, 4000]);
  });

  it('recupera quando uma nova tentativa dá certo', async () => {
    let attempts = 0;
    const { calls, sleep } = makeSleep();

    const outcome = await runMeetingUpload({
      parts: makeParts(3),
      send: async (part) => {
        if (part.index === 1) {
          attempts += 1;
          return attempts < 3 ? response(503) : OK;
        }
        return OK;
      },
      sleep,
    });

    expect(outcome).toEqual({ status: 'completed' });
    expect(calls).toEqual([1000, 2000]);
  });

  it('um send que lança vira erro de rede (retryable)', async () => {
    const { sleep } = makeSleep();

    const outcome = await runMeetingUpload({
      parts: makeParts(3),
      send: async (part) => {
        if (part.index === 2) throw new Error('boom');
        return OK;
      },
      sleep,
    });

    expect(outcome).toEqual({ status: 'failed', done: 2, verdict: 'retryable' });
  });

  it('401 recusa na hora, sem novas tentativas', async () => {
    const sent: number[] = [];
    const { calls, sleep } = makeSleep();

    const outcome = await runMeetingUpload({
      parts: makeParts(5),
      send: async (part) => {
        sent.push(part.index);
        return part.index === 3 ? response(401) : OK;
      },
      sleep,
    });

    expect(outcome).toEqual({ status: 'failed', done: 3, verdict: 'rejected' });
    expect(sent).toEqual([0, 1, 2, 3]);
    expect(calls).toEqual([]);
  });

  it('startAt 10 envia só da posição 10 em diante e o progresso começa em 11', async () => {
    const sent: number[] = [];
    const progress: number[] = [];
    const { sleep } = makeSleep();

    const outcome = await runMeetingUpload({
      parts: makeParts(13),
      startAt: 10,
      send: async (part) => {
        sent.push(part.index);
        return OK;
      },
      sleep,
      onProgress: (done) => progress.push(done),
    });

    expect(outcome).toEqual({ status: 'completed' });
    expect(sent).toEqual([10, 11, 12]);
    expect(progress).toEqual([11, 12, 13]);
  });

  it('isCancelled verdadeiro antes de uma parte para e devolve quantas chegaram', async () => {
    const sent: number[] = [];
    const { sleep } = makeSleep();

    const outcome = await runMeetingUpload({
      parts: makeParts(10),
      send: async (part) => {
        sent.push(part.index);
        return OK;
      },
      sleep,
      isCancelled: () => sent.length >= 4,
    });

    expect(outcome).toEqual({ status: 'cancelled', done: 4 });
    expect(sent).toEqual([0, 1, 2, 3]);
  });

  it('respeita blockSize e pauseMs informados', async () => {
    const { calls, sleep } = makeSleep();

    await runMeetingUpload({
      parts: makeParts(7),
      blockSize: 3,
      pauseMs: 250,
      send: async () => OK,
      sleep,
    });

    expect(calls).toEqual([250, 250]);
  });

  it('plano vazio termina como completed sem enviar nada', async () => {
    const { calls, sleep } = makeSleep();
    let sends = 0;

    const outcome = await runMeetingUpload({
      parts: [],
      send: async () => {
        sends += 1;
        return OK;
      },
      sleep,
    });

    expect(outcome).toEqual({ status: 'completed' });
    expect(sends).toBe(0);
    expect(calls).toEqual([]);
  });
});
