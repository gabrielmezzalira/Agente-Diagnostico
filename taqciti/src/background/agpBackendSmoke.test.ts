// @vitest-environment node
/**
 * FUMAÇA de ponta a ponta (opt-in): o feed REAL + o storage REAL da Taqciti contra o roteador WebSocket REAL do
 * backend (`app/routers/ws.py` + `ws_manager`), com o pipeline trocado por um falso. Só roda com
 * `AGP_SMOKE_SERVER=scripts/agp-fake-backend.py` (precisa de Python com as dependências do backend instaladas).
 * Rodar: `AGP_SMOKE_SERVER=scripts/agp-fake-backend.py npx vitest run src/background/agpBackendSmoke.test.ts`.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeStorageMock } from '@/test/chromeStorageMock';
import { loadAgpFeed, writeAgpFeed } from '@/shared/config/agpQuestionsStore';
import { openBrowserSocket } from './agpBrowserSocket';
import { createAgpQuestionsFeed, type AgpFeedTarget } from './agpQuestionsFeed';

const SERVER = process.env.AGP_SMOKE_SERVER;
const PORT = 18765;
const HTTP = `http://127.0.0.1:${PORT}`;
const S1 = '33333333-3333-4333-8333-333333333333';
const NOT_ACTIVE = '00000000-0000-4000-8000-000000000000';
const targetOf = (id: string): AgpFeedTarget => ({ sessionId: id, url: `ws://127.0.0.1:${PORT}/ws/${id}` });

let proc: ChildProcess | null = null;
async function startServer(): Promise<void> {
  proc = spawn('python3', [SERVER as string, String(PORT)], { stdio: 'ignore' });
  await vi.waitFor(async () => { expect((await fetch(`${HTTP}/stats/x`)).ok).toBe(true); }, { timeout: 20_000, interval: 250 });
}
async function stopServer(): Promise<void> {
  if (proc === null) return;
  const p = proc;
  proc = null;
  p.kill('SIGKILL');
  await new Promise((resolve) => p.once('exit', resolve));
}
const post = (path: string) => fetch(`${HTTP}${path}`, { method: 'POST' });
const connections = async (id: string) => ((await (await fetch(`${HTTP}/stats/${id}`)).json()) as { connections: number }).connections;

describe.skipIf(SERVER === undefined)('AGP contra o roteador WebSocket real do backend', () => {
  let current: AgpFeedTarget | null = null;
  const errors: string[] = [];
  let feed: ReturnType<typeof createAgpQuestionsFeed>;

  beforeEach(async () => {
    installChromeStorageMock();
    current = null;
    errors.length = 0;
    feed = createAgpQuestionsFeed({
      selectTarget: () => Promise.resolve(current),
      openSocket: openBrowserSocket,
      write: writeAgpFeed,
      setTimer: (cb, ms) => setTimeout(cb, ms),
      clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
      onError: (m) => void errors.push(m),
    });
    await stopServer();
    await startServer();
  }, 30_000);
  afterEach(async () => { current = null; await feed.reconcile(); });
  afterAll(stopServer);

  const until = (check: () => Promise<void> | void) => vi.waitFor(check, { timeout: 10_000, interval: 100 });

  it('espelha initial_state, question_new e question_expired reais; fecha ao perder o alvo', async () => {
    current = targetOf(S1);
    await feed.reconcile();
    await until(async () => {
      const f = await loadAgpFeed();
      expect(f).toMatchObject({ sessionId: S1, connection: 'live' });
      expect(f.questions.map((q) => [q.text, q.lens, q.block])).toEqual([['Qual é o gargalo hoje?', 'produto', 'negocio']]);
    });

    await post(`/emit/${S1}/new?lens=dados&text=Quem%20decide%20a%20compra%3F`);
    await until(async () => {
      expect((await loadAgpFeed()).questions.map((q) => [q.text, q.lens])).toEqual([
        ['Qual é o gargalo hoje?', 'produto'],
        ['Quem decide a compra?', 'dados'],
      ]);
    });

    await post(`/emit/${S1}/expired/11111111-aaaa-4bbb-8ccc-000000000001`);
    await until(async () => { expect((await loadAgpFeed()).questions.map((q) => q.text)).toEqual(['Quem decide a compra?']); });
    expect(await connections(S1)).toBe(1);

    current = null; // a call acabou
    await feed.reconcile();
    await until(async () => { expect(await connections(S1)).toBe(0); });
    expect(await loadAgpFeed()).toEqual({ sessionId: null, connection: 'idle', questions: [] });
    expect(errors).toEqual([]);
  }, 40_000);

  it('sessão não ativa: o backend fecha com 4004 e o feed para, sem reconectar', async () => {
    current = targetOf(NOT_ACTIVE);
    await feed.reconcile();
    await until(async () => { expect(await loadAgpFeed()).toEqual({ sessionId: NOT_ACTIVE, connection: 'idle', questions: [] }); });
    await new Promise((r) => setTimeout(r, 2_500)); // mais que a 1ª espera de reconexão (1 s) e a 2ª (2 s)
    expect(await connections(NOT_ACTIVE)).toBe(0);
    expect(await loadAgpFeed()).toMatchObject({ connection: 'idle' });
  }, 30_000);

  it('o backend cai e volta: reconecta sozinho, mantém as perguntas e volta ao vivo', async () => {
    current = targetOf(S1);
    await feed.reconcile();
    await until(async () => { expect(await loadAgpFeed()).toMatchObject({ connection: 'live' }); });
    await stopServer();
    await until(async () => {
      const f = await loadAgpFeed();
      expect(f.connection).toBe('reconnecting');
      expect(f.questions).toHaveLength(1);
    });
    await startServer();
    await until(async () => { expect(await loadAgpFeed()).toMatchObject({ connection: 'live' }); });
    expect(await connections(S1)).toBe(1);
  }, 60_000);
});
