/**
 * D-11 (WR-04): com a reunião em pausa, sem legendas ou com o envio ao Agente desligado, o feed do painel AGP
 * FECHA o socket (conectar cria o pipeline de IA e gasta Gemini) mas MANTÉM as perguntas já recebidas, publicadas
 * como `paused`; ao voltar a gravar, reconecta com a lista mantida até o `initial_state` substituí-la.
 * O fluxo roda o feed de verdade (socket e timers falsos, `writeAgpFeed`/`loadAgpFeed` reais sobre o storage
 * simulado); os casos diretos exercitam o módulo puro `agpQuestionsFeedHold.ts`.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { AgpQuestion } from '@/features/agente/agpQuestions';
import { EMPTY_AGP_FEED, loadAgpFeed, writeAgpFeed, type AgpFeed } from '@/shared/config/agpQuestionsStore';
import { installChromeStorageMock } from '@/test/chromeStorageMock';
import {
  AGP_SESSION_NOT_ACTIVE_CODE,
  createAgpQuestionsFeed,
  type AgpFeedTarget,
  type AgpSocket,
} from './agpQuestionsFeed';
import { decideAgpHold, decideAgpResume, heldFromStored, type AgpFeedHold } from './agpQuestionsFeedHold';

const S1 = '11111111-1111-1111-1111-111111111111';
const S2 = '22222222-2222-2222-2222-222222222222';
const target = (id: string): AgpFeedTarget => ({ sessionId: id, url: `ws://localhost:8000/ws/${id}` });
const hold = (id: string): AgpFeedHold => ({ kind: 'hold', sessionId: id });
const raw = (id: string) => ({ id, text: `pergunta ${id}`, block: 'negocio', status: 'queued', lens: 'produto' });
const q = (id: string): AgpQuestion => ({ id, text: `pergunta ${id}`, block: 'negocio', lens: 'produto', status: 'queued' });

class FakeSocket implements AgpSocket {
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  closed = false;
  constructor(readonly url: string) {}
  close() { this.closed = true; }
  open() { this.onopen?.(); }
  receive(event: string, data: unknown) { this.onmessage?.({ data: JSON.stringify({ event, data }) }); }
  drop(code = 1006) { this.onclose?.({ code }); }
}

/** `boot` liga o `readStored` (o worker que acordou lê o feed salvo uma vez); sem ele o feed é o da Task 1. */
function rig(boot = false) {
  let selection: AgpFeedTarget | AgpFeedHold | null = null;
  const sockets: FakeSocket[] = [];
  const writes: AgpFeed[] = [];
  const timers: { cb: () => void; ms: number; cleared: boolean }[] = [];
  const feed = createAgpQuestionsFeed({
    selectTarget: () => Promise.resolve(selection),
    openSocket: (url) => { const s = new FakeSocket(url); sockets.push(s); return s; },
    write: async (value) => { writes.push(value); await writeAgpFeed(value); },
    setTimer: (cb, ms) => { timers.push({ cb, ms, cleared: false }); return timers.length - 1; },
    clearTimer: (id) => { const t = timers[id as number]; if (t) t.cleared = true; },
    ...(boot && { readStored: loadAgpFeed }),
  });
  return { feed, sockets, writes, timers, set: (value: AgpFeedTarget | AgpFeedHold | null) => void (selection = value) };
}

let r: ReturnType<typeof rig>;
beforeEach(() => {
  installChromeStorageMock();
  r = rig();
});

/** Segue S1, abre o socket e recebe [a, b]. */
async function followWithQuestions() {
  r.set(target(S1));
  await r.feed.reconcile();
  const socket = r.sockets[0] as FakeSocket;
  socket.open();
  socket.receive('initial_state', { questions: [raw('a'), raw('b')] });
  await r.feed.reconcile();
  return socket;
}

