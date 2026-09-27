/**
 * Teste ponta a ponta do streaming (TAQ-01, Fase 7): dispatch REAL da máquina
 * de estados -> flush agrupado de sessionController.ts -> agenteStreamer.ts
 * -> fetch para /webhook/extension. Cobre o caminho feliz (D-06/D-07), o
 * gate desligado por padrão (D-09), o header condicional (D-10), o
 * comportamento não-bloqueante em erro de rede, a idempotência/concorrência
 * da fila do streamer, e a janela de agrupamento por fala (G-07-1, plano
 * 07-04, D-06 refinado): o envio ao Agente só sai depois de
 * `AGENTE_PHRASE_QUIET_MS` sem palavra nova, além do flush de 250 ms da
 * Taqciti (`STATE_FLUSH_INTERVAL_MS`) — por isso toda asserção de envio avança
 * as duas janelas, e toda asserção de ausência drena a fila do streamer com
 * um passo idempotente antes de afirmar (WR-09).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeStorageMock } from '@/test/chromeStorageMock';
import { STATE_FLUSH_INTERVAL_MS, STORAGE_KEYS } from '@/shared/config/constants';
import { AGENTE_PHRASE_MAX_WAIT_MS, AGENTE_PHRASE_QUIET_MS } from '@/shared/config/agenteConfig';
import type { MeetingSessionState, MeetingState } from '@/shared/types/domain';

/*
 * https:// (não http://): desde o WR-06, `isValidAgenteBackendUrl` só aceita
 * http: para host de loopback — um host de teste comum como "agente.test"
 * com http: vira invalid-url e nenhum destes testes de streaming chegaria a
 * "ready". O protocolo em si não é o que estes testes exercitam.
 */
const AGENTE_URL = 'https://agente.test';
const SESSION_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_SESSION_ID = '22222222-2222-2222-2222-222222222222';
/** Cruza o flush de 250 ms da Taqciti (STATE_FLUSH_INTERVAL_MS) sem se confundir com ele —
 *  representa duas palavras da mesma fala chegando em ciclos de flush diferentes. */
const WORD_GAP_MS = STATE_FLUSH_INTERVAL_MS + 50;

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
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
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
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await sessionController.dispatch({
      type: 'CAPTION_CHUNK',
      chunk: { captionId: 'c1', speaker: 'Ana', text: 'olá tudo bem como vai', atMs: 1300 },
    });
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const [, init] = fetchMock.mock.calls[1]!;
    expect(JSON.parse(init.body as string)).toMatchObject({ text: 'como vai' });
  });
});

describe('G-07-1: uma fala vira um envio (janela de agrupamento por fala)', () => {
  it('duas palavras da mesma fala, chegando em ciclos de flush diferentes, geram 1 POST só depois do silêncio', async () => {
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
      chunk: { captionId: 'c1', speaker: 'Você', text: 'Olá,', atMs: 1100 },
    });
    await vi.advanceTimersByTimeAsync(WORD_GAP_MS);
    // Drena a fila (passo idempotente) antes de afirmar ausência — WR-09.
    await agenteStreamer.onSessionFlushed(sessionController.getState());
    expect(fetchMock).not.toHaveBeenCalled();

    await sessionController.dispatch({
      type: 'CAPTION_CHUNK',
      chunk: { captionId: 'c1', speaker: 'Você', text: 'Olá, boa noite!', atMs: 1100 + WORD_GAP_MS + 50 },
    });
    await vi.advanceTimersByTimeAsync(WORD_GAP_MS);
    await agenteStreamer.onSessionFlushed(sessionController.getState());
    expect(fetchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(init.body as string)).toEqual({
      session_id: SESSION_ID,
      text: 'Olá, boa noite!',
      speaker: 'Você',
    });

    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_MAX_WAIT_MS);
    await agenteStreamer.onSessionFlushed(sessionController.getState());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('D-09: streaming desligado por padrão', () => {
  it('sem configurar o streamer (padrão da build), nenhum fetch é disparado', async () => {
    const { sessionController, agenteStreamer } = await fresh();
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
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS + AGENTE_PHRASE_MAX_WAIT_MS);
    // Drena a fila (passo idempotente) antes de afirmar ausência — WR-09.
    await agenteStreamer.onSessionFlushed(sessionController.getState());

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
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [, init] = fetchMock.mock.calls[0]!;
    expect(Object.keys(init.headers as Record<string, string>)).not.toContain('x-agente-key');
  });
});

