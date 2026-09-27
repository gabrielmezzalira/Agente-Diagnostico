/**
 * Fila de envio ao Agente (Fase 7, WR-01): ordem garantida, novas tentativas
 * só em erro de rede/5xx/429, 4xx definitivo, `cancelAll` interrompe o retry
 * (D-09) e teto da fila.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtensionChunkRequest } from '@/shared/config/agenteConfig';
import { AGENTE_SEND_MAX_QUEUED } from '@/features/agente/sendRetryPolicy';
import { createAgenteSender } from './agenteSender';

function request(text: string): ExtensionChunkRequest {
  return { url: 'https://agente.test/webhook/extension', init: { method: 'POST', body: text } };
}

function response(status: number): Response {
  return { ok: status >= 200 && status < 300, status } as Response;
}

const bodies = (send: ReturnType<typeof vi.fn>) =>
  send.mock.calls.map(([req]) => (req as ExtensionChunkRequest).init.body);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('agenteSender / novas tentativas', () => {
  it('503 duas vezes e depois 202: entrega na 3ª tentativa, após 1 s e 2 s', async () => {
    const send = vi
      .fn<(req: ExtensionChunkRequest) => Promise<Response>>()
      .mockResolvedValueOnce(response(503))
      .mockResolvedValueOnce(response(503))
      .mockResolvedValue(response(202));
    const sender = createAgenteSender({ send });

    sender.submit([request('olá')]);
    await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(999);
    expect(send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(send).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(send).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('WR-07: reporta cada tentativa — retrying, retrying, sent', async () => {
    const send = vi
      .fn<(req: ExtensionChunkRequest) => Promise<Response>>()
      .mockRejectedValueOnce(new Error('rede caiu'))
      .mockResolvedValueOnce(response(503))
      .mockResolvedValue(response(202));
    const onOutcome = vi.fn();
    const sender = createAgenteSender({ send, onOutcome });

    sender.submit([request('olá')]);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(onOutcome.mock.calls).toEqual([
      ['retrying', null],
      ['retrying', 503],
      ['sent', 202],
    ]);
  });

  it('WR-07: 401 reporta rejected; cancelado não reporta nada', async () => {
    const onOutcome = vi.fn();
    const rejecting = createAgenteSender({ send: () => Promise.resolve(response(401)), onOutcome });
    rejecting.submit([request('olá')]);
    await vi.advanceTimersByTimeAsync(0);
    expect(onOutcome.mock.calls).toEqual([['rejected', 401]]);

    onOutcome.mockClear();
    let release!: (res: Response) => void;
    const slow = createAgenteSender({
      send: () => new Promise<Response>((resolve) => (release = resolve)),
      onOutcome,
    });
    slow.submit([request('olá')]);
    slow.cancelAll();
    release(response(202));
    await vi.advanceTimersByTimeAsync(0);
    expect(onOutcome).not.toHaveBeenCalled();
  });

  it('401 é definitivo: nenhuma nova tentativa', async () => {
    const send = vi.fn(() => Promise.resolve(response(401)));
    const sender = createAgenteSender({ send });

    sender.submit([request('olá')]);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('erro de rede constante: 1 envio + 3 novas tentativas, depois desiste', async () => {
    const send = vi.fn(() => Promise.reject(new Error('rede caiu')));
    const sender = createAgenteSender({ send });

    sender.submit([request('olá')]);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(send).toHaveBeenCalledTimes(4);
  });

  it('send que lança de forma síncrona vira erro de rede e não derruba a fila (IN-10)', async () => {
    let calls = 0;
    const send = vi.fn((): Promise<Response> => {
      calls += 1;
      if (calls === 1) throw new Error('lançou síncrono');
      return Promise.resolve(response(202));
    });
    const sender = createAgenteSender({ send });

    sender.submit([request('a'), request('b')]);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(bodies(send)).toEqual(['a', 'a', 'b']);
  });
});

describe('agenteSender / ordem', () => {
  it('o 2º trecho só sai depois de o 1º terminar (inclusive as novas tentativas)', async () => {
    let releaseFirst!: (res: Response) => void;
    const send = vi
      .fn<(req: ExtensionChunkRequest) => Promise<Response>>()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => (releaseFirst = resolve)))
      .mockResolvedValue(response(202));
    const sender = createAgenteSender({ send });

    sender.submit([request('primeiro')]);
    sender.submit([request('segundo')]);
    await vi.advanceTimersByTimeAsync(0);
    expect(bodies(send)).toEqual(['primeiro']);

    releaseFirst(response(503));
    await vi.advanceTimersByTimeAsync(0);
    expect(bodies(send)).toEqual(['primeiro']);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(bodies(send)).toEqual(['primeiro', 'primeiro', 'segundo']);
  });
});

describe('agenteSender / cancelamento e teto', () => {
  it('cancelAll durante a espera do retry: nada mais é enviado (D-09)', async () => {
    const send = vi.fn(() => Promise.resolve(response(503)));
    const sender = createAgenteSender({ send });

    sender.submit([request('confidencial'), request('depois')]);
    await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledTimes(1);

    sender.cancelAll();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('depois do cancelAll, um trecho novo volta a ser enviado', async () => {
    const send = vi.fn(() => Promise.resolve(response(202)));
    const sender = createAgenteSender({ send });

    sender.cancelAll();
    sender.submit([request('novo')]);
    await vi.advanceTimersByTimeAsync(0);
    expect(bodies(send)).toEqual(['novo']);
  });

  it('acima do teto, o trecho mais antigo que ainda esperava é descartado', async () => {
    let releaseFirst!: (res: Response) => void;
    const send = vi
      .fn<(req: ExtensionChunkRequest) => Promise<Response>>()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => (releaseFirst = resolve)))
      .mockResolvedValue(response(202));
    const sender = createAgenteSender({ send });

    sender.submit([request('em-voo')]);
    const extra = Array.from({ length: AGENTE_SEND_MAX_QUEUED + 1 }, (_, i) => request(`t${i}`));
    sender.submit(extra);

    releaseFirst(response(202));
    await vi.advanceTimersByTimeAsync(0);
    await sender.whenIdle();

    const sent = bodies(send);
    expect(sent).toHaveLength(1 + AGENTE_SEND_MAX_QUEUED);
    expect(sent).not.toContain('t0');
    expect(sent.at(-1)).toBe(`t${AGENTE_SEND_MAX_QUEUED}`);
  });

  it('dispose é terminal: submit depois não envia', async () => {
    const send = vi.fn(() => Promise.resolve(response(202)));
    const sender = createAgenteSender({ send });

    sender.dispose();
    sender.submit([request('tarde demais')]);
    await vi.advanceTimersByTimeAsync(0);
    expect(send).not.toHaveBeenCalled();
  });
});
