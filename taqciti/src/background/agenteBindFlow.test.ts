/**
 * Fluxo de vínculo (plano 08-10, Tasks 2 e 3): vincular uma reunião ao vivo (ID manual ou cliente)
 * mandando em partes tudo o que já foi falado antes de liberar o envio ao vivo, e enviar a reunião
 * encerrada e guardada. Storage simulado, portas falsas, `send` e `sleep` injetados — nenhuma rede.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeStorageMock } from '@/test/chromeStorageMock';
import type { FakeSessionGateway } from '@/test/fakeClientDirectory';
import type { AgenteSessionGateway } from '@/features/agente/clientDirectory';
import { segmentKey, splitWords } from '@/features/agente/wordDelta';
import type { AgenteConfig, ExtensionChunkRequest } from '@/shared/config/agenteConfig';
import { IDLE_STATE } from '@/shared/types/domain';
import type {
  LiveSegment,
  MeetingPhase,
  MeetingRecord,
  MeetingSessionState,
  MeetingState,
} from '@/shared/types/domain';

const OTHER_SESSION_ID = '22222222-2222-2222-2222-222222222222';
const CLIENTS = [{ id: 'c1', client: 'ACME', name: 'Projeto ACME' }];

const READY_CONFIG: AgenteConfig = {
  agenteBackendUrl: 'https://agente.test',
  streamingEnabled: true,
  agenteSessionId: '',
  agenteApiKey: 's3cr3t',
  confirmedMeetingId: '',
};

function segment(index: number, text = `fala numero ${index}`): LiveSegment {
  return {
    captionId: `c${index}`,
    speaker: 'Ana',
    text,
    startOffsetMs: index * 1000,
    endOffsetMs: index * 1000 + 500,
  };
}

const segmentsOf = (count: number): LiveSegment[] =>
  Array.from({ length: count }, (_, index) => segment(index));

function meetingState(
  meetingId: string,
  segments: LiveSegment[],
  phase: MeetingPhase = 'recording',
): MeetingState {
  const session = {
    meetingId,
    title: 'Reunião de teste',
    segments,
  } as MeetingSessionState;
  return { phase, session };
}

/** O que a reunião tem "falado": a semente esperada de um vínculo feito agora. */
function seedOf(segments: LiveSegment[]): Record<string, number> {
  const seed: Record<string, number> = {};
  segments.forEach((item, index) => {
    seed[segmentKey(item, index)] = splitWords(item.text).length;
  });
  return seed;
}

interface SetupOptions {
  meeting?: MeetingState;
  records?: Record<string, MeetingRecord>;
  config?: AgenteConfig;
  sessions?: AgenteSessionGateway;
  /** Resposta de cada envio (número da chamada, de 1). Padrão: 202. */
  respond?: (call: number) => Promise<Response> | Response;
}

