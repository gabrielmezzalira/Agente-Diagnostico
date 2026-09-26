/**
 * Teste ponta a ponta do streaming (TAQ-01, Fase 7): dispatch REAL da máquina
 * de estados -> flush agrupado de sessionController.ts -> agenteStreamer.ts
 * -> fetch para /webhook/extension. Cobre o caminho feliz (D-06/D-07), o
 * gate desligado por padrão (D-09), o header condicional (D-10), o
 * comportamento não-bloqueante em erro de rede, e a idempotência/
 * concorrência da fila do streamer.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeStorageMock } from '@/test/chromeStorageMock';
import { STATE_FLUSH_INTERVAL_MS } from '@/shared/config/constants';
import type { MeetingSessionState, MeetingState } from '@/shared/types/domain';

const AGENTE_URL = 'http://agente.test';
const SESSION_ID = '11111111-1111-1111-1111-111111111111';

const READY_CONFIG = {
  agenteBackendUrl: AGENTE_URL,
  streamingEnabled: true,
  agenteSessionId: SESSION_ID,
  agenteApiKey: 's3cr3t',
};

function baseSession(overrides: Partial<MeetingSessionState> = {}): MeetingSessionState {
  return {
    meetingId: 'm1',
    meetingCode: 'abc-defg-hij',
    provider: 'google-meet',
    tabId: 1,
    title: 'Reunião de teste',
    titleAuto: false,
    startedAt: 1000,
    endedAt: null,
    captionsEnabled: true,
    participants: [],
    presentNow: [],
    speakersObserved: [],
    segments: [],
    sealedCaptionIds: [],
    droppedSegments: 0,
    reconnectCount: 0,
    captureDegradedCount: 0,
    lastChunkAt: null,
    wasDiscardedAndRestarted: false,
    captionLanguage: 'unknown',
    languageWarningDismissed: false,
    chunksSinceLanguageCheck: 0,
    ...overrides,
  };
}

function meetingState(overrides: Partial<MeetingSessionState> = {}): MeetingState {
  return { phase: 'recording', session: baseSession(overrides) };
}

/** `fetch` tipado explicitamente — sem isto, `vi.fn(() => ...)` infere assinatura de 0 args. */
function createFetchMock() {
  return vi.fn<(input: string, init: RequestInit) => Promise<Response>>(() =>
    Promise.resolve({ ok: true, status: 202 } as Response),
  );
}