describe('segurar a conexão (fluxo do feed)', () => {
  it('hold: fecha o socket, não agenda timer e guarda as perguntas como paused (lido de volta pelo store real)', async () => {
    const socket = await followWithQuestions();
    r.set(hold(S1));
    await r.feed.reconcile();
    expect(socket.closed).toBe(true);
    expect(r.timers).toHaveLength(0);
    expect(await loadAgpFeed()).toEqual({ sessionId: S1, connection: 'paused', questions: [q('a'), q('b')] });
  });

  it('o onclose do socket antigo, depois do hold, não muda nada (handlers zerados)', async () => {
    const socket = await followWithQuestions();
    r.set(hold(S1));
    await r.feed.reconcile();
    const before = r.writes.length;
    socket.drop(1006);
    await r.feed.reconcile();
    expect(r.writes).toHaveLength(before);
    expect(r.timers).toHaveLength(0);
  });

  it('hold durante a espera de reconexão cancela o timer: nada reconecta', async () => {
    const socket = await followWithQuestions();
    socket.drop(1006);
    expect(r.timers).toHaveLength(1);
    r.set(hold(S1));
    await r.feed.reconcile();
    expect(r.timers[0]?.cleared).toBe(true);
    r.timers[0]?.cb();
    expect(r.sockets).toHaveLength(1);
    expect(await loadAgpFeed()).toMatchObject({ connection: 'paused', questions: [q('a'), q('b')] });
  });

  it('retomada: abre socket NOVO, passa por connecting COM a lista mantida (mesma ordem) e o initial_state substitui', async () => {
    await followWithQuestions();
    r.set(hold(S1));
    await r.feed.reconcile();
    r.set(target(S1));
    await r.feed.reconcile();
    expect(r.sockets).toHaveLength(2);
    expect(r.writes.at(-1)).toEqual({ sessionId: S1, connection: 'connecting', questions: [q('a'), q('b')] });
    const next = r.sockets[1] as FakeSocket;
    next.open();
    next.receive('initial_state', { questions: [raw('b')] });
    await r.feed.reconcile();
    expect(await loadAgpFeed()).toEqual({ sessionId: S1, connection: 'live', questions: [q('b')] });
  });

  it('hold repetido (mesma sessão) não regrava nem mexe em socket', async () => {
    await followWithQuestions();
    r.set(hold(S1));
    await r.feed.reconcile();
    const before = r.writes.length;
    await r.feed.reconcile();
    expect(r.writes).toHaveLength(before);
    expect(r.sockets).toHaveLength(1);
  });

  it('hold sem nenhuma pergunta recebida publica paused com lista vazia (borda: vazio)', async () => {
    r.set(target(S1));
    await r.feed.reconcile();
    r.set(hold(S1));
    await r.feed.reconcile();
    expect(await loadAgpFeed()).toEqual({ sessionId: S1, connection: 'paused', questions: [] });
  });

  it('hold de OUTRA sessão nunca leva as perguntas da primeira', async () => {
    const socket = await followWithQuestions();
    r.set(hold(S2));
    await r.feed.reconcile();
    expect(socket.closed).toBe(true);
    expect(await loadAgpFeed()).toEqual({ sessionId: S2, connection: 'paused', questions: [] });
  });

  it('depois de um hold, seleção null limpa o feed (a lista segurada não fica órfã na tela)', async () => {
    await followWithQuestions();
    r.set(hold(S1));
    await r.feed.reconcile();
    r.set(null);
    await r.feed.reconcile();
    expect(await loadAgpFeed()).toEqual(EMPTY_AGP_FEED);
  });
});

describe('decideAgpHold (puro)', () => {
  it('seguindo a mesma sessão: pausar com as perguntas dela, na mesma ordem', () => {
    const step = decideAgpHold(S1, { target: { sessionId: S1 }, questions: [q('a'), q('b')] }, null);
    expect(step).toMatchObject({ kind: 'pause', held: { sessionId: S1, questions: [q('a'), q('b')] } });
  });

  it('sem sessão seguida: pausar com lista vazia', () => {
    expect(decideAgpHold(S1, null, null)).toMatchObject({ kind: 'pause', held: { sessionId: S1, questions: [] } });
  });

  it('sessão seguida DIFERENTE: pausar com lista vazia (nunca as perguntas de outra sessão)', () => {
    const step = decideAgpHold(S2, { target: { sessionId: S1 }, questions: [q('a')] }, null);
    expect(step).toMatchObject({ kind: 'pause', held: { sessionId: S2, questions: [] } });
  });

  it('já segurando a mesma sessão: nada a fazer (hold repetido)', () => {
    expect(decideAgpHold(S1, null, { sessionId: S1, questions: [q('a')], endedByBackend: false })).toEqual({ kind: 'none' });
  });
});

describe('decideAgpResume (puro)', () => {
  it('sessão segurada igual: conectar com as perguntas dela, na mesma ordem', () => {
    expect(decideAgpResume(S1, { sessionId: S1, questions: [q('a'), q('b')], endedByBackend: false })).toEqual({
      kind: 'connect',
      questions: [q('a'), q('b')],
    });
  });

  it('nada segurado ou sessão diferente: conectar com lista vazia', () => {
    expect(decideAgpResume(S1, null)).toEqual({ kind: 'connect', questions: [] });
    expect(decideAgpResume(S1, { sessionId: S2, questions: [q('x')], endedByBackend: false })).toEqual({ kind: 'connect', questions: [] });
  });
});

