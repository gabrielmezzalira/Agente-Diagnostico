/**
 * Fila de envio ao Agente (Fase 7, WR-01): ordem garantida, novas tentativas
 * só em erro de rede/5xx/429, 4xx definitivo, `cancelAll` interrompe o retry
 * (D-09) e teto da fila.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtensionChunkRequest } from '@/shared/config/agenteConfig';
import type { OutboxItem } from '@/features/agente/outbox';
import { AGENTE_SEND_MAX_QUEUED } from '@/features/agente/sendRetryPolicy';
import { logger } from '@/shared/services/log';
import { createAgenteSender } from './agenteSender';

function request(text: string): ExtensionChunkRequest {
  return { url: 'https://agente.test/webhook/extension', init: { method: 'POST', body: text } };
}

let nextId = 0;
function item(text: string): OutboxItem {
  nextId += 1;
  return {
    chunkId: `c${nextId}`,
    backendUrl: 'https://agente.test',
    sessionId: 's1',
    text,
    speaker: null,
    enqueuedAt: 0,
  };
}

const buildRequest = (queued: OutboxItem) => Promise.resolve(request(queued.text));

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
    const sender = createAgenteSender({ send, buildRequest });

    sender.submit([item('olá')]);
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
    const sender = createAgenteSender({ send, buildRequest, onOutcome });

    sender.submit([item('olá')]);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(onOutcome.mock.calls).toEqual([
      ['retrying', null],
      ['retrying', 503],
      ['sent', 202],
    ]);
  });

  it('WR-07: 401 reporta rejected; cancelado não reporta nada', async () => {
    const onOutcome = vi.fn();
    const rejecting = createAgenteSender({
      send: () => Promise.resolve(response(401)),
      buildRequest,
      onOutcome,
    });
    rejecting.submit([item('olá')]);
    await vi.advanceTimersByTimeAsync(0);
    expect(onOutcome.mock.calls).toEqual([['rejected', 401]]);

    onOutcome.mockClear();
    let release!: (res: Response) => void;
    const slow = createAgenteSender({
      send: () => new Promise<Response>((resolve) => (release = resolve)),
      buildRequest,
      onOutcome,
    });
    slow.submit([item('olá')]);
    await vi.advanceTimersByTimeAsync(0); // a fila é assíncrona: o envio começa um instante depois do submit
    slow.cancelAll();
    release(response(202));
    await vi.advanceTimersByTimeAsync(0);
    expect(onOutcome).not.toHaveBeenCalled();
  });

  it('401 é definitivo: nenhuma nova tentativa', async () => {
    const send = vi.fn(() => Promise.resolve(response(401)));
    const sender = createAgenteSender({ send, buildRequest });

    sender.submit([item('olá')]);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('erro de rede constante: 1 envio + 3 novas tentativas, depois desiste', async () => {
    const send = vi.fn(() => Promise.reject(new Error('rede caiu')));
    const sender = createAgenteSender({ send, buildRequest });

    sender.submit([item('olá')]);
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
    const sender = createAgenteSender({ send, buildRequest });

    sender.submit([item('a'), item('b')]);
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
    const sender = createAgenteSender({ send, buildRequest });

    sender.submit([item('primeiro')]);
    sender.submit([item('segundo')]);
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
    const sender = createAgenteSender({ send, buildRequest });

    sender.submit([item('confidencial'), item('depois')]);
    await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledTimes(1);

    sender.cancelAll();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('depois do cancelAll, um trecho novo volta a ser enviado', async () => {
    const send = vi.fn(() => Promise.resolve(response(202)));
    const sender = createAgenteSender({ send, buildRequest });

    sender.cancelAll();
    sender.submit([item('novo')]);
    await vi.advanceTimersByTimeAsync(0);
    expect(bodies(send)).toEqual(['novo']);
  });

  it('acima do teto, o trecho mais antigo que ainda esperava é descartado', async () => {
    let releaseFirst!: (res: Response) => void;
    const send = vi
      .fn<(req: ExtensionChunkRequest) => Promise<Response>>()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => (releaseFirst = resolve)))
      .mockResolvedValue(response(202));
    const sender = createAgenteSender({ send, buildRequest });

    sender.submit([item('em-voo')]);
    await vi.advanceTimersByTimeAsync(0); // a fila é assíncrona: o 1º envio começa um instante depois do submit
    const extra = Array.from({ length: AGENTE_SEND_MAX_QUEUED + 1 }, (_, i) => item(`t${i}`));
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
    const sender = createAgenteSender({ send, buildRequest });

    sender.dispose();
    sender.submit([item('tarde demais')]);
    await vi.advanceTimersByTimeAsync(0);
    expect(send).not.toHaveBeenCalled();
  });

  it('item sem request (outro backend) é removido sem envio; o log registra só a contagem (IN-04)', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const send = vi.fn(() => Promise.resolve(response(202)));
    const sender = createAgenteSender({
      send,
      buildRequest: (queued) => Promise.resolve(queued.text === 'velho' ? null : request(queued.text)),
    });

    sender.submit([item('velho'), item('novo')]);
    await vi.advanceTimersByTimeAsync(0);
    await sender.whenIdle();

    expect(bodies(send)).toEqual(['novo']);
    expect(warn).toHaveBeenCalledWith('falas descartadas: destino diferente da config atual', { discarded: 1 });
    expect(JSON.stringify(warn.mock.calls)).not.toContain('velho');
    warn.mockRestore();
  });
});