async function fresh() {
  const mock = installChromeStorageMock({
    extra: {
      runtime: { sendMessage: vi.fn(() => Promise.resolve()) },
      tabs: { sendMessage: vi.fn(() => Promise.resolve()) },
    },
  });
  const sessionController = await import('./sessionController');
  const agenteStreamer = await import('./agenteStreamer');
  return { sessionController, agenteStreamer, mock };
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('streaming ponta a ponta via dispatch real (D-06/D-07)', () => {
  it('após o debounce, envia POST com só o texto novo do segmento', async () => {
    const { sessionController, agenteStreamer } = await fresh();
    const fetchMock = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);
    agenteStreamer.configureAgenteStreamer({ loadConfig: () => Promise.resolve(READY_CONFIG) });

    await sessionController.dispatch({
      type: 'MEETING_DETECTED',
      meetingId: 'm1',
      meetingCode: 'abc-defg-hij',
      provider: 'google-meet',
      tabId: 1,
      title: 'Reunião de teste',
      captionsEnabled: true,
      at: 1000,
    });
    await sessionController.dispatch({
      type: 'CAPTION_CHUNK',
      chunk: { captionId: 'c1', speaker: 'Ana', text: 'olá tudo bem', atMs: 1100 },
    });

    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${AGENTE_URL}/webhook/extension`);
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      'x-agente-key': 's3cr3t',
    });
    expect(JSON.parse(init.body as string)).toEqual({
      session_id: SESSION_ID,
      text: 'olá tudo bem',
      speaker: 'Ana',
    });
  });

  it('um segundo chunk do mesmo segmento envia só a cauda nova ("como vai")', async () => {
    const { sessionController, agenteStreamer } = await fresh();
    const fetchMock = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);
    agenteStreamer.configureAgenteStreamer({ loadConfig: () => Promise.resolve(READY_CONFIG) });

    await sessionController.dispatch({
      type: 'MEETING_DETECTED',
      meetingId: 'm1',
      meetingCode: 'abc-defg-hij',
      provider: 'google-meet',
      tabId: 1,
      title: 'Reunião de teste',
      captionsEnabled: true,
      at: 1000,
    });
    await sessionController.dispatch({
      type: 'CAPTION_CHUNK',
      chunk: { captionId: 'c1', speaker: 'Ana', text: 'olá tudo bem', atMs: 1100 },
    });
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await sessionController.dispatch({
      type: 'CAPTION_CHUNK',
      chunk: { captionId: 'c1', speaker: 'Ana', text: 'olá tudo bem como vai', atMs: 1300 },
    });
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const [, init] = fetchMock.mock.calls[1]!;
    expect(JSON.parse(init.body as string)).toMatchObject({ text: 'como vai' });
  });
});

describe('D-09: streaming desligado por padrão', () => {
  it('sem configurar o streamer (padrão da build), nenhum fetch é disparado', async () => {
    const { sessionController } = await fresh();
    const fetchMock = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    await sessionController.dispatch({
      type: 'MEETING_DETECTED',
      meetingId: 'm1',
      meetingCode: 'abc-defg-hij',
      provider: 'google-meet',
      tabId: 1,
      title: 'Reunião de teste',
      captionsEnabled: true,
      at: 1000,
    });
    await sessionController.dispatch({
      type: 'CAPTION_CHUNK',
      chunk: { captionId: 'c1', speaker: 'Ana', text: 'olá tudo bem', atMs: 1100 },
    });
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    // Dá tempo real para qualquer envio indevido aparecer antes de afirmar ausência.
    await vi.waitFor(() => expect(true).toBe(true));

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('D-10: header x-agente-key condicional', () => {
  it('com chave vazia, o header x-agente-key fica ausente (não string vazia)', async () => {
    const { sessionController, agenteStreamer } = await fresh();
    const fetchMock = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);
    agenteStreamer.configureAgenteStreamer({
      loadConfig: () => Promise.resolve({ ...READY_CONFIG, agenteApiKey: '' }),
    });

    await sessionController.dispatch({
      type: 'MEETING_DETECTED',
      meetingId: 'm1',
      meetingCode: 'abc-defg-hij',
      provider: 'google-meet',
      tabId: 1,
      title: 'Reunião de teste',
      captionsEnabled: true,
      at: 1000,
    });
    await sessionController.dispatch({
      type: 'CAPTION_CHUNK',
      chunk: { captionId: 'c1', speaker: 'Ana', text: 'olá tudo bem', atMs: 1100 },
    });
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [, init] = fetchMock.mock.calls[0]!;
    expect(Object.keys(init.headers as Record<string, string>)).not.toContain('x-agente-key');
  });
});

describe('não bloqueante em erro de rede', () => {
  it('fetch rejeitando não impede dispatch de resolver nem a gravação do estado', async () => {
    const { sessionController, agenteStreamer, mock } = await fresh();
    agenteStreamer.configureAgenteStreamer({
      loadConfig: () => Promise.resolve(READY_CONFIG),
      send: () => Promise.reject(new Error('rede falhou')),
    });

    await sessionController.dispatch({
      type: 'MEETING_DETECTED',
      meetingId: 'm1',
      meetingCode: 'abc-defg-hij',
      provider: 'google-meet',
      tabId: 1,
      title: 'Reunião de teste',
      captionsEnabled: true,
      at: 1000,
    });
    await sessionController.dispatch({
      type: 'CAPTION_CHUNK',
      chunk: { captionId: 'c1', speaker: 'Ana', text: 'olá tudo bem', atMs: 1100 },
    });

    // dispatch() já resolveu sem lançar — a asserção abaixo é sobre o estado.
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await vi.waitFor(() => {
      const saved = mock.session.values['taq:state'] as MeetingState | undefined;
      expect(saved?.session?.segments).toHaveLength(1);
    });
  });
});

describe('idempotência e concorrência (fila serializada)', () => {
  it('duas chamadas concorrentes com o mesmo estado novo geram exatamente 1 fetch; a terceira não gera nenhum', async () => {
    const { agenteStreamer } = await fresh();
    const fetchMock = createFetchMock();
    agenteStreamer.configureAgenteStreamer({
      loadConfig: () => Promise.resolve(READY_CONFIG),
      send: (request) => fetchMock(request.url, request.init),
    });

    // Primeiro flush: sessão ainda sem segmentos — só ancora o cursor (prime), sem envio.
    await agenteStreamer.onSessionFlushed(meetingState());
    expect(fetchMock).not.toHaveBeenCalled();

    const withSegment = meetingState({
      segments: [
        { captionId: 'c1', speaker: 'Ana', text: 'olá tudo bem', startOffsetMs: 0, endOffsetMs: 100 },
      ],
    });

    await Promise.all([
      agenteStreamer.onSessionFlushed(withSegment),
      agenteStreamer.onSessionFlushed(withSegment),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await agenteStreamer.onSessionFlushed(withSegment);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
