/**
 * O dono do WebSocket do painel AGP (Fase 10): abre só com alvo explícito, espelha as mensagens, reconecta com
 * espera crescente, para no 4004 e fecha quando o alvo some. Socket, timers e storage são falsos.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgpFeed } from '@/shared/config/agpQuestionsStore';
import { EMPTY_AGP_FEED } from '@/shared/config/agpQuestionsStore';
import {
  AGP_SESSION_NOT_ACTIVE_CODE,
  agpReconnectDelayMs,
  createAgpQuestionsFeed,
  type AgpFeedTarget,
  type AgpSocket,
} from './agpQuestionsFeed';

const S1 = '11111111-1111-1111-1111-111111111111';
const S2 = '22222222-2222-2222-2222-222222222222';
const target = (id: string): AgpFeedTarget => ({ sessionId: id, url: `ws://localhost:8000/ws/${id}` });
const raw = (id: string, over: Record<string, unknown> = {}) => ({
  id, text: `pergunta ${id}`, block: 'negocio', status: 'queued', lens: 'produto', expires_at: null, ...over,
});

class FakeSocket implements AgpSocket {
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  closed = false;
  constructor(readonly url: string) {}
  close() { this.closed = true; }
  open() { this.onopen?.(); }
  send(event: string, data: unknown) { this.onmessage?.({ data: JSON.stringify({ event, data }) }); }
  drop(code = 1006) { this.onclose?.({ code }); }
}

function rig() {
  let current: AgpFeedTarget | null = null;
  const sockets: FakeSocket[] = [];
  const writes: AgpFeed[] = [];
  const timers: { cb: () => void; ms: number; id: number; cleared: boolean }[] = [];
  const feed = createAgpQuestionsFeed({
    selectTarget: () => Promise.resolve(current),
    openSocket: (url) => { const s = new FakeSocket(url); sockets.push(s); return s; },
    write: (value) => { writes.push(value); return Promise.resolve(); },
    setTimer: (cb, ms) => { const t = { cb, ms, id: timers.length, cleared: false }; timers.push(t); return t.id; },
    clearTimer: (id) => { const t = timers[id as number]; if (t) t.cleared = true; },
  });
  const last = () => writes.at(-1) as AgpFeed;
  const fire = (index = timers.length - 1) => timers[index]?.cb();
  return { feed, sockets, writes, timers, last, fire, set: (t: AgpFeedTarget | null) => void (current = t) };
}

let r: ReturnType<typeof rig>;
beforeEach(() => { r = rig(); });

describe('agpReconnectDelayMs', () => {
  it('1 s, 2 s, 4 s ... com teto de 30 s', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 20].map(agpReconnectDelayMs)).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
  });
});

describe('abrir, espelhar e fechar', () => {
  it('sem alvo: nenhuma conexão; o primeiro boot limpa o storage uma vez', async () => {
    await r.feed.reconcile();
    expect(r.sockets).toHaveLength(0);
    expect(r.writes).toEqual([EMPTY_AGP_FEED]);
    await r.feed.reconcile();
    expect(r.writes).toHaveLength(1);
  });

  it('com alvo: abre o socket certo, marca connecting e depois live no onopen', async () => {
    r.set(target(S1));
    await r.feed.reconcile();
    expect(r.sockets.map((s) => s.url)).toEqual([target(S1).url]);
    expect(r.last()).toEqual({ sessionId: S1, connection: 'connecting', questions: [] });
    r.sockets[0]?.open();
    await r.feed.reconcile();
    expect(r.last()).toMatchObject({ sessionId: S1, connection: 'live' });
  });

  it('o mesmo alvo de novo é idempotente (nenhum socket novo)', async () => {
    r.set(target(S1));
    await r.feed.reconcile();
    await r.feed.reconcile();
    expect(r.sockets).toHaveLength(1);
  });

  it('initial_state, question_new e question_expired viram a lista; evento repetido não regrava', async () => {
    r.set(target(S1));
    await r.feed.reconcile();
    const socket = r.sockets[0] as FakeSocket;
    socket.open();
    socket.send('initial_state', { questions: [raw('a')] });
    socket.send('question_new', raw('b', { lens: 'dados' }));
    await r.feed.reconcile();
    expect(r.last().questions.map((q) => [q.id, q.lens])).toEqual([['a', 'produto'], ['b', 'dados']]);
    const before = r.writes.length;
    socket.send('question_new', raw('b'));
    socket.send('budget_update', { used_usd: 1 });
    socket.onmessage?.({ data: '{nao' });
    socket.onmessage?.({ data: new ArrayBuffer(2) });
    await r.feed.reconcile();
    expect(r.writes).toHaveLength(before);
    socket.send('question_expired', { id: 'a' });
    await r.feed.reconcile();
    expect(r.last().questions.map((q) => q.id)).toEqual(['b']);
  });

  it('o alvo some (a call acabou): fecha o socket e limpa o storage', async () => {
    r.set(target(S1));
    await r.feed.reconcile();
    r.sockets[0]?.open();
    r.set(null);
    await r.feed.reconcile();
    expect(r.sockets[0]?.closed).toBe(true);
    expect(r.last()).toEqual(EMPTY_AGP_FEED);
  });

  it('o alvo muda: fecha o antigo, abre o novo e não mistura perguntas', async () => {
    r.set(target(S1));
    await r.feed.reconcile();
    const first = r.sockets[0] as FakeSocket;
    first.open();
    first.send('question_new', raw('a'));
    r.set(target(S2));
    await r.feed.reconcile();
    expect(first.closed).toBe(true);
    expect(r.sockets[1]?.url).toBe(target(S2).url);
    expect(r.last()).toEqual({ sessionId: S2, connection: 'connecting', questions: [] });
    first.send('question_new', raw('velha'));
    await r.feed.reconcile();
    expect(r.last().questions).toEqual([]);
  });
});

describe('queda, reconexão e desistência', () => {
  it('queda comum: reconnecting e nova tentativa com espera crescente; só o initial_state zera a contagem', async () => {
    r.set(target(S1));
    await r.feed.reconcile();
    r.sockets[0]?.drop(1006);
    await r.feed.reconcile();
    expect(r.last()).toMatchObject({ connection: 'reconnecting' });
    expect(r.timers.map((t) => t.ms)).toEqual([1000]);
    r.fire();
    expect(r.sockets).toHaveLength(2);
    r.sockets[1]?.drop(1006);
    expect(r.timers.map((t) => t.ms)).toEqual([1000, 2000]);
    r.fire();
    r.sockets[2]?.open();
    r.sockets[2]?.send('initial_state', { questions: [] });
    r.sockets[2]?.drop(1006);
    expect(r.timers.map((t) => t.ms)).toEqual([1000, 2000, 1000]);
  });

  it('abrir e cair SEM initial_state (falha pós-accept do backend) NÃO zera a espera: sem laço de 1 s (WR-01)', async () => {
    r.set(target(S1));
    await r.feed.reconcile();
    for (let i = 0; i < 4; i += 1) {
      r.sockets.at(-1)?.open();
      r.sockets.at(-1)?.drop(1011);
      r.fire();
    }
    expect(r.timers.map((t) => t.ms)).toEqual([1000, 2000, 4000, 8000]);
  });

  it('as perguntas já recebidas continuam visíveis enquanto reconecta', async () => {
    r.set(target(S1));
    await r.feed.reconcile();
    const socket = r.sockets[0] as FakeSocket;
    socket.open();
    socket.send('question_new', raw('a'));
    socket.drop(1006);
    await r.feed.reconcile();
    expect(r.last()).toMatchObject({ connection: 'reconnecting', questions: [expect.objectContaining({ id: 'a' })] });
  });

  it('4004 (sessão não ativa): para de vez, sem timer e sem socket novo', async () => {
    r.set(target(S1));
    await r.feed.reconcile();
    r.sockets[0]?.drop(AGP_SESSION_NOT_ACTIVE_CODE);
    await r.feed.reconcile();
    expect(r.timers).toHaveLength(0);
    expect(r.sockets).toHaveLength(1);
    expect(r.last()).toEqual({ sessionId: S1, connection: 'idle', questions: [] });
    await r.feed.reconcile();
    expect(r.sockets).toHaveLength(1);
  });

  it('alvo que some durante a espera cancela o timer: nada reconecta', async () => {
    r.set(target(S1));
    await r.feed.reconcile();
    r.sockets[0]?.drop(1006);
    r.set(null);
    await r.feed.reconcile();
    expect(r.timers[0]?.cleared).toBe(true);
    r.fire(0);
    expect(r.sockets).toHaveLength(1);
  });

  it('o navegador recusar a URL (openSocket lança) não derruba nem repete', async () => {
    const onError = vi.fn();
    const feed = createAgpQuestionsFeed({
      selectTarget: () => Promise.resolve(target(S1)),
      openSocket: () => { throw new Error('url inválida'); },
      write: (v) => { r.writes.push(v); return Promise.resolve(); },
      setTimer: () => 0,
      clearTimer: () => undefined,
      onError,
    });
    await feed.reconcile();
    await feed.reconcile();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(r.last()).toEqual({ sessionId: S1, connection: 'idle', questions: [] });
  });

  it('falha de gravação vai para onError e não trava as próximas', async () => {
    const onError = vi.fn();
    const writes: AgpFeed[] = [];
    let current: AgpFeedTarget | null = target(S1);
    let fail = true;
    const feed = createAgpQuestionsFeed({
      selectTarget: () => Promise.resolve(current),
      openSocket: (url) => new FakeSocket(url),
      write: (value) => {
        if (fail) {
          fail = false;
          return Promise.reject(new Error('quota'));
        }
        writes.push(value);
        return Promise.resolve();
      },
      setTimer: () => 0,
      clearTimer: () => undefined,
      onError,
    });
    await feed.reconcile();
    expect(onError).toHaveBeenCalledWith(expect.any(String), expect.any(Error));
    current = target(S2);
    await feed.reconcile();
    expect(writes.at(-1)).toEqual({ sessionId: S2, connection: 'connecting', questions: [] });
  });
});
