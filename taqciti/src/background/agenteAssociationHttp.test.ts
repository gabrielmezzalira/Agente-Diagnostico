/**
 * Plano 08-12, Task 3: a raiz de composição de produção usa as portas HTTP. Só `fetch` global é
 * simulado (o "backend"); as portas de clientes e de sessão NÃO são trocadas por
 * `configureAgenteAssociation` — é o caminho real da Taqciti montada como em produção.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeStorageMock } from '@/test/chromeStorageMock';
import { DEFAULT_AGENTE_CONFIG } from '@/shared/config/agenteConfig';
import { STORAGE_KEYS } from '@/shared/config/constants';
import type { LiveSegment, MeetingSessionState, MeetingState } from '@/shared/types/domain';

const BACKEND = 'https://agente.test';
const CLIENT_ID = '33333333-3333-4333-8333-333333333333';
const NEW_SESSION_ID = '44444444-4444-4444-8444-444444444444';

const segments: LiveSegment[] = [0, 1].map((index) => ({
  captionId: `c${index}`,
  speaker: 'Ana',
  text: `fala numero ${index}`,
  startOffsetMs: index * 1000,
  endOffsetMs: index * 1000 + 500,
}));

const liveMeeting: MeetingState = {
  phase: 'recording',
  session: { meetingId: 'm1', title: 'Reunião com o cliente', segments } as MeetingSessionState,
};

interface FetchCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

/** "Backend" simulado: roteia por método + caminho e guarda as chamadas. */
function stubBackend(options: { clientsStatus?: number } = {}) {
  const calls: FetchCall[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({
      url,
      method,
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status });
    if (method === 'GET' && url === `${BACKEND}/webhook/extension/clients`) {
      return options.clientsStatus === undefined || options.clientsStatus === 200
        ? json(200, [{ id: CLIENT_ID, client: 'ACME', name: 'Projeto ACME' }])
        : json(options.clientsStatus, { detail: 'Not Found' });
    }
    if (method === 'POST' && url === `${BACKEND}/webhook/extension/sessions`) {
      return json(201, { id: NEW_SESSION_ID });
    }
    if (method === 'POST' && url === `${BACKEND}/webhook/extension`) {
      return json(202, {});
    }
    return json(500, {});
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

function installStorage() {
  return installChromeStorageMock({
    local: {
      [STORAGE_KEYS.agenteConfig]: {
        ...DEFAULT_AGENTE_CONFIG,
        agenteBackendUrl: BACKEND,
        streamingEnabled: true,
        agenteApiKey: 's3cr3t',
      },
    },
    extra: {
      runtime: { sendMessage: vi.fn(() => Promise.resolve()) },
      tabs: { sendMessage: vi.fn(() => Promise.resolve()) },
    },
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe('composição de produção — portas HTTP', () => {
  it('lista os clientes vindos de GET /webhook/extension/clients, com o x-agente-key', async () => {
    const calls = stubBackend();
    installStorage();
    const { agenteAssociation } = await import('./agenteAssociation');

    expect(await agenteAssociation.listClients()).toEqual({
      ok: true,
      clients: [{ id: CLIENT_ID, client: 'ACME', name: 'Projeto ACME' }],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.headers['x-agente-key']).toBe('s3cr3t');
  });

  it('escolher o cliente cria UMA sessão nova e a transcrição vai para ela (critério 1)', async () => {
    const calls = stubBackend();
    installStorage();
    const { agenteAssociation, configureAgenteAssociation } = await import('./agenteAssociation');
    const store = await import('@/shared/config/agenteAssociationStore');
    // Só o estado da reunião e o gancho pós-vínculo; as portas HTTP ficam as de produção.
    const onLinked = vi.fn(() => Promise.resolve());
    configureAgenteAssociation({
      getMeetingState: () => liveMeeting,
      getRecord: () => Promise.resolve(null),
      onLinked,
    });
    await store.applyAssociationEvent('m1', { type: 'created' });

    const result = await agenteAssociation.bind('m1', {
      kind: 'client',
      clientId: CLIENT_ID,
      clientName: 'ACME',
    });
    expect(result).toEqual({ ok: true });
    await vi.waitFor(async () => {
      expect((await store.getAssociation('m1'))?.state).toBe('linked');
    });

    const sessionPosts = calls.filter((call) => call.url.endsWith('/webhook/extension/sessions'));
    expect(sessionPosts).toHaveLength(1);
    expect(sessionPosts[0]?.body).toEqual({
      project_id: CLIENT_ID,
      name: 'Reunião com o cliente',
    });

    const chunkPosts = calls.filter((call) => call.url === `${BACKEND}/webhook/extension`);
    expect(chunkPosts.map((call) => (call.body as { text: string }).text)).toEqual(
      segments.map((item) => item.text),
    );
    expect(
      chunkPosts.every((call) => (call.body as { session_id: string }).session_id === NEW_SESSION_ID),
    ).toBe(true);
    expect(await store.getAssociation('m1')).toMatchObject({
      state: 'linked',
      sessionId: NEW_SESSION_ID,
      origin: 'picker',
    });
    expect(onLinked).toHaveBeenCalledTimes(1);
  });

  it('404 em GET /clients: lista indisponível (cai no plano B), sem travar', async () => {
    stubBackend({ clientsStatus: 404 });
    installStorage();
    const { agenteAssociation } = await import('./agenteAssociation');

    expect(await agenteAssociation.listClients()).toEqual({ ok: false, error: 'unavailable' });
  });
});