describe('a pausa sobrevive ao sono do service worker (Armadilha 2): outra instância do feed sobre o mesmo storage', () => {
  /** O feed antigo recebe [a, b] e vai para hold; o storage fica `paused` [a, b]. O worker "dorme" (o feed antigo some). */
  async function pausedThenSleep() {
    await followWithQuestions();
    r.set(hold(S1));
    await r.feed.reconcile();
    expect(await loadAgpFeed()).toMatchObject({ connection: 'paused', questions: [q('a'), q('b')] });
    return rig(true);
  }

  it('acorda já em hold da mesma sessão: o storage continua paused com [a, b] na mesma ordem, sem socket', async () => {
    const woke = await pausedThenSleep();
    woke.set(hold(S1));
    await woke.feed.reconcile();
    expect(woke.sockets).toHaveLength(0);
    expect(await loadAgpFeed()).toEqual({ sessionId: S1, connection: 'paused', questions: [q('a'), q('b')] });
  });

  it('acorda já gravando (alvo): a primeira escrita é connecting com [a, b]', async () => {
    const woke = await pausedThenSleep();
    woke.set(target(S1));
    await woke.feed.reconcile();
    expect(woke.writes[0]).toEqual({ sessionId: S1, connection: 'connecting', questions: [q('a'), q('b')] });
    expect(woke.sockets).toHaveLength(1);
  });

  it('depois de acordar em hold, seleção null limpa o feed', async () => {
    const woke = await pausedThenSleep();
    woke.set(hold(S1));
    await woke.feed.reconcile();
    woke.set(null);
    await woke.feed.reconcile();
    expect(await loadAgpFeed()).toEqual(EMPTY_AGP_FEED);
  });

  it('storage de OUTRA sessão: hold -> paused com lista vazia; alvo -> connecting vazio (nunca as perguntas dela)', async () => {
    await writeAgpFeed({ sessionId: S2, connection: 'live', questions: [q('x')] });
    const held = rig(true);
    held.set(hold(S1));
    await held.feed.reconcile();
    expect(await loadAgpFeed()).toEqual({ sessionId: S1, connection: 'paused', questions: [] });

    await writeAgpFeed({ sessionId: S2, connection: 'live', questions: [q('x')] });
    const followed = rig(true);
    followed.set(target(S1));
    await followed.feed.reconcile();
    expect(followed.writes[0]).toEqual({ sessionId: S1, connection: 'connecting', questions: [] });
  });

  it('sem readStored o primeiro run em hold publica paused vazio (nunca fica o storage de antes)', async () => {
    await writeAgpFeed({ sessionId: S1, connection: 'live', questions: [q('a')] });
    r.set(hold(S1));
    await r.feed.reconcile();
    expect(await loadAgpFeed()).toEqual({ sessionId: S1, connection: 'paused', questions: [] });
  });
});

describe('4004 (sessão não ativa) não vira paused nem reabre (D-12)', () => {
  it('4004 -> hold continua idle (nenhuma escrita paused) -> alvo da mesma sessão não abre socket novo', async () => {
    r.set(target(S1));
    await r.feed.reconcile();
    (r.sockets[0] as FakeSocket).drop(AGP_SESSION_NOT_ACTIVE_CODE);
    await r.feed.reconcile();
    expect(await loadAgpFeed()).toEqual({ sessionId: S1, connection: 'idle', questions: [] });
    const before = r.writes.length;

    r.set(hold(S1));
    await r.feed.reconcile();
    expect(r.writes).toHaveLength(before);
    expect(await loadAgpFeed()).toEqual({ sessionId: S1, connection: 'idle', questions: [] });

    r.set(target(S1));
    await r.feed.reconcile();
    expect(r.sockets).toHaveLength(1);
    expect(r.timers).toHaveLength(0);
    expect(r.writes).toHaveLength(before);
  });

  it('4004 -> hold -> alvo de OUTRA sessão: abre normalmente e a sessão antiga volta a valer como alvo novo', async () => {
    r.set(target(S1));
    await r.feed.reconcile();
    (r.sockets[0] as FakeSocket).drop(AGP_SESSION_NOT_ACTIVE_CODE);
    r.set(hold(S1));
    await r.feed.reconcile();
    r.set(target(S2));
    await r.feed.reconcile();
    expect(r.sockets.map((s) => s.url)).toEqual([target(S1).url, target(S2).url]);
    expect(r.writes.at(-1)).toEqual({ sessionId: S2, connection: 'connecting', questions: [] });
    r.set(target(S1));
    await r.feed.reconcile();
    expect(r.sockets).toHaveLength(3);
  });

  it('4004 -> hold -> seleção null limpa o feed', async () => {
    r.set(target(S1));
    await r.feed.reconcile();
    (r.sockets[0] as FakeSocket).drop(AGP_SESSION_NOT_ACTIVE_CODE);
    r.set(hold(S1));
    await r.feed.reconcile();
    r.set(null);
    await r.feed.reconcile();
    expect(await loadAgpFeed()).toEqual(EMPTY_AGP_FEED);
  });

  it('feed novo com storage idle da sessão (4004 antes do sono) e hold: nenhuma escrita paused', async () => {
    await writeAgpFeed({ sessionId: S1, connection: 'idle', questions: [] });
    const woke = rig(true);
    woke.set(hold(S1));
    await woke.feed.reconcile();
    expect(woke.writes).toHaveLength(0);
    expect(await loadAgpFeed()).toEqual({ sessionId: S1, connection: 'idle', questions: [] });
  });

  it('feed novo com storage idle e ALVO da mesma sessão: o boot tenta de novo, como hoje', async () => {
    await writeAgpFeed({ sessionId: S1, connection: 'idle', questions: [] });
    const woke = rig(true);
    woke.set(target(S1));
    await woke.feed.reconcile();
    expect(woke.sockets).toHaveLength(1);
    expect(woke.writes[0]).toEqual({ sessionId: S1, connection: 'connecting', questions: [] });
  });
});

