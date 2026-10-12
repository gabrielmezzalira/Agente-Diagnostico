/**
 * Fila de envio ao Agente (Fase 7, WR-01): ordem garantida, novas tentativas
 * só em erro de rede/5xx/429, 4xx definitivo, `cancelAll` interrompe o retry
 * (D-09) e teto da fila.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtensionChunkRequest } from '@/shared/config/agenteConfig';
import type { OutboxItem } from '@/features/agente/outbox';
import { AGENTE_OUTBOX_MAX_ITEMS } from '@/features/agente/outbox';
import { AGENTE_OUTBOX_SERVER_ERROR_MAX_AGE_MS } from '@/features/agente/sendRetryPolicy';
import { logger } from '@/shared/services/log';
import { createAgenteSender } from './agenteSender';
import { createMemorySendQueue, type SendQueuePort } from './agenteSendQueue';

function request(text: string): ExtensionChunkRequest {
  return { url: 'https://agente.test/webhook/extension', init: { method: 'POST', body: text } };
}

let nextId = 0;
function item(text: string, overrides: Partial<OutboxItem> = {}): OutboxItem {
  nextId += 1;
  return {
    chunkId: `c${nextId}`,
    backendUrl: 'https://agente.test',
    sessionId: 's1',
    text,
    speaker: null,
    enqueuedAt: 0,
    ...overrides,
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

/** Resposta por texto do trecho: o que não está no mapa volta 202. */
function sendByBody(statusByBody: Record<string, number | 'network'>) {
  return vi.fn((req: ExtensionChunkRequest): Promise<Response> => {
    const behavior = statusByBody[String(req.init.body)];
    if (behavior === 'network') return Promise.reject(new Error('rede caiu'));
    return Promise.resolve(response(behavior ?? 202));
  });
}

describe('agenteSender / fila sem descarte e rastro de falas descartadas (D-18)', () => {
  it('acima do teto nada antigo é descartado: só o excedente novo é recusado e contado', async () => {
    const send = vi.fn(() => Promise.resolve(response(202)));
    const onDelivery = vi.fn();
    const onDropped = vi.fn();
    const sender = createAgenteSender({ send, buildRequest, onDelivery, onDropped });

    const all = Array.from({ length: AGENTE_OUTBOX_MAX_ITEMS + 1 }, (_, i) => item(`t${i}`));
    sender.submit(all);
    await vi.advanceTimersByTimeAsync(0);
    await sender.whenIdle();

    const sent = bodies(send);
    expect(sent).toHaveLength(AGENTE_OUTBOX_MAX_ITEMS);
    expect(sent[0]).toBe('t0');
    expect(sent).not.toContain(`t${AGENTE_OUTBOX_MAX_ITEMS}`);
    expect(onDelivery.mock.calls.some(([record]) => record.overflow === 1)).toBe(true);
    expect(onDropped).toHaveBeenCalledTimes(1);
    expect(onDropped).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 's1', count: 1, reason: 'overflow' }),
    );
  });

  it('reenvio desligado (padrão): esgotadas as tentativas o item sai, é avisado e o 2º segue (Fase 7)', async () => {
    const send = sendByBody({ a: 'network' });
    const onOutcome = vi.fn();
    const onDropped = vi.fn();
    const sender = createAgenteSender({ send, buildRequest, onOutcome, onDropped });

    sender.submit([item('a'), item('b')]);
    await vi.advanceTimersByTimeAsync(10_000);

    expect(bodies(send)).toEqual(['a', 'a', 'a', 'a', 'b']);
    expect(onOutcome.mock.calls.filter(([outcome]) => outcome === 'failed')).toEqual([['failed', null]]);
    expect(onDropped).toHaveBeenCalledTimes(1);
    expect(onDropped).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 's1', count: 1, reason: 'failed', httpStatus: null }),
    );
  });

  it('401 é definitivo nas duas políticas e entra no rastro como recusado', async () => {
    for (const resendEnabled of [false, true]) {
      const onDropped = vi.fn();
      const send = vi.fn(() => Promise.resolve(response(401)));
      const sender = createAgenteSender({ send, buildRequest, resendEnabled, onDropped });
      sender.submit([item('a')]);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(send).toHaveBeenCalledTimes(1);
      expect(onDropped).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'rejected', httpStatus: 401, count: 1 }),
      );
    }
  });
});