async function setup(options: SetupOptions = {}) {
  const mock = installChromeStorageMock({});
  const { createBindFlow } = await import('./agenteBindFlow');
  const store = await import('@/shared/config/agenteAssociationStore');

  // Importado aqui (depois do resetModules) para a classe de erro ser a mesma do fluxo.
  const { createFakeClientDirectory, createFakeSessionGateway } =
    await import('@/test/fakeClientDirectory');
  const directory = createFakeClientDirectory(CLIENTS);
  const fakeSessions = createFakeSessionGateway();
  const sessions = options.sessions ?? fakeSessions;
  const world = { meeting: options.meeting ?? meetingState('m1', segmentsOf(3)) };

  let calls = 0;
  const send = vi.fn<(request: ExtensionChunkRequest) => Promise<Response>>(async () => {
    calls += 1;
    const call = calls;
    return options.respond
      ? options.respond(call)
      : ({ ok: true, status: 202 } as Response);
  });
  const sleep = vi.fn<(ms: number) => Promise<void>>(() => Promise.resolve());
  const onLinked = vi.fn<(meetingId: string) => Promise<void>>(() => Promise.resolve());
  const onSettled = vi.fn<(meetingId: string) => Promise<void>>(() => Promise.resolve());

  const flow = createBindFlow({
    directory,
    sessions,
    getMeetingState: () => world.meeting,
    getRecord: (id) => Promise.resolve(options.records?.[id] ?? null),
    loadConfig: () => Promise.resolve(options.config ?? READY_CONFIG),
    send,
    sleep,
    onLinked,
    onSettled,
  });

  const bodies = () =>
    send.mock.calls.map(
      ([request]) =>
        JSON.parse(request.init.body as string) as {
          session_id: string;
          text: string;
          chunk_id?: string;
        },
    );
  const created = (meetingId = 'm1') =>
    store.applyAssociationEvent(meetingId, { type: 'created' });
  return {
    flow,
    mock,
    store,
    world,
    send,
    sleep,
    onLinked,
    onSettled,
    bodies,
    created,
    sessions: fakeSessions as FakeSessionGateway,
    directory,
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe('vínculo ao vivo — ID manual', () => {
  it('manda as 3 falas em ordem para a sessão manual e só então fica linked, com a semente', async () => {
    const segments = segmentsOf(3);
    const { flow, store, created, bodies, onLinked } = await setup({
      meeting: meetingState('m1', segments),
    });
    await created();

    const result = await flow.bind('m1', { kind: 'manual', sessionId: OTHER_SESSION_ID });
    expect(result).toEqual({ ok: true });
    await flow.whenIdle();

    expect(bodies().map((body) => body.text)).toEqual(segments.map((item) => item.text));
    expect(bodies().every((body) => body.session_id === OTHER_SESSION_ID)).toBe(true);
    expect(await store.getAssociation('m1')).toEqual({
      meetingId: 'm1',
      state: 'linked',
      clientName: 'Sessão 22222222',
      sessionId: OTHER_SESSION_ID,
      origin: 'manual-id',
      seedSent: seedOf(segments),
    });
    expect(onLinked).toHaveBeenCalledTimes(1);
    expect(onLinked).toHaveBeenCalledWith('m1');
  });

  it('cada parte vai com chunk_id bulk:{meetingId}:{index}, na ordem (D-19)', async () => {
    const { flow, created, bodies } = await setup({ meeting: meetingState('m2', segmentsOf(3)) });
    await created('m2');

    await flow.bind('m2', { kind: 'manual', sessionId: OTHER_SESSION_ID });
    await flow.whenIdle();

    expect(bodies().map((body) => body.chunk_id)).toEqual(['bulk:m2:0', 'bulk:m2:1', 'bulk:m2:2']);
  });

  it('responde antes de o envio terminar; durante ele a associação está em linking com o progresso', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { flow, store, created, send } = await setup({
      respond: async (call) => {
        if (call === 3) await gate; // a terceira parte espera
        return { ok: true, status: 202 } as Response;
      },
    });
    await created();

    const result = await flow.bind('m1', { kind: 'manual', sessionId: OTHER_SESSION_ID });
    expect(result).toEqual({ ok: true });
    await vi.waitFor(async () => {
      expect((await store.getAssociation('m1'))?.sendProgress).toEqual({
        done: 2,
        total: 3,
      });
    });
    expect((await store.getAssociation('m1'))?.state).toBe('linking');
    expect(send).toHaveBeenCalledTimes(3);

    release();
    await flow.whenIdle();
    expect((await store.getAssociation('m1'))?.state).toBe('linked');
  });

  it('reunião sem nenhuma fala: nada é enviado, a semente é {} e onLinked é chamado', async () => {
    const { flow, store, created, send, onLinked } = await setup({
      meeting: meetingState('m1', []),
    });
    await created();
    await flow.bind('m1', { kind: 'manual', sessionId: OTHER_SESSION_ID });
    await flow.whenIdle();

    expect(send).not.toHaveBeenCalled();
    expect(await store.getAssociation('m1')).toMatchObject({
      state: 'linked',
      seedSent: {},
    });
    expect(onLinked).toHaveBeenCalledTimes(1);
  });

  it('falha de rede no envio: send-failed com o erro send e o progresso preservado', async () => {
    const { flow, store, created, send, onLinked } = await setup({
      respond: (call) => ({ ok: call === 1, status: call === 1 ? 202 : 500 }) as Response,
    });
    await created();
    await flow.bind('m1', { kind: 'manual', sessionId: OTHER_SESSION_ID });
    await flow.whenIdle();

    expect(await store.getAssociation('m1')).toMatchObject({
      state: 'send-failed',
      error: 'send',
      sendProgress: { done: 1, total: 3 },
      sessionId: OTHER_SESSION_ID,
    });
    expect(send).toHaveBeenCalledTimes(5); // 1 entregue + 1 tentativa + 3 novas tentativas
    expect(onLinked).not.toHaveBeenCalled();
  });
});

describe('vínculo ao vivo — cliente', () => {
  it('cria UMA sessão com (clientId, título da reunião) e termina linked com o id do gateway', async () => {
    const { flow, store, created, sessions, bodies } = await setup();
    await created();

    const result = await flow.bind('m1', {
      kind: 'client',
      clientId: 'c1',
      clientName: 'ACME',
    });
    expect(result).toEqual({ ok: true });
    await flow.whenIdle();

    expect(sessions.calls).toEqual([{ clientId: 'c1', name: 'Reunião de teste' }]);
    const association = await store.getAssociation('m1');
    expect(association).toMatchObject({
      state: 'linked',
      clientName: 'ACME',
      origin: 'picker',
    });
    expect(association?.sessionId).toBe('00000000-0000-4000-8000-000000000001');
    expect(bodies().every((body) => body.session_id === association?.sessionId)).toBe(
      true,
    );
  });

  it('cliente novo: cria o cliente e depois a sessão', async () => {
    const { flow, store, created, sessions, directory } = await setup();
    await created();

    const result = await flow.bind('m1', { kind: 'new-client', name: 'Cliente Novo' });
    expect(result).toEqual({ ok: true });
    await flow.whenIdle();

    expect(directory.createCalls).toBe(1);
    expect(sessions.calls).toHaveLength(1);
    expect(await store.getAssociation('m1')).toMatchObject({
      state: 'linked',
      clientName: 'Cliente Novo',
    });
  });

  it('nome duplicado: devolve duplicate, não muda o estado e não cria sessão', async () => {
    const { flow, store, created, sessions } = await setup();
    await created();

    const result = await flow.bind('m1', { kind: 'new-client', name: 'acme' });
    expect(result).toEqual({ ok: false, error: 'duplicate' });
    expect((await store.getAssociation('m1'))?.state).toBe('pending');
    expect(sessions.calls).toHaveLength(0);
  });

  it('falha ao criar a sessão: deferred com create-session e nenhum POST de transcrição', async () => {
    const { createFakeSessionGateway } = await import('@/test/fakeClientDirectory');
    const failing = createFakeSessionGateway({ failWith: new Error('backend fora') });
    const { flow, store, created, send, onLinked } = await setup({ sessions: failing });
    await created();

    const result = await flow.bind('m1', {
      kind: 'client',
      clientId: 'c1',
      clientName: 'ACME',
    });
    expect(result).toEqual({ ok: false, error: 'create-session' });
    expect(await store.getAssociation('m1')).toMatchObject({
      state: 'deferred',
      error: 'create-session',
    });
    expect(send).not.toHaveBeenCalled();
    expect(onLinked).not.toHaveBeenCalled();
  });

  it('a reunião termina enquanto a sessão é criada e a criação falha: ended-unsent com create-session', async () => {
    let fail!: (error: Error) => void;
    const slowSessions: AgenteSessionGateway = {
      createSession: () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
    };
    const { flow, store, world, created } = await setup({ sessions: slowSessions });
    await created();

    const pending = flow.bind('m1', {
      kind: 'client',
      clientId: 'c1',
      clientName: 'ACME',
    });
    await vi.waitFor(() => expect(fail).toBeTypeOf('function'));
    world.meeting = meetingState('m1', segmentsOf(3), 'ended'); // MEETING_FINISHED
    fail(new Error('backend fora'));

    expect(await pending).toEqual({ ok: false, error: 'create-session' });
    expect(await store.getAssociation('m1')).toMatchObject({
      state: 'ended-unsent',
      error: 'create-session',
    });
  });
});

describe('vínculo ao vivo — bordas', () => {
  it('dois bind simultâneos: um ok, o outro invalid-state, uma única sessão criada', async () => {
    const { flow, created, sessions } = await setup();
    await created();

    const target = { kind: 'client', clientId: 'c1', clientName: 'ACME' } as const;
    const results = await Promise.all([flow.bind('m1', target), flow.bind('m1', target)]);
    await flow.whenIdle();

    expect(results).toContainEqual({ ok: true });
    expect(results).toContainEqual({ ok: false, error: 'invalid-state' });
    expect(sessions.calls).toHaveLength(1);
  });

  it('dois bind simultâneos com cliente novo: um único cliente e uma única sessão', async () => {
    const { flow, created, sessions, directory } = await setup();
    await created();

    const target = { kind: 'new-client', name: 'Cliente Novo' } as const;
    const results = await Promise.all([flow.bind('m1', target), flow.bind('m1', target)]);
    await flow.whenIdle();

    expect(results).toContainEqual({ ok: false, error: 'invalid-state' });
    expect(directory.createCalls).toBe(1);
    expect(sessions.calls).toHaveLength(1);
  });

  it('associação já linked: invalid-state', async () => {
    const { flow, store, created } = await setup();
    await created();
    await flow.bind('m1', { kind: 'manual', sessionId: OTHER_SESSION_ID });
    await flow.whenIdle();

    const again = await flow.bind('m1', { kind: 'manual', sessionId: OTHER_SESSION_ID });
    expect(again).toEqual({ ok: false, error: 'invalid-state' });
    expect((await store.getAssociation('m1'))?.state).toBe('linked');
  });

  it('reunião sem associação: not-found', async () => {
    const { flow } = await setup();
    expect(
      await flow.bind('m1', { kind: 'manual', sessionId: OTHER_SESSION_ID }),
    ).toEqual({
      ok: false,
      error: 'not-found',
    });
  });

  it('streaming desligado na config: create-session e o estado não muda', async () => {
    const { flow, store, created, send, sessions } = await setup({
      config: { ...READY_CONFIG, streamingEnabled: false },
    });
    await created();

    const result = await flow.bind('m1', {
      kind: 'client',
      clientId: 'c1',
      clientName: 'ACME',
    });
    expect(result).toEqual({ ok: false, error: 'create-session' });
    expect((await store.getAssociation('m1'))?.state).toBe('pending');
    expect(sessions.calls).toHaveLength(0);
    expect(send).not.toHaveBeenCalled();
  });

  it('a chave x-agente-key só vai no request: nunca no JSON salvo da associação', async () => {
    const { flow, mock, created } = await setup();
    await created();
    await flow.bind('m1', { kind: 'manual', sessionId: OTHER_SESSION_ID });
    await flow.whenIdle();
    expect(JSON.stringify(mock.local.values)).not.toContain('s3cr3t');
  });
});

describe('raiz de composição — agenteAssociation', () => {
  it('padrão de produção: backend sem as rotas (404) deixa a lista indisponível', async () => {
    // Portas HTTP de produção (08-12): sem simular o backend, o teste tentaria a rede de verdade.
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 404 }))));
    installChromeStorageMock({
      extra: {
        runtime: { sendMessage: vi.fn(() => Promise.resolve()) },
        tabs: { sendMessage: vi.fn(() => Promise.resolve()) },
      },
    });
    const { agenteAssociation } = await import('./agenteAssociation');
    expect(await agenteAssociation.listClients()).toEqual({
      ok: false,
      error: 'unavailable',
    });
  });

  it('configureAgenteAssociation troca as portas e o comando de vínculo chega ao fluxo', async () => {
    installChromeStorageMock({
      extra: {
        runtime: { sendMessage: vi.fn(() => Promise.resolve()) },
        tabs: { sendMessage: vi.fn(() => Promise.resolve()) },
      },
    });
    const { createFakeClientDirectory, createFakeSessionGateway } =
      await import('@/test/fakeClientDirectory');
    const { agenteAssociation, configureAgenteAssociation } =
      await import('./agenteAssociation');
    const store = await import('@/shared/config/agenteAssociationStore');
    const send = vi.fn(() => Promise.resolve({ ok: true, status: 202 } as Response));
    const onLinked = vi.fn(() => Promise.resolve());
    configureAgenteAssociation({
      directory: createFakeClientDirectory(CLIENTS),
      sessions: createFakeSessionGateway(),
      getMeetingState: () => meetingState('m1', segmentsOf(2)),
      getRecord: () => Promise.resolve(null),
      loadConfig: () => Promise.resolve(READY_CONFIG),
      send,
      sleep: () => Promise.resolve(),
      onLinked,
    });
    expect(await agenteAssociation.listClients()).toMatchObject({ ok: true });

    await store.applyAssociationEvent('m1', { type: 'created' });
    expect(await agenteAssociation.open('m1')).toEqual({ ok: true });
    expect(await agenteAssociation.defer('m1')).toEqual({ ok: true });
    const result = await agenteAssociation.bind('m1', {
      kind: 'client',
      clientId: 'c1',
      clientName: 'ACME',
    });
    expect(result).toEqual({ ok: true });
    await vi.waitFor(() => expect(onLinked).toHaveBeenCalledTimes(1));
    expect(send).toHaveBeenCalledTimes(2);
  });
});