describe('trocar de sessão dentro do hold', () => {
  it('hold S1 -> hold S2: paused de S2 com lista vazia (nunca as perguntas de S1)', async () => {
    await followWithQuestions();
    r.set(hold(S1));
    await r.feed.reconcile();
    r.set(hold(S2));
    await r.feed.reconcile();
    expect(await loadAgpFeed()).toEqual({ sessionId: S2, connection: 'paused', questions: [] });
  });
});

describe('heldFromStored (puro)', () => {
  it('mesma sessão: as perguntas salvas na mesma ordem, não encerrada pelo backend', () => {
    const stored = { sessionId: S1, connection: 'paused' as const, questions: [q('a'), q('b')] };
    expect(heldFromStored(stored, S1)).toEqual({ sessionId: S1, questions: [q('a'), q('b')], endedByBackend: false });
  });

  it('salvo idle da mesma sessão: marcada como encerrada pelo backend', () => {
    expect(heldFromStored({ sessionId: S1, connection: 'idle', questions: [] }, S1)).toMatchObject({
      sessionId: S1,
      endedByBackend: true,
    });
  });

  it('sessão diferente ou salvo vazio: null', () => {
    expect(heldFromStored({ sessionId: S2, connection: 'paused', questions: [q('x')] }, S1)).toBeNull();
    expect(heldFromStored(EMPTY_AGP_FEED, S1)).toBeNull();
  });
});

describe('o marcador do 4004 e o salvo do boot nas decisões puras', () => {
  const ended = { sessionId: S1, questions: [], endedByBackend: true };
  const saved = (connection: 'paused' | 'idle' | 'live', sessionId = S1, questions = [q('a'), q('b')]) => ({
    sessionId,
    connection,
    questions,
  });

  it('decideAgpHold: sessão seguida marcada -> guarda o marcador e NÃO pede paused', () => {
    const step = decideAgpHold(S1, { target: { sessionId: S1 }, questions: [], endedByBackend: true }, null);
    expect(step).toEqual({ kind: 'mark', held: ended });
  });

  it('decideAgpHold: já segurando a sessão marcada -> nada a fazer', () => {
    expect(decideAgpHold(S1, null, ended)).toEqual({ kind: 'none' });
  });

  it('decideAgpResume: sessão marcada -> bloqueado; outra sessão -> conectar vazio (sessão nova limpa o marcador)', () => {
    expect(decideAgpResume(S1, ended)).toEqual({ kind: 'blocked' });
    expect(decideAgpResume(S2, ended)).toEqual({ kind: 'connect', questions: [] });
  });

  it('decideAgpHold com o salvo do boot: paused da mesma sessão -> pausar com as perguntas; idle -> marcador; outra sessão -> vazio', () => {
    expect(decideAgpHold(S1, null, null, saved('paused'))).toMatchObject({ kind: 'pause', held: { questions: [q('a'), q('b')] } });
    expect(decideAgpHold(S1, null, null, saved('idle', S1, []))).toEqual({ kind: 'mark', held: ended });
    expect(decideAgpHold(S1, null, null, saved('paused', S2))).toMatchObject({ kind: 'pause', held: { sessionId: S1, questions: [] } });
  });

  it('decideAgpResume com o salvo do boot: mesma sessão -> perguntas dele; idle -> conectar (a marca do salvo é ignorada); outra sessão -> vazio', () => {
    expect(decideAgpResume(S1, null, saved('paused'))).toEqual({ kind: 'connect', questions: [q('a'), q('b')] });
    expect(decideAgpResume(S1, null, saved('idle', S1, []))).toEqual({ kind: 'connect', questions: [] });
    expect(decideAgpResume(S1, null, saved('live', S2))).toEqual({ kind: 'connect', questions: [] });
  });

  it('o held tem prioridade sobre o salvo do boot', () => {
    const held = { sessionId: S1, questions: [q('z')], endedByBackend: false };
    expect(decideAgpResume(S1, held, saved('paused'))).toEqual({ kind: 'connect', questions: [q('z')] });
  });
});