describe('agenteSender / reenvio ligado: Agente fora do ar (D-18)', () => {
  it('fica no topo, avisa offline com a contagem e, quando o Agente volta, sai tudo na ordem original', async () => {
    let up = false;
    const send = vi.fn((): Promise<Response> =>
      up ? Promise.resolve(response(202)) : Promise.reject(new Error('rede caiu')),
    );
    const onDelivery = vi.fn();
    const onDropped = vi.fn();
    const sender = createAgenteSender({ send, buildRequest, resendEnabled: true, onDelivery, onDropped });

    sender.submit([item('a'), item('b')]);
    await vi.advanceTimersByTimeAsync(8_000); // 1 s + 2 s + 4 s de espera: o topo esgotou as tentativas
    expect(bodies(send)).toEqual(['a', 'a', 'a', 'a']);
    expect(onDelivery).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'offline', queued: 2 }));

    up = true;
    await vi.advanceTimersByTimeAsync(5_000);
    sender.kick(); // antes de 15 s: não tenta
    await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledTimes(4);

    await vi.advanceTimersByTimeAsync(10_000);
    sender.kick(); // passados 15 s desde que o topo esgotou
    await vi.advanceTimersByTimeAsync(0);
    await sender.whenIdle();
    expect(bodies(send)).toEqual(['a', 'a', 'a', 'a', 'a', 'b']);
    expect(onDelivery).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'ok', queued: 0, recoveredAt: Date.now() }),
    );
    expect(onDropped).not.toHaveBeenCalled();
  });

  it('falas novas entram atrás do item parado e não furam a fila', async () => {
    let up = false;
    const send = vi.fn((): Promise<Response> => Promise.resolve(response(up ? 202 : 503)));
    const sender = createAgenteSender({ send, buildRequest, resendEnabled: true });
    sender.submit([item('a')]);
    await vi.advanceTimersByTimeAsync(8_000);
    sender.submit([item('b')]);
    await vi.advanceTimersByTimeAsync(0);
    expect(bodies(send)).toEqual(['a', 'a', 'a', 'a']); // 'b' não é tentada enquanto 'a' espera

    up = true;
    await vi.advanceTimersByTimeAsync(15_000);
    sender.kick();
    await vi.advanceTimersByTimeAsync(0);
    await sender.whenIdle();
    expect(bodies(send).slice(4)).toEqual(['a', 'b']);
  });

  it('503 por 10 minutos: o item nunca é retirado (fora do ar, D-18)', async () => {
    const send = vi.fn(() => Promise.resolve(response(503)));
    const onDropped = vi.fn();
    const queue = createMemorySendQueue();
    const sender = createAgenteSender({ send, buildRequest, queue, resendEnabled: true, onDropped });
    sender.submit([item('a', { enqueuedAt: Date.now() - 3 * 60_000 })]);
    for (let i = 0; i < 40; i += 1) {
      await vi.advanceTimersByTimeAsync(15_000);
      sender.kick();
    }
    expect(await queue.load()).toHaveLength(1);
    expect(onDropped).not.toHaveBeenCalled();
  });
});

describe('agenteSender / retirada por HTTP 500 (B3-b)', () => {
  it('o valor de produção é o registrado na B3-b do 08-09-SUMMARY: retirada-nunca (sem resposta do time)', () => {
    expect(AGENTE_OUTBOX_SERVER_ERROR_MAX_AGE_MS).toBeNull();
  });

  it('com limite numérico: 500 em todas as tentativas de um item mais velho que o limite é retirado como recusado', async () => {
    const send = sendByBody({ a: 500 });
    const onDelivery = vi.fn();
    const onDropped = vi.fn();
    const sender = createAgenteSender({
      send,
      buildRequest,
      resendEnabled: true,
      serverErrorMaxAgeMs: 120_000,
      onDelivery,
      onDropped,
    });

    sender.submit([item('a', { enqueuedAt: Date.now() - 3 * 60_000 }), item('b')]);
    await vi.advanceTimersByTimeAsync(10_000);

    expect(bodies(send)).toEqual(['a', 'a', 'a', 'a', 'b']);
    expect(onDropped).toHaveBeenCalledTimes(1);
    expect(onDropped).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'rejected', httpStatus: 500, count: 1, sessionId: 's1' }),
    );
    const rejected = onDelivery.mock.calls.some(
      ([record]) => record.status === 'rejected' && record.httpStatus === 500,
    );
    expect(rejected).toBe(true);
  });

  it('item novo com 500 fica no topo e só é retirado quando passa do limite', async () => {
    const send = sendByBody({ a: 500 });
    const onDropped = vi.fn();
    const sender = createAgenteSender({
      send,
      buildRequest,
      resendEnabled: true,
      serverErrorMaxAgeMs: 120_000,
      onDropped,
    });

    sender.submit([item('a', { enqueuedAt: Date.now() - 30_000 })]);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(onDropped).not.toHaveBeenCalled(); // 30 s + um ciclo: ainda dentro do limite

    await vi.advanceTimersByTimeAsync(95_000);
    sender.kick();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(onDropped).toHaveBeenCalledTimes(1);
    expect(onDropped).toHaveBeenCalledWith(expect.objectContaining({ reason: 'rejected', httpStatus: 500 }));
  });

  it('ciclo com 500, 503, 500, 500 não é recusa por 500: o item fica', async () => {
    const send = vi
      .fn<(req: ExtensionChunkRequest) => Promise<Response>>()
      .mockResolvedValueOnce(response(500))
      .mockResolvedValueOnce(response(503))
      .mockResolvedValue(response(500));
    const onDropped = vi.fn();
    const queue = createMemorySendQueue();
    const sender = createAgenteSender({
      send,
      buildRequest,
      queue,
      resendEnabled: true,
      serverErrorMaxAgeMs: 120_000,
      onDropped,
    });
    sender.submit([item('a', { enqueuedAt: Date.now() - 10 * 60_000 })]);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(send).toHaveBeenCalledTimes(4);
    expect(onDropped).not.toHaveBeenCalled();
    expect(await queue.load()).toHaveLength(1);
  });

  it('com limite null (retirada-nunca): 500 constante por 10 minutos nunca retira', async () => {
    const send = sendByBody({ a: 500 });
    const onDropped = vi.fn();
    const queue = createMemorySendQueue();
    const sender = createAgenteSender({
      send,
      buildRequest,
      queue,
      resendEnabled: true,
      serverErrorMaxAgeMs: null,
      onDropped,
    });
    sender.submit([item('a', { enqueuedAt: Date.now() - 3 * 60_000 })]);
    for (let i = 0; i < 40; i += 1) {
      await vi.advanceTimersByTimeAsync(15_000);
      sender.kick();
    }
    expect(onDropped).not.toHaveBeenCalled();
    expect(await queue.load()).toHaveLength(1);
  });
});