describe('não bloqueante em erro de rede', () => {
  it('fetch rejeitando não impede dispatch de resolver nem a gravação do estado', async () => {
    const { sessionController, agenteStreamer, mock } = await fresh();
    // WR-10 item 3: `send` precisa ser um spy com asserção própria — antes,
    // nenhum `expect` verificava que o envio de fato aconteceu, e um `send`
    // que nunca fosse chamado passaria no teste igual.
    const send = vi.fn(() => Promise.reject(new Error('rede falhou')));
    agenteStreamer.configureAgenteStreamer({
      loadConfig: () => Promise.resolve(READY_CONFIG),
      send,
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

    // Avança a janela para o envio (rejeitado) de fato acontecer — sem isto o
    // .catch() de sendPhrases nunca roda dentro deste teste.
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));

    // WR-01: a fala não se perde na primeira falha — sai de novo após 1 s,
    // 2 s e 4 s (total de 4 envios) e depois a fila desiste.
    await vi.advanceTimersByTimeAsync(1_000 + 2_000 + 4_000);
    expect(send).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(send).toHaveBeenCalledTimes(4);
  });

  it('WR-01: desligar o streaming durante o retry interrompe as novas tentativas (D-09)', async () => {
    const { sessionController, agenteStreamer } = await fresh();
    const send = vi.fn(() => Promise.resolve({ ok: false, status: 503 } as Response));
    let currentConfig = { ...READY_CONFIG };
    agenteStreamer.configureAgenteStreamer({
      loadConfig: () => Promise.resolve(currentConfig),
      send,
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
      chunk: { captionId: 'c1', speaker: 'Ana', text: 'isso é confidencial', atMs: 1100 },
    });
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));

    // Desliga e um flush acontece antes da 1ª nova tentativa (1 s).
    currentConfig = { ...currentConfig, streamingEnabled: false };
    await agenteStreamer.onSessionFlushed(sessionController.getState());
    await vi.advanceTimersByTimeAsync(60_000);
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe('configuração vinda do storage (D-08)', () => {
  it('sem configureAgenteStreamer: grava a config no storage e o streamer transmite (TAQ-01/SC1)', async () => {
    const { sessionController } = await fresh();
    const { patchAgenteConfig } = await import('@/shared/config/agenteConfigStore');
    const fetchMock = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    await patchAgenteConfig({
      agenteBackendUrl: AGENTE_URL,
      streamingEnabled: true,
      agenteSessionId: SESSION_ID,
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
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${AGENTE_URL}/webhook/extension`);
    expect(JSON.parse(init.body as string)).toMatchObject({
      session_id: SESSION_ID,
      text: 'olá tudo bem',
    });
  });

  it('desligar para o envio na hora; religar não reenvia o que foi falado desligado (D-09)', async () => {
    const { sessionController, agenteStreamer } = await fresh();
    const { patchAgenteConfig } = await import('@/shared/config/agenteConfigStore');
    const fetchMock = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    await patchAgenteConfig({
      agenteBackendUrl: AGENTE_URL,
      streamingEnabled: true,
      agenteSessionId: SESSION_ID,
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
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // Desliga pelo storage: nenhum fetch novo a partir do próximo flush.
    await patchAgenteConfig({ streamingEnabled: false });
    await sessionController.dispatch({
      type: 'CAPTION_CHUNK',
      chunk: { captionId: 'c1', speaker: 'Ana', text: 'olá tudo bem pausa aqui', atMs: 1300 },
    });
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS + AGENTE_PHRASE_MAX_WAIT_MS);
    await agenteStreamer.onSessionFlushed(sessionController.getState());
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Religa: o primeiro flush pós-religar só re-ancora o cursor (prime) —
    // nada do que foi falado desligado é enviado (D-09).
    await patchAgenteConfig({ streamingEnabled: true });
    await sessionController.dispatch({
      type: 'CAPTION_CHUNK',
      chunk: { captionId: 'c1', speaker: 'Ana', text: 'olá tudo bem pausa aqui e agora', atMs: 1500 },
    });
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS + AGENTE_PHRASE_MAX_WAIT_MS);
    await agenteStreamer.onSessionFlushed(sessionController.getState());
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Só o texto realmente novo dali para frente é enviado — nunca "pausa aqui".
    await sessionController.dispatch({
      type: 'CAPTION_CHUNK',
      chunk: {
        captionId: 'c1',
        speaker: 'Ana',
        text: 'olá tudo bem pausa aqui e agora sim',
        atMs: 1700,
      },
    });
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const [, init] = fetchMock.mock.calls[1]!;
    expect(JSON.parse(init.body as string)).toMatchObject({ text: 'sim' });
  });

  it('reinício do service worker: primeiro flush pós-reinício não reenvia texto antigo', async () => {
    const { sessionController } = await fresh();
    const { patchAgenteConfig } = await import('@/shared/config/agenteConfigStore');
    const fetchMock = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    await patchAgenteConfig({
      agenteBackendUrl: AGENTE_URL,
      streamingEnabled: true,
      agenteSessionId: SESSION_ID,
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
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // Reinício do service worker: módulos recarregados (cursor/queue em memória
    // somem), estado reidratado do storage — igual ao Meet em produção.
    vi.resetModules();
    const restarted = await import('./sessionController');
    // Reimporta o agenteStreamer depois do reset para pegar a MESMA instância
    // (cursor/buffer/timer novos) que o sessionController reiniciado usa.
    const restartedStreamer = await import('./agenteStreamer');
    await restarted.hydrate();

    await restarted.dispatch({
      type: 'CAPTION_CHUNK',
      chunk: { captionId: 'c1', speaker: 'Ana', text: 'olá tudo bem e mais isso', atMs: 1600 },
    });
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS + AGENTE_PHRASE_MAX_WAIT_MS);
    await restartedStreamer.onSessionFlushed(restarted.getState());
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await restarted.dispatch({
      type: 'CAPTION_CHUNK',
      chunk: { captionId: 'c1', speaker: 'Ana', text: 'olá tudo bem e mais isso ok', atMs: 1800 },
    });
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const [, init] = fetchMock.mock.calls[1]!;
    expect(JSON.parse(init.body as string)).toMatchObject({ text: 'ok' });
  });

  it('custo: chrome.storage.local.get da chave taq:agenteConfig é chamado uma única vez em vários flushes', async () => {
    const { sessionController, mock } = await fresh();
    const { patchAgenteConfig } = await import('@/shared/config/agenteConfigStore');
    const fetchMock = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    await patchAgenteConfig({
      agenteBackendUrl: AGENTE_URL,
      streamingEnabled: true,
      agenteSessionId: SESSION_ID,
    });

    const countAgenteConfigReads = () =>
      mock.local.get.mock.calls.filter(([keys]) => keys === STORAGE_KEYS.agenteConfig).length;
    const readsBeforeFlushes = countAgenteConfigReads();

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

    const novasPalavras = ['zero', 'um', 'dois'];
    let texto = 'olá tudo bem';
    for (let i = 0; i < novasPalavras.length; i += 1) {
      texto = `${texto} ${novasPalavras[i]}`;
      await sessionController.dispatch({
        type: 'CAPTION_CHUNK',
        chunk: { captionId: 'c1', speaker: 'Ana', text: texto, atMs: 1100 + i * 300 },
      });
      await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
      await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(i + 1));
    }

    expect(countAgenteConfigReads() - readsBeforeFlushes).toBe(1);
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
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await agenteStreamer.onSessionFlushed(withSegment);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('G-07-2 e bordas da janela por fala (Task 3, plano 07-04)', () => {
  it('G-07-2a: "boa noite" repetido 3x sem pausa longa vira 1 envio com as 6 palavras', async () => {
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

    const palavras = ['Boa', 'noite', 'boa', 'noite', 'boa', 'noite'];
    let texto = '';
    let atMs = 1100;
    for (const palavra of palavras) {
      texto = texto.length === 0 ? palavra : `${texto} ${palavra}`;
      await sessionController.dispatch({
        type: 'CAPTION_CHUNK',
        chunk: { captionId: 'c1', speaker: 'Você', text: texto, atMs },
      });
      atMs += WORD_GAP_MS;
      await vi.advanceTimersByTimeAsync(WORD_GAP_MS);
    }
    await agenteStreamer.onSessionFlushed(sessionController.getState());
    expect(fetchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(init.body as string)).toEqual({
      session_id: SESSION_ID,
      text: 'Boa noite boa noite boa noite',
      speaker: 'Você',
    });
  });

  it('G-07-2b: repetições da mesma fala com pausa longa entre elas viram 3 envios; total enviado bate com o total falado (6 palavras)', async () => {
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

    let atMs = 1100;
    const dispatchChunk = async (texto: string) => {
      await sessionController.dispatch({
        type: 'CAPTION_CHUNK',
        chunk: { captionId: 'c1', speaker: 'Você', text: texto, atMs },
      });
      atMs += WORD_GAP_MS;
      await vi.advanceTimersByTimeAsync(WORD_GAP_MS);
    };

    await dispatchChunk('Boa');
    await dispatchChunk('Boa noite');
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await dispatchChunk('Boa noite boa');
    await dispatchChunk('Boa noite boa noite');
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    await dispatchChunk('Boa noite boa noite boa');
    await dispatchChunk('Boa noite boa noite boa noite');
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

    const textos = fetchMock.mock.calls.map(
      ([, init]) => (JSON.parse(init.body as string) as { text: string }).text,
    );
    expect(textos).toEqual(['Boa noite', 'boa noite', 'boa noite']);
    expect(textos.join(' ').split(/\s+/).filter(Boolean)).toHaveLength(6);
  });

  it('teto em fala contínua: pelo menos 1 envio ocorre antes da 20ª palavra ser despachada, sem perder nem repetir nenhuma', async () => {
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

    const palavras = Array.from({ length: 20 }, (_, i) => `p${i + 1}`);
    let texto = '';
    let atMs = 1100;
    let fetchesAntesDaUltima = -1;
    for (let i = 0; i < palavras.length; i += 1) {
      if (i === palavras.length - 1) {
        fetchesAntesDaUltima = fetchMock.mock.calls.length;
      }
      texto = texto.length === 0 ? palavras[i]! : `${texto} ${palavras[i]}`;
      await sessionController.dispatch({
        type: 'CAPTION_CHUNK',
        chunk: { captionId: 'c1', speaker: 'Você', text: texto, atMs },
      });
      atMs += WORD_GAP_MS;
      await vi.advanceTimersByTimeAsync(WORD_GAP_MS);
    }
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await agenteStreamer.onSessionFlushed(sessionController.getState());

    expect(fetchesAntesDaUltima).toBeGreaterThanOrEqual(1);

    const enviado = fetchMock.mock.calls
      .map(([, init]) => (JSON.parse(init.body as string) as { text: string }).text)
      .join(' ');
    expect(enviado.split(/\s+/).filter(Boolean)).toEqual(palavras);
  });

  it('fim: fala pendente + MEETING_FINISHED envia na hora, sem esperar a janela', async () => {
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
      chunk: { captionId: 'c1', speaker: 'Ana', text: 'até logo', atMs: 1100 },
    });
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    /*
     * WR-10 item 2: espera a fila do streamer terminar SEM chamar
     * `onSessionFlushed` de novo manualmente — chamar de novo é um passo
     * real, e mascarava se `flushState` (sessionController.ts) de fato
     * chama o streamer. `whenAgenteStreamerIdle()` só observa.
     */
    await agenteStreamer.whenAgenteStreamerIdle();
    // A fala está pendente (silêncio ainda não bateu) — nenhum envio ainda.
    expect(fetchMock).not.toHaveBeenCalled();

    await sessionController.dispatch({ type: 'MEETING_FINISHED', at: 2000 });
    await agenteStreamer.whenAgenteStreamerIdle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(init.body as string)).toMatchObject({ text: 'até logo' });
  });

  it('pausa: fala pendente + PAUSE envia na hora, sem esperar a janela', async () => {
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
      chunk: { captionId: 'c1', speaker: 'Ana', text: 'vou pausar aqui', atMs: 1100 },
    });
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    // WR-10 item 2: ver comentário equivalente no teste "fim" acima.
    await agenteStreamer.whenAgenteStreamerIdle();
    expect(fetchMock).not.toHaveBeenCalled();

    await sessionController.dispatch({ type: 'PAUSE' });
    await agenteStreamer.whenAgenteStreamerIdle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(init.body as string)).toMatchObject({ text: 'vou pausar aqui' });
  });

  it('toggle com fala pendente: desligar descarta o que estava esperando; religar só envia o que vem depois (D-09)', async () => {
    const { sessionController, agenteStreamer } = await fresh();
    const fetchMock = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);
    let currentConfig = { ...READY_CONFIG };
    agenteStreamer.configureAgenteStreamer({ loadConfig: () => Promise.resolve(currentConfig) });

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
      chunk: { captionId: 'c1', speaker: 'Ana', text: 'isso vai ficar pendente', atMs: 1100 },
    });
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await agenteStreamer.onSessionFlushed(sessionController.getState());
    expect(fetchMock).not.toHaveBeenCalled();

    // Desliga sem novo dispatch — o timer interno da janela é quem descobre
    // a mudança (tick relê a config) e descarta o pendente (D-09).
    currentConfig = { ...currentConfig, streamingEnabled: false };
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS + AGENTE_PHRASE_MAX_WAIT_MS);
    await agenteStreamer.onSessionFlushed(sessionController.getState());
    expect(fetchMock).not.toHaveBeenCalled();

    // Religa: o cursor foi resetado enquanto desligado (mesmo mecanismo do
    // D-09 já provado no Task 2), então o PRIMEIRO flush pós-religar só
    // re-ancora (prime) — nada do texto descartado é reenviado aqui.
    currentConfig = { ...currentConfig, streamingEnabled: true };
    await sessionController.dispatch({
      type: 'CAPTION_CHUNK',
      chunk: { captionId: 'c1', speaker: 'Ana', text: 'isso vai ficar pendente e', atMs: 1300 },
    });
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await agenteStreamer.onSessionFlushed(sessionController.getState());
    expect(fetchMock).not.toHaveBeenCalled();

    // Só o texto realmente novo dali para frente é enviado.
    await sessionController.dispatch({
      type: 'CAPTION_CHUNK',
      chunk: { captionId: 'c1', speaker: 'Ana', text: 'isso vai ficar pendente e isso é novo', atMs: 1500 },
    });
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(init.body as string)).toMatchObject({ text: 'isso é novo' });
  });

  it('troca de sessão: a fala pendente sai sob o session_id em que foi acumulada; a próxima sai sob o novo', async () => {
    const { sessionController, agenteStreamer } = await fresh();
    const fetchMock = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);
    let currentConfig = { ...READY_CONFIG };
    agenteStreamer.configureAgenteStreamer({ loadConfig: () => Promise.resolve(currentConfig) });

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
      chunk: { captionId: 'c1', speaker: 'Ana', text: 'palavras antigas aqui', atMs: 1100 },
    });
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await agenteStreamer.onSessionFlushed(sessionController.getState());
    expect(fetchMock).not.toHaveBeenCalled();

    // Troca de sessão SEM novo dispatch — a fala pendente já foi acumulada
    // sob a sessão antiga e deve sair sob ela quando o silêncio bater.
    currentConfig = { ...currentConfig, agenteSessionId: OTHER_SESSION_ID };
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body as string)).toMatchObject({
      session_id: SESSION_ID,
      text: 'palavras antigas aqui',
    });

    // Palavras novas no MESMO segmento, já com a sessão trocada, saem sob a nova.
    await sessionController.dispatch({
      type: 'CAPTION_CHUNK',
      chunk: { captionId: 'c1', speaker: 'Ana', text: 'palavras antigas aqui e novas', atMs: 1600 },
    });
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    expect(JSON.parse(fetchMock.mock.calls[1]![1].body as string)).toMatchObject({
      session_id: OTHER_SESSION_ID,
      text: 'e novas',
    });
  });

  it('WR-12: se loadConfig falhar no tick, a fala pendente não fica sem timer — o retry manda depois', async () => {
    const { sessionController, agenteStreamer } = await fresh();
    const fetchMock = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    let loadConfigCalls = 0;
    const loadConfig = vi.fn(() => {
      loadConfigCalls += 1;
      // A 3ª chamada é o tick que dispara depois do silêncio — falha só uma
      // vez, pra provar que o retry defensivo (WR-12) se recupera sozinho.
      if (loadConfigCalls === 3) return Promise.reject(new Error('storage indisponível'));
      return Promise.resolve(READY_CONFIG);
    });
    agenteStreamer.configureAgenteStreamer({ loadConfig });

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
    await agenteStreamer.whenAgenteStreamerIdle();

    await sessionController.dispatch({
      type: 'CAPTION_CHUNK',
      chunk: { captionId: 'c1', speaker: 'Ana', text: 'fala pendente', atMs: 1100 },
    });
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await agenteStreamer.whenAgenteStreamerIdle();

    // O silêncio bate — o tick roda e a 3ª chamada de loadConfig falha.
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await agenteStreamer.whenAgenteStreamerIdle();
    expect(fetchMock).not.toHaveBeenCalled();

    // Sem o retry defensivo, a fala ficaria presa aqui pra sempre — nenhum
    // timer novo seria armado depois de uma falha no tick.
    await vi.advanceTimersByTimeAsync(1_000); // RETRY_MIN_MS (agenteStreamer.ts)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(init.body as string)).toMatchObject({ text: 'fala pendente' });
  });

  it('cadência local intacta: o estado é gravado e retransmitido em 250ms, independente do envio ao Agente', async () => {
    const { sessionController, agenteStreamer, mock } = await fresh();
    const fetchMock = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);
    /*
     * WR-10 item 4: sem configurar o streaming, `expect(fetchMock).not
     * .toHaveBeenCalled()` era verdade só porque nada estava ligado — não
     * provava a independência das duas cadências, que é o que o nome do
     * teste afirma.
     */
    agenteStreamer.configureAgenteStreamer({ loadConfig: () => Promise.resolve(READY_CONFIG) });

    const chromeExtra = mock.chrome as unknown as {
      runtime: { sendMessage: ReturnType<typeof vi.fn> };
    };

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

    const saved = mock.session.values['taq:state'] as MeetingState | undefined;
    expect(saved?.session?.segments).toEqual([
      expect.objectContaining({ captionId: 'c1', speaker: 'Ana', text: 'olá tudo bem' }),
    ]);
    expect(chromeExtra.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'state/updated' }),
    );
    // A cadência de 250ms já rodou (acima) — a janela do Agente (1500ms)
    // ainda não, então nada foi enviado ainda.
    await agenteStreamer.whenAgenteStreamerIdle();
    expect(fetchMock).not.toHaveBeenCalled();

    // Só depois da janela do Agente o envio finalmente acontece — prova de
    // que as duas cadências são independentes, não que o envio nunca ocorre.
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it('reprocessamento: repetir o passo do streamer depois do envio não gera fetch novo', async () => {
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
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await agenteStreamer.onSessionFlushed(sessionController.getState());
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS + AGENTE_PHRASE_MAX_WAIT_MS);
    await agenteStreamer.onSessionFlushed(sessionController.getState());

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('WR-13: dispose() é terminal', () => {
  it('um passo já em voo na instância antiga não envia nem rearma timer depois do dispose', async () => {
    const { sessionController, agenteStreamer } = await fresh();
    const fetchMock = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    let callCount = 0;
    let resolveSecondLoad!: (config: typeof READY_CONFIG) => void;
    const loadConfig = vi.fn(() => {
      callCount += 1;
      // Só a 2ª chamada (o passo com texto novo) fica presa — é o "passo em
      // voo esperando loadConfig" do WR-13. As demais (1ª, a de prime; e
      // qualquer chamada de um timer órfão que sobreviva) resolvem na hora —
      // sem isso, um timer órfão ficaria preso pra sempre esperando
      // loadConfig() e o teste "passaria" mesmo com o bug do WR-13 de volta.
      if (callCount === 2) {
        return new Promise<typeof READY_CONFIG>((resolve) => {
          resolveSecondLoad = resolve;
        });
      }
      return Promise.resolve(READY_CONFIG);
    });
    agenteStreamer.configureAgenteStreamer({ loadConfig });

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
    await agenteStreamer.whenAgenteStreamerIdle();

    await sessionController.dispatch({
      type: 'CAPTION_CHUNK',
      chunk: { captionId: 'c1', speaker: 'Ana', text: 'texto sensível', atMs: 1100 },
    });
    // Dispara o flush -> o passo 2 chama loadConfig() (2ª chamada) e fica
    // preso, esperando a promessa que ainda não resolvemos.
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);

    // A instância é descartada ENQUANTO o passo 2 ainda espera loadConfig —
    // o cenário real seria a Fase 8 trocando o binding no meio de um passo.
    agenteStreamer.configureAgenteStreamer({ loadConfig: () => Promise.resolve(READY_CONFIG) });

    // Só agora o loadConfig() do passo 2 (da instância JÁ DESCARTADA) resolve.
    resolveSecondLoad(READY_CONFIG);
    await Promise.resolve();
    await Promise.resolve();

    // Sem o WR-13, o passo continuaria e enviaria "texto sensível" com o
    // `deps` antigo, ou armaria um timer órfão que dispararia mais tarde.
    expect(fetchMock).not.toHaveBeenCalled();

    // Nenhum timer órfão dispara depois — avança bastante e confirma.
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_MAX_WAIT_MS + 1_000);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