function recordOf(meetingId: string, segments: LiveSegment[]): MeetingRecord {
  return { id: meetingId, title: 'Reunião guardada', segments } as MeetingRecord;
}

/** Reunião m2 já encerrada e não enviada (ended-unsent), com `count` falas no histórico. */
async function setupEnded(count: number, options: SetupOptions = {}) {
  const segments = segmentsOf(count);
  const context = await setup({
    meeting: IDLE_STATE,
    records: { m2: recordOf('m2', segments) },
    ...options,
  });
  await context.created('m2');
  await context.store.applyAssociationEvent('m2', { type: 'meeting-ended' });
  return { ...context, segments };
}

describe('enviar a reunião encerrada (D-09, D-10)', () => {
  it('45 falas: 1 sessão, 45 POSTs em ordem, pausa de 1 s entre blocos, progresso 1..45 e sent', async () => {
    const { flow, store, sessions, bodies, sleep, segments } = await setupEnded(45);
    const progress: number[] = [];
    store.subscribeAssociations((map) => {
      const done = map.m2?.sendProgress?.done;
      if (done !== undefined && progress.at(-1) !== done) progress.push(done);
    });

    const result = await flow.bind('m2', {
      kind: 'client',
      clientId: 'c1',
      clientName: 'ACME',
    });
    expect(result).toEqual({ ok: true });
    await flow.whenIdle();

    expect(sessions.calls).toEqual([{ clientId: 'c1', name: 'Reunião guardada' }]);
    const sessionId = '00000000-0000-4000-8000-000000000001';
    expect(bodies().map((body) => body.text)).toEqual(segments.map((item) => item.text));
    expect(bodies().map((body) => body.chunk_id)).toEqual(
      segments.map((_, index) => `bulk:m2:${index}`),
    );
    expect(bodies().every((body) => body.session_id === sessionId)).toBe(true);
    expect(sleep.mock.calls).toEqual([[1000], [1000]]);
    expect(progress).toEqual(Array.from({ length: 45 }, (_, index) => index + 1));
    expect(await store.getAssociation('m2')).toEqual({
      meetingId: 'm2',
      state: 'sent',
      clientName: 'ACME',
      sessionId,
      origin: 'picker',
      seedSent: seedOf(segments),
    });
  });

  it('falha na parte 7: send-failed com 6/45 e o erro send; nada é enviado depois', async () => {
    const { flow, store, send } = await setupEnded(45, {
      respond: (call) => ({ ok: call < 7, status: call < 7 ? 202 : 500 }) as Response,
    });
    await flow.bind('m2', { kind: 'client', clientId: 'c1', clientName: 'ACME' });
    await flow.whenIdle();

    expect(await store.getAssociation('m2')).toMatchObject({
      state: 'send-failed',
      error: 'send',
      sendProgress: { done: 6, total: 45 },
    });
    expect(send).toHaveBeenCalledTimes(10); // 6 entregues + a 7ª e as 3 novas tentativas
  });

  it('falha ao criar a sessão: volta a ended-unsent com create-session e nada é enviado', async () => {
    const { createFakeSessionGateway } = await import('@/test/fakeClientDirectory');
    const failing = createFakeSessionGateway({ failWith: new Error('backend fora') });
    const { flow, store, send } = await setupEnded(5, { sessions: failing });

    const result = await flow.bind('m2', {
      kind: 'client',
      clientId: 'c1',
      clientName: 'ACME',
    });
    expect(result).toEqual({ ok: false, error: 'create-session' });
    expect(await store.getAssociation('m2')).toMatchObject({
      state: 'ended-unsent',
      error: 'create-session',
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('ID manual numa reunião encerrada: nenhuma sessão criada, envio para o ID e sent', async () => {
    const { flow, store, sessions, bodies } = await setupEnded(3);
    await flow.bind('m2', { kind: 'manual', sessionId: OTHER_SESSION_ID });
    await flow.whenIdle();

    expect(sessions.calls).toHaveLength(0);
    expect(bodies().every((body) => body.session_id === OTHER_SESSION_ID)).toBe(true);
    expect(await store.getAssociation('m2')).toMatchObject({
      state: 'sent',
      origin: 'manual-id',
    });
  });

  it('sent e send-failed: bind devolve invalid-state (retomar é do plano 08-20)', async () => {
    const { flow, store, send } = await setupEnded(2);
    await flow.bind('m2', { kind: 'manual', sessionId: OTHER_SESSION_ID });
    await flow.whenIdle();
    expect((await store.getAssociation('m2'))?.state).toBe('sent');
    send.mockClear();
    expect(
      await flow.bind('m2', { kind: 'manual', sessionId: OTHER_SESSION_ID }),
    ).toEqual({
      ok: false,
      error: 'invalid-state',
    });

    await store.applyAssociationEvent('m3', { type: 'created' });
    await store.applyAssociationEvent('m3', { type: 'meeting-ended' });
    await store.applyAssociationEvent('m3', {
      type: 'send-started',
      origin: 'manual-id',
      clientName: 'Sessão 22222222',
      sessionId: OTHER_SESSION_ID,
    });
    await store.applyAssociationEvent('m3', { type: 'send-failed', error: 'send' });
    expect((await store.getAssociation('m3'))?.state).toBe('send-failed');
    expect(
      await flow.bind('m3', { kind: 'manual', sessionId: OTHER_SESSION_ID }),
    ).toEqual({
      ok: false,
      error: 'invalid-state',
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('registro do histórico ausente: not-found sem mudar o estado', async () => {
    const { flow, store, created } = await setup({ meeting: IDLE_STATE, records: {} });
    await created('m2');
    await store.applyAssociationEvent('m2', { type: 'meeting-ended' });

    const result = await flow.bind('m2', { kind: 'manual', sessionId: OTHER_SESSION_ID });
    expect(result).toEqual({ ok: false, error: 'not-found' });
    expect((await store.getAssociation('m2'))?.state).toBe('ended-unsent');
  });

  it('a mesma sala volta no meio do envio: as partes seguintes viram link-*, termina linked e onLinked sai uma vez', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { flow, store, onLinked, segments } = await setupEnded(20, {
      respond: async (call) => {
        if (call === 11) await gate; // a 11ª parte espera: o envio está no meio
        return { ok: true, status: 202 } as Response;
      },
    });

    await flow.bind('m2', { kind: 'manual', sessionId: OTHER_SESSION_ID });
    await vi.waitFor(async () => {
      expect((await store.getAssociation('m2'))?.sendProgress?.done).toBe(10);
    });
    await store.applyAssociationEvent('m2', { type: 'meeting-resumed' });
    expect((await store.getAssociation('m2'))?.state).toBe('linking');

    release();
    await flow.whenIdle();
    expect(await store.getAssociation('m2')).toEqual({
      meetingId: 'm2',
      state: 'linked',
      clientName: 'Sessão 22222222',
      sessionId: OTHER_SESSION_ID,
      origin: 'manual-id',
      seedSent: seedOf(segments),
    });
    expect(onLinked).toHaveBeenCalledTimes(1);
  });
});

describe('continuar o envio parado (plano 08-20, B3)', () => {
  const OK = { ok: true, status: 202 } as Response;
  const DOWN = { ok: false, status: 500 } as Response;

  /** Reunião m2 com `count` falas, enviada ao cliente, que parou na parte 7 (6 confirmadas). */
  async function setupStopped(count = 30, options: SetupOptions = {}) {
    const net = { down: true };
    const context = await setupEnded(count, {
      respond: (call) => (net.down && call >= 7 ? DOWN : OK),
      ...options,
    });
    await context.flow.bind('m2', { kind: 'client', clientId: 'c1', clientName: 'ACME' });
    await context.flow.whenIdle();
    return { ...context, net };
  }

  it('retoma da 7ª parte (posição 6) para a mesma sessão, sem criar outra, e termina em sent', async () => {
    const { flow, store, sessions, send, bodies, segments, net, onSettled } = await setupStopped();
    expect(await store.getAssociation('m2')).toMatchObject({
      state: 'send-failed',
      sendProgress: { done: 6, total: 30 },
    });
    const sessionId = '00000000-0000-4000-8000-000000000001';
    const before = send.mock.calls.length;
    onSettled.mockClear();

    net.down = false;
    expect(await flow.resumeSend('m2')).toEqual({ ok: true });
    await flow.whenIdle();

    const resumed = bodies().slice(before);
    expect(resumed.map((body) => body.chunk_id)).toEqual(
      Array.from({ length: 24 }, (_, index) => `bulk:m2:${index + 6}`),
    );
    expect(resumed.map((body) => body.text)).toEqual(segments.slice(6).map((item) => item.text));
    expect(resumed.every((body) => body.session_id === sessionId)).toBe(true);
    expect(sessions.calls).toHaveLength(1);
    expect(await store.getAssociation('m2')).toEqual({
      meetingId: 'm2',
      state: 'sent',
      clientName: 'ACME',
      sessionId,
      origin: 'picker',
      seedSent: seedOf(segments),
    });
    expect(onSettled).toHaveBeenCalledWith('m2');
  });

  it('responde antes de o envio acabar e cancela o prazo de 5 min (sem finishBy nem finishTries)', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const net = { down: true };
    const { flow, store } = await setupEnded(30, {
      respond: async (call) => {
        if (call === 11) await gate; // a 1ª parte da retomada espera: o envio está no meio
        return net.down && call >= 7 && call < 11 ? DOWN : OK;
      },
    });
    await flow.bind('m2', { kind: 'client', clientId: 'c1', clientName: 'ACME' });
    await flow.whenIdle();
    await store.applyAssociationEvent('m2', { type: 'finish-armed', by: 123 });
    await store.applyAssociationEvent('m2', { type: 'finish-failed' });
    expect(await store.getAssociation('m2')).toMatchObject({ finishBy: 123, finishTries: 1 });

    net.down = false;
    expect(await flow.resumeSend('m2')).toEqual({ ok: true });
    const during = await store.getAssociation('m2');
    expect(during?.state).toBe('sending');
    expect(during).not.toHaveProperty('finishBy');
    expect(during).not.toHaveProperty('finishTries');
    expect(during).not.toHaveProperty('error');

    release();
    await flow.whenIdle();
    expect((await store.getAssociation('m2'))?.state).toBe('sent');
  });

  it('nova falha na retomada: volta a send-failed com o novo progresso', async () => {
    // chamadas 7..10 = a 7ª parte esgota as tentativas; a retomada (11..14) entrega 7..10 e cai na 15ª
    const { flow, store } = await setupStopped(30, {
      respond: (call) => (call >= 7 && call < 11 ? DOWN : call >= 15 ? DOWN : OK),
    });
    await flow.resumeSend('m2');
    await flow.whenIdle();
    expect(await store.getAssociation('m2')).toMatchObject({
      state: 'send-failed',
      error: 'send',
      sendProgress: { done: 10, total: 30 },
    });
  });

  it('sessão já encerrada pela B4-b: as partes restantes entram, sessionFinished fica e nada novo é encerrado', async () => {
    const { flow, store, sessions, net, segments, onSettled } = await setupStopped(10);
    await store.applyAssociationEvent('m2', { type: 'session-finished' });
    net.down = false;
    onSettled.mockClear();

    expect(await flow.resumeSend('m2')).toEqual({ ok: true });
    await flow.whenIdle();

    const after = await store.getAssociation('m2');
    expect(after).toMatchObject({ state: 'sent', sessionFinished: true, seedSent: seedOf(segments) });
    expect(sessions.calls).toHaveLength(1);
    const { isEligibleForClose } = await import('@/features/agente/associationClose');
    expect(isEligibleForClose(after!)).toBe(false);
  });

  it('sessão encerrada e a sala volta durante o envio retomado: pending limpo, nunca linking/linked', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const net = { down: true };
    const { flow, store } = await setupEnded(10, {
      respond: async (call) => {
        if (call === 11) await gate;
        return net.down && call >= 7 && call < 11 ? DOWN : OK;
      },
    });
    await flow.bind('m2', { kind: 'client', clientId: 'c1', clientName: 'ACME' });
    await flow.whenIdle();
    await store.applyAssociationEvent('m2', { type: 'session-finished' });
    net.down = false;
    await flow.resumeSend('m2');
    await store.applyAssociationEvent('m2', { type: 'meeting-resumed' });
    expect(await store.getAssociation('m2')).toEqual({ meetingId: 'm2', state: 'pending' });

    release();
    await flow.whenIdle();
    expect(await store.getAssociation('m2')).toEqual({ meetingId: 'm2', state: 'pending' });
  });

  it('recusas: pending, sent e reunião ao vivo -> invalid-state; sem associação ou sem registro -> not-found', async () => {
    const { flow, store, world, send } = await setupStopped();
    send.mockClear();

    // ao vivo: m2 está acontecendo agora
    world.meeting = meetingState('m2', segmentsOf(30));
    expect(await flow.resumeSend('m2')).toEqual({ ok: false, error: 'invalid-state' });
    world.meeting = IDLE_STATE;

    await store.applyAssociationEvent('m3', { type: 'created' });
    expect(await flow.resumeSend('m3')).toEqual({ ok: false, error: 'invalid-state' });
    expect(await flow.resumeSend('m9')).toEqual({ ok: false, error: 'not-found' });

    await store.applyAssociationEvent('m4', { type: 'created' });
    await store.applyAssociationEvent('m4', { type: 'meeting-ended' });
    await store.applyAssociationEvent('m4', {
      type: 'send-started',
      origin: 'manual-id',
      clientName: 'X',
      sessionId: OTHER_SESSION_ID,
    });
    await store.applyAssociationEvent('m4', { type: 'send-completed', seedSent: {} });
    expect((await store.getAssociation('m4'))?.state).toBe('sent');
    expect(await flow.resumeSend('m4')).toEqual({ ok: false, error: 'invalid-state' });

    // send-failed sem registro no histórico
    await store.applyAssociationEvent('m5', { type: 'created' });
    await store.applyAssociationEvent('m5', { type: 'meeting-ended' });
    await store.applyAssociationEvent('m5', {
      type: 'send-started',
      origin: 'manual-id',
      clientName: 'X',
      sessionId: OTHER_SESSION_ID,
    });
    await store.applyAssociationEvent('m5', { type: 'send-failed', error: 'send' });
    expect(await flow.resumeSend('m5')).toEqual({ ok: false, error: 'not-found' });
    expect((await store.getAssociation('m5'))?.state).toBe('send-failed');
    expect(send).not.toHaveBeenCalled();
  });

  it('dois comandos simultâneos: um ok, o outro invalid-state, e cada parte sai uma vez', async () => {
    const { flow, send, net } = await setupStopped();
    const before = send.mock.calls.length;
    net.down = false;
    const results = await Promise.all([flow.resumeSend('m2'), flow.resumeSend('m2')]);
    await flow.whenIdle();
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(send.mock.calls.length - before).toBe(24);
  });
});

describe('comando ui/agente/meeting/resume-send (plano 08-20, Task 2)', () => {
  it('uiMessageSchema aceita o comando e recusa meetingId vazio', async () => {
    const { uiMessageSchema } = await import('@/shared/types/messages');
    expect(
      uiMessageSchema.safeParse({ type: 'ui/agente/meeting/resume-send', meetingId: 'm2' }).success,
    ).toBe(true);
    expect(
      uiMessageSchema.safeParse({ type: 'ui/agente/meeting/resume-send', meetingId: '' }).success,
    ).toBe(false);
  });

  it('agenteAssociation.resumeSend chega ao fluxo: retoma do ponto confirmado para a mesma sessão', async () => {
    installChromeStorageMock({
      extra: {
        runtime: { sendMessage: vi.fn(() => Promise.resolve()) },
        tabs: { sendMessage: vi.fn(() => Promise.resolve()) },
      },
    });
    const { createFakeClientDirectory, createFakeSessionGateway } =
      await import('@/test/fakeClientDirectory');
    const { agenteAssociation, configureAgenteAssociation } = await import('./agenteAssociation');
    const store = await import('@/shared/config/agenteAssociationStore');
    const send = vi.fn(() => Promise.resolve({ ok: true, status: 202 } as Response));
    const sessions = createFakeSessionGateway();
    configureAgenteAssociation({
      directory: createFakeClientDirectory(CLIENTS),
      sessions,
      getMeetingState: () => IDLE_STATE,
      getRecord: () => Promise.resolve(recordOf('m2', segmentsOf(10))),
      loadConfig: () => Promise.resolve(READY_CONFIG),
      send,
      sleep: () => Promise.resolve(),
      onSettled: () => Promise.resolve(),
    });
    await store.applyAssociationEvent('m2', { type: 'created' });
    await store.applyAssociationEvent('m2', { type: 'meeting-ended' });
    await store.applyAssociationEvent('m2', {
      type: 'send-started',
      origin: 'manual-id',
      clientName: 'Sessão 22222222',
      sessionId: OTHER_SESSION_ID,
    });
    await store.applyAssociationEvent('m2', { type: 'send-progress', done: 4, total: 10 });
    await store.applyAssociationEvent('m2', { type: 'send-failed', error: 'send' });

    expect(await agenteAssociation.resumeSend('m2')).toEqual({ ok: true });
    await vi.waitFor(async () => expect((await store.getAssociation('m2'))?.state).toBe('sent'));
    expect(send).toHaveBeenCalledTimes(6); // partes 4..9
    expect(sessions.calls).toHaveLength(0);
  });
});