describe('agenteSender / retomada, falha de gravação, cancelamento e descarte da instância', () => {
  it('resume() carrega a fila da porta e envia na ordem', async () => {
    const queue = createMemorySendQueue();
    await queue.append([item('a'), item('b')]);
    const send = vi.fn(() => Promise.resolve(response(202)));
    const sender = createAgenteSender({ send, buildRequest, queue });
    await sender.resume();
    await vi.advanceTimersByTimeAsync(0);
    await sender.whenIdle();
    expect(bodies(send)).toEqual(['a', 'b']);
  });

  it('porta que rejeita o append: as falas contam como overflow no rastro e nada é enviado', async () => {
    const queue: SendQueuePort = {
      ...createMemorySendQueue(),
      append: () => Promise.reject(new Error('QUOTA_BYTES')),
    };
    const send = vi.fn(() => Promise.resolve(response(202)));
    const onDropped = vi.fn();
    const sender = createAgenteSender({ send, buildRequest, queue, onDropped });
    sender.submit([item('a'), item('b')]);
    await vi.advanceTimersByTimeAsync(0);
    await sender.whenIdle();
    expect(send).not.toHaveBeenCalled();
    expect(onDropped).toHaveBeenCalledTimes(1);
    expect(onDropped).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 's1', count: 2, reason: 'overflow' }),
    );
  });

  it('request null (outro backend) e cancelAll() são saídas pedidas pela pessoa: nenhum onDropped', async () => {
    const onDropped = vi.fn();
    const nullSender = createAgenteSender({
      send: vi.fn(() => Promise.resolve(response(202))),
      buildRequest: () => Promise.resolve(null),
      onDropped,
    });
    nullSender.submit([item('velho')]);
    await vi.advanceTimersByTimeAsync(0);
    await nullSender.whenIdle();

    const queue = createMemorySendQueue();
    const clear = vi.spyOn(queue, 'clear');
    const sender = createAgenteSender({
      send: () => new Promise<Response>(() => undefined),
      buildRequest,
      queue,
      onDropped,
    });
    sender.submit([item('a'), item('b')]);
    await vi.advanceTimersByTimeAsync(0);
    sender.cancelAll();
    await vi.advanceTimersByTimeAsync(0);

    expect(clear).toHaveBeenCalledTimes(1);
    expect(await queue.load()).toEqual([]);
    expect(onDropped).not.toHaveBeenCalled();
  });

  it('dispose() é terminal mas NÃO limpa a porta: a fila durável sobrevive à instância', async () => {
    const queue = createMemorySendQueue();
    const clear = vi.spyOn(queue, 'clear');
    const send = vi.fn(() => new Promise<Response>(() => undefined));
    const sender = createAgenteSender({ send, buildRequest, queue });
    sender.submit([item('a'), item('b')]);
    await vi.advanceTimersByTimeAsync(0);

    sender.dispose();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(clear).not.toHaveBeenCalled();
    expect((await queue.load()).map((queued) => queued.text)).toEqual(['a', 'b']);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
