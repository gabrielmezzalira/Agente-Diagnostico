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
import {
  REJOIN_RESUME_WINDOW_MS,
  STATE_FLUSH_INTERVAL_MS,
  STORAGE_KEYS,
} from '@/shared/config/constants';
import { AGENTE_PHRASE_MAX_WAIT_MS, AGENTE_PHRASE_QUIET_MS } from '@/shared/config/agenteConfig';
import type { MeetingSessionState, MeetingState } from '@/shared/types/domain';

/*
 * https:// (não http://): desde o WR-06, `isValidAgenteBackendUrl` só aceita
 * http: para host de loopback — um host de teste comum como "agente.test"
 * com http: vira invalid-url e nenhum destes testes de streaming chegaria a
 * "ready". O protocolo em si não é o que estes testes exercitam.
 */
const AGENTE_URL = 'https://agente.test';
const OTHER_URL = 'https://outro-agente.test';
const SESSION_ID = '11111111-1111-1111-1111-111111111111';
/** O `chunk_id` de uma fala ao vivo é um UUID gerado uma vez (D-19). */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const OTHER_SESSION_ID = '22222222-2222-2222-2222-222222222222';
/** Cruza o flush de 250 ms da Taqciti (STATE_FLUSH_INTERVAL_MS) sem se confundir com ele —
 *  representa duas palavras da mesma fala chegando em ciclos de flush diferentes. */
const WORD_GAP_MS = STATE_FLUSH_INTERVAL_MS + 50;

const READY_CONFIG = {
  agenteBackendUrl: AGENTE_URL,
  streamingEnabled: true,
  agenteSessionId: SESSION_ID,
  agenteApiKey: 's3cr3t',
  confirmedMeetingId: '',
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

/**
 * `realBinding`: a gravação real do vínculo reunião→sessão (CR-01, 2ª revisão) fica desligada
 * por padrão, para a maioria dos testes (que só querem enviar) não gravarem storage sem
 * querer. Só os testes do vínculo ligam a gravação real. Desde o WR-01 o vínculo mora numa
 * chave própria e gravá-la não mexe na config nem dispara o `onChanged` dela.
 */
async function fresh(options: { realBinding?: boolean } = {}) {
  const mock = installChromeStorageMock({
    extra: {
      runtime: { sendMessage: vi.fn(() => Promise.resolve()) },
      tabs: { sendMessage: vi.fn(() => Promise.resolve()) },
    },
  });
  const sessionController = await import('./sessionController');
  const agenteStreamer = await import('./agenteStreamer');
  // `destination: undefined` = política `configDestination` (a regra da Fase 7, o ID salvo na config):
  // estes testes cobrem a MECÂNICA de janela/retry/vínculo CR-01, que continua valendo para essa política.
  agenteStreamer.configureAgenteStreamer(
    options.realBinding ? { destination: undefined } : { bindMeeting: undefined, destination: undefined },
  );
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
      chunk_id: expect.stringMatching(UUID_PATTERN),
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
      chunk_id: expect.stringMatching(UUID_PATTERN),
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

  it('WR-07: um 401 fica gravado no status de runtime, e mudar a config zera o status', async () => {
    const { sessionController, agenteStreamer, mock } = await fresh();
    const { patchAgenteConfig } = await import('@/shared/config/agenteConfigStore');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 401 } as Response)),
    );
    await patchAgenteConfig({
      agenteBackendUrl: AGENTE_URL,
      streamingEnabled: true,
      agenteSessionId: SESSION_ID,
      agenteApiKey: 'chave-errada',
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
    await vi.waitFor(() =>
      expect(mock.session.values[STORAGE_KEYS.agenteSendOutcome]).toMatchObject({
        lastOutcome: 'rejected',
        lastHttpStatus: 401,
      }),
    );

    // A pessoa corrige a chave: o 401 era da config anterior e sai da tela.
    await patchAgenteConfig({ agenteApiKey: 'chave-certa' });
    await agenteStreamer.whenAgenteStreamerIdle();
    await vi.waitFor(() =>
      expect(mock.session.values[STORAGE_KEYS.agenteSendOutcome]).toMatchObject({
        lastOutcome: null,
        lastHttpStatus: null,
      }),
    );
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

  it('WR-01 (2ª rev.): trocar a URL descarta os trechos do backend antigo — o trecho novo sai para a URL nova sem esperar os retries e o status não volta a "tentando de novo"', async () => {
    const { sessionController, agenteStreamer, mock } = await fresh();
    const { patchAgenteConfig } = await import('@/shared/config/agenteConfigStore');
    const fetchMock = vi.fn<(input: string, init: RequestInit) => Promise<Response>>((url) =>
      Promise.resolve(
        url.startsWith(AGENTE_URL)
          ? ({ ok: false, status: 503 } as Response)
          : ({ ok: true, status: 202 } as Response),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    await patchAgenteConfig({
      agenteBackendUrl: AGENTE_URL,
      streamingEnabled: true,
      agenteSessionId: SESSION_ID,
      agenteApiKey: 's3cr3t',
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
      chunk: { captionId: 'c1', speaker: 'Ana', text: 'fala para o backend fora do ar', atMs: 1100 },
    });
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1)); // 1ª tentativa em A (503)

    // A pessoa corrige a URL: o trecho que esperava nova tentativa em A é descartado.
    await patchAgenteConfig({ agenteBackendUrl: OTHER_URL });
    await agenteStreamer.whenAgenteStreamerIdle();

    await sessionController.dispatch({
      type: 'CAPTION_CHUNK',
      chunk: { captionId: 'c2', speaker: 'Ana', text: 'fala para o backend certo', atMs: 5000 },
    });
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await vi.advanceTimersByTimeAsync(2_000);
    await vi.waitFor(() =>
      expect(mock.session.values[STORAGE_KEYS.agenteSendOutcome]).toMatchObject({ lastOutcome: 'sent' }),
    );

    await vi.advanceTimersByTimeAsync(60_000);
    const urls = fetchMock.mock.calls.map(([url]) => url);
    // Nenhuma nova tentativa em A depois da troca; o único envio novo foi para B.
    expect(urls.filter((url) => url.startsWith(AGENTE_URL))).toHaveLength(1);
    expect(urls.filter((url) => url.startsWith(OTHER_URL))).toEqual([`${OTHER_URL}/webhook/extension`]);
    const lastBody = JSON.parse(fetchMock.mock.calls.at(-1)![1].body as string) as { text: string };
    expect(lastBody.text).toContain('backend certo');
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

  it('desligar para o envio na hora; religar não reenvia o que foi falado desligado, mas envia o que vem logo depois (D-09/WR-02)', async () => {
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

    // Religa: o cursor é ancorado no instante do religar (WR-02) — nada do que
    // foi falado desligado sai ("pausa aqui", D-09), mas o 1º trecho dito
    // depois de religar ("e agora") não se perde mais.
    await patchAgenteConfig({ streamingEnabled: true });
    await sessionController.dispatch({
      type: 'CAPTION_CHUNK',
      chunk: { captionId: 'c1', speaker: 'Ana', text: 'olá tudo bem pausa aqui e agora', atMs: 1500 },
    });
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body as string)).toMatchObject({
      text: 'e agora',
    });

    // Daí em diante, só o texto realmente novo — nunca "pausa aqui".
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
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

    const [, init] = fetchMock.mock.calls[2]!;
    expect(JSON.parse(init.body as string)).toMatchObject({ text: 'sim' });
    const enviados = fetchMock.mock.calls.map(([, i]) => JSON.parse(i.body as string).text);
    expect(enviados.join(' ')).not.toContain('pausa aqui');
  });

  it('WR-11: desligar e religar dentro da janela, sem ninguém falar, não envia a fala pendente', async () => {
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
      chunk: { captionId: 'c1', speaker: 'Ana', text: 'isso é confidencial', atMs: 1100 },
    });
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await agenteStreamer.whenAgenteStreamerIdle();

    // A sequência do WR-11: desliga, ninguém fala, religa — tudo antes do silêncio bater.
    await vi.advanceTimersByTimeAsync(500);
    await patchAgenteConfig({ streamingEnabled: false });
    await vi.advanceTimersByTimeAsync(500);
    await patchAgenteConfig({ streamingEnabled: true });
    await agenteStreamer.whenAgenteStreamerIdle();

    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS + AGENTE_PHRASE_MAX_WAIT_MS);
    await agenteStreamer.whenAgenteStreamerIdle();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reinício do service worker: não reenvia texto antigo nem perde o que vem depois (WR-02)', async () => {
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
    // O módulo recarregado volta à composição de produção: reafirma a política da Fase 7 (ver fresh()).
    restartedStreamer.configureAgenteStreamer({ destination: undefined });
    await restarted.hydrate();

    await restarted.dispatch({
      type: 'CAPTION_CHUNK',
      chunk: { captionId: 'c1', speaker: 'Ana', text: 'olá tudo bem e mais isso', atMs: 1600 },
    });
    // O cursor sobreviveu ao reinício (taq:agenteStreamer, WR-02): "e mais
    // isso" sai sozinho, e "olá tudo bem" (já enviado antes) não se repete.
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body as string)).toMatchObject({
      text: 'e mais isso',
    });
    await restartedStreamer.whenAgenteStreamerIdle();

    await restarted.dispatch({
      type: 'CAPTION_CHUNK',
      chunk: { captionId: 'c1', speaker: 'Ana', text: 'olá tudo bem e mais isso ok', atMs: 1800 },
    });
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

    const [, init] = fetchMock.mock.calls[2]!;
    expect(JSON.parse(init.body as string)).toMatchObject({ text: 'ok' });
  });

  it('WR-02: fala ainda na janela quando o service worker reinicia sai depois do reinício', async () => {
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
    const firstStreamer = await import('./agenteStreamer');
    await firstStreamer.whenAgenteStreamerIdle();
    expect(fetchMock).not.toHaveBeenCalled(); // ainda na janela

    // O service worker morre com a fala na janela e renasce (boot: hydrate + resume).
    // Morrer mata os timers da instância antiga — `resetModules` sozinho não mata.
    vi.clearAllTimers();
    vi.resetModules();
    const restarted = await import('./sessionController');
    const restartedStreamer = await import('./agenteStreamer');
    // O módulo recarregado volta à composição de produção: reafirma a política da Fase 7 (ver fresh()).
    restartedStreamer.configureAgenteStreamer({ destination: undefined });
    await restarted.hydrate();
    await restartedStreamer.resumeAgenteStreamer();

    // Ninguém fala depois do reinício — o timer restaurado manda a fala sozinho.
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body as string)).toMatchObject({
      text: 'olá tudo bem',
    });
  });

  it('WR-02: com o streaming desligado, o snapshot antigo é apagado e nada é gravado a cada flush', async () => {
    const { sessionController, mock } = await fresh();
    const { patchAgenteConfig } = await import('@/shared/config/agenteConfigStore');
    vi.stubGlobal('fetch', createFetchMock());

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
    const streamer = await import('./agenteStreamer');
    await streamer.whenAgenteStreamerIdle();
    expect(mock.session.values[STORAGE_KEYS.agenteStreamer]).toBeDefined();

    await patchAgenteConfig({ streamingEnabled: false });
    await streamer.whenAgenteStreamerIdle();
    expect(mock.session.values[STORAGE_KEYS.agenteStreamer]).toBeUndefined();

    const writesBefore = mock.session.set.mock.calls.filter(
      ([items]) => STORAGE_KEYS.agenteStreamer in (items as Record<string, unknown>),
    ).length;
    for (let i = 0; i < 3; i += 1) {
      await sessionController.dispatch({
        type: 'CAPTION_CHUNK',
        chunk: { captionId: 'c1', speaker: 'Ana', text: `fala desligada ${i}`, atMs: 1100 + i * 300 },
      });
      await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    }
    await streamer.whenAgenteStreamerIdle();
    const writesAfter = mock.session.set.mock.calls.filter(
      ([items]) => STORAGE_KEYS.agenteStreamer in (items as Record<string, unknown>),
    ).length;
    expect(writesAfter).toBe(writesBefore);
    expect(mock.session.values[STORAGE_KEYS.agenteStreamer]).toBeUndefined();
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

    // Uma leitura por leitor com cache: a do streamer e a do ciclo de vida da associação (08-22). Nenhuma cresce com os flushes.
    expect(countAgenteConfigReads() - readsBeforeFlushes).toBe(2);
  });
});

describe('CR-01: reunião nova com o mesmo session_id', () => {
  const meeting = (meetingId: string, at: number, meetingCode = 'abc-defg-hij') => ({
    type: 'MEETING_DETECTED' as const,
    meetingId,
    meetingCode,
    provider: 'google-meet' as const,
    tabId: 1,
    title: 'Reunião de teste',
    captionsEnabled: true,
    at,
  });

  it('espera avisando a tela, sobrevive ao reinício, e confirmar envia a reunião nova desde o início', async () => {
    const { sessionController, mock } = await fresh();
    const { patchAgenteConfig } = await import('@/shared/config/agenteConfigStore');
    const fetchMock = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);
    await patchAgenteConfig({
      agenteBackendUrl: AGENTE_URL,
      streamingEnabled: true,
      agenteSessionId: SESSION_ID,
    });

    await sessionController.dispatch(meeting('m1', 1000));
    await sessionController.dispatch({
      type: 'CAPTION_CHUNK',
      chunk: { captionId: 'c1', speaker: 'Ana', text: 'reunião antiga', atMs: 1100 },
    });
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // A reunião termina e a pessoa volta para a MESMA sala depois da janela de
    // retomada: a máquina abre uma reunião nova (m2); a sessão do Agente é a mesma.
    await sessionController.dispatch({ type: 'MEETING_FINISHED', at: 2000 });
    await sessionController.dispatch(meeting('m2', 2000 + REJOIN_RESUME_WINDOW_MS + 1));
    await sessionController.dispatch({
      type: 'CAPTION_CHUNK',
      chunk: { captionId: 'c9', speaker: 'Bia', text: 'começo da reunião nova', atMs: 5100 },
    });
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS + AGENTE_PHRASE_MAX_WAIT_MS);
    const streamer = await import('./agenteStreamer');
    await streamer.whenAgenteStreamerIdle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.waitFor(() =>
      expect(mock.session.values[STORAGE_KEYS.agenteWaiting]).toMatchObject({ waitingMeetingId: 'm2' }),
    );

    // Reinício do service worker no meio da espera: continua esperando (antes,
    // o cursor zerado fazia a reunião nova ir direto para a sessão antiga).
    // Morrer mata timers e listeners da instância antiga — o mock não mata sozinho.
    vi.clearAllTimers();
    mock.listeners.clear();
    vi.resetModules();
    const restarted = await import('./sessionController');
    const restartedStreamer = await import('./agenteStreamer');
    // O módulo recarregado volta à composição de produção: reafirma a política da Fase 7 (ver fresh()).
    restartedStreamer.configureAgenteStreamer({ destination: undefined });
    await restarted.hydrate();
    await restartedStreamer.resumeAgenteStreamer();
    await restarted.dispatch({
      type: 'CAPTION_CHUNK',
      chunk: { captionId: 'c9', speaker: 'Bia', text: 'começo da reunião nova e mais', atMs: 5300 },
    });
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS + AGENTE_PHRASE_MAX_WAIT_MS);
    await restartedStreamer.whenAgenteStreamerIdle();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // A pessoa confirma na tela: sai a reunião nova INTEIRA, sem ninguém falar de novo.
    await patchAgenteConfig({ confirmedMeetingId: 'm2' });
    await restartedStreamer.whenAgenteStreamerIdle();
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body as string)).toMatchObject({
      session_id: SESSION_ID,
      text: 'começo da reunião nova e mais',
    });
    await vi.waitFor(() =>
      expect(mock.session.values[STORAGE_KEYS.agenteWaiting]).toMatchObject({ waitingMeetingId: null }),
    );
  });

  it('salvar o ID de uma sessão nova libera sozinho, a partir dali', async () => {
    const { sessionController, mock } = await fresh();
    const { patchAgenteConfig } = await import('@/shared/config/agenteConfigStore');
    const fetchMock = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);
    await patchAgenteConfig({
      agenteBackendUrl: AGENTE_URL,
      streamingEnabled: true,
      agenteSessionId: SESSION_ID,
    });

    await sessionController.dispatch(meeting('m1', 1000));
    await sessionController.dispatch({
      type: 'CAPTION_CHUNK',
      chunk: { captionId: 'c1', speaker: 'Ana', text: 'reunião antiga', atMs: 1100 },
    });
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // Outra sala (outro meetingCode), a sessão do Agente ainda é a antiga.
    await sessionController.dispatch(meeting('m2', 5000, 'xyz-wxyz-xyz'));
    await sessionController.dispatch({
      type: 'CAPTION_CHUNK',
      chunk: { captionId: 'c9', speaker: 'Bia', text: 'antes de trocar', atMs: 5100 },
    });
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    const streamer = await import('./agenteStreamer');
    await streamer.whenAgenteStreamerIdle();
    await vi.waitFor(() =>
      expect(mock.session.values[STORAGE_KEYS.agenteWaiting]).toMatchObject({ waitingMeetingId: 'm2' }),
    );

    await patchAgenteConfig({ agenteSessionId: OTHER_SESSION_ID });
    await streamer.whenAgenteStreamerIdle();
    await sessionController.dispatch({
      type: 'CAPTION_CHUNK',
      chunk: { captionId: 'c9', speaker: 'Bia', text: 'antes de trocar e depois', atMs: 5300 },
    });
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body as string)).toMatchObject({
      session_id: OTHER_SESSION_ID,
      text: 'e depois',
    });
    expect(mock.session.values[STORAGE_KEYS.agenteWaiting]).toMatchObject({ waitingMeetingId: null });
  });
});

/*
 * CR-01 (2ª revisão): o cursor mora em storage.session e some quando o navegador
 * fecha, a extensão é atualizada ou o toggle é desligado e religado — mas a sessão
 * do Agente (storage.local) continua salva. Sem outra memória, a reunião do cliente B
 * ia para a sessão do cliente A sem ninguém confirmar. O vínculo (`taq:agenteBinding`, WR-01)
 * é essa memória.
 */
describe('CR-01 (2ª revisão): o vínculo reunião→sessão sobrevive ao cursor', () => {
  const meeting = (meetingId: string, at: number, meetingCode = 'abc-defg-hij') => ({
    type: 'MEETING_DETECTED' as const,
    meetingId,
    meetingCode,
    provider: 'google-meet' as const,
    tabId: 1,
    title: 'Reunião de teste',
    captionsEnabled: true,
    at,
  });

  it('navegador fechado entre duas reuniões: a do dia seguinte espera, e confirmar envia desde o início', async () => {
    const { sessionController, mock } = await fresh({ realBinding: true });
    const { patchAgenteConfig } = await import('@/shared/config/agenteConfigStore');
    const { loadAgenteBinding } = await import('@/shared/config/agenteBindingStore');
    const fetchMock = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);
    await patchAgenteConfig({
      agenteBackendUrl: AGENTE_URL,
      streamingEnabled: true,
      agenteSessionId: SESSION_ID,
    });

    // Segunda-feira: reunião do cliente A (m1) enviada para a sessão S1.
    await sessionController.dispatch(meeting('m1', 1000));
    await sessionController.dispatch({
      type: 'CAPTION_CHUNK',
      chunk: { captionId: 'c1', speaker: 'Ana', text: 'cliente A', atMs: 1100 },
    });
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    // O streamer gravou a reunião a que a sessão está vinculada (só o id).
    await vi.waitFor(async () =>
      expect(await loadAgenteBinding()).toEqual({ sessionId: SESSION_ID, meetingId: 'm1' }),
    );

    // O navegador fecha: storage.session (cursor, estado, status) some; storage.local fica.
    vi.clearAllTimers();
    mock.listeners.clear();
    for (const key of Object.keys(mock.session.values)) delete mock.session.values[key];
    vi.resetModules();

    // Terça-feira: abre o Chrome e entra na reunião do cliente B (m2). A sessão salva ainda é a S1.
    const restarted = await import('./sessionController');
    const restartedStreamer = await import('./agenteStreamer');
    // O módulo recarregado volta à composição de produção: reafirma a política da Fase 7 (ver fresh()).
    restartedStreamer.configureAgenteStreamer({ destination: undefined });
    await restarted.hydrate();
    await restartedStreamer.resumeAgenteStreamer();
    await restarted.dispatch(meeting('m2', 90_000_000));
    await restarted.dispatch({
      type: 'CAPTION_CHUNK',
      chunk: { captionId: 'c1', speaker: 'Bia', text: 'fala do cliente B', atMs: 90_000_100 },
    });
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS + AGENTE_PHRASE_MAX_WAIT_MS);
    await restartedStreamer.whenAgenteStreamerIdle();

    // Nada do cliente B chegou à sessão do cliente A, e a tela foi avisada.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.waitFor(() =>
      expect(mock.session.values[STORAGE_KEYS.agenteWaiting]).toMatchObject({ waitingMeetingId: 'm2' }),
    );

    // A pessoa confirma: a reunião inteira sai, e o vínculo passa a ser a m2.
    await patchAgenteConfig({ confirmedMeetingId: 'm2' });
    await restartedStreamer.whenAgenteStreamerIdle();
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body as string)).toMatchObject({
      session_id: SESSION_ID,
      text: 'fala do cliente B',
    });
    await vi.waitFor(async () =>
      expect(await loadAgenteBinding()).toEqual({ sessionId: SESSION_ID, meetingId: 'm2' }),
    );
  });

  it('desligar, trocar de reunião e religar: espera em vez de ancorar na reunião nova e mandar para a sessão antiga', async () => {
    const { sessionController, mock } = await fresh({ realBinding: true });
    const { patchAgenteConfig } = await import('@/shared/config/agenteConfigStore');
    const streamer = await import('./agenteStreamer');
    const fetchMock = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);
    await patchAgenteConfig({
      agenteBackendUrl: AGENTE_URL,
      streamingEnabled: true,
      agenteSessionId: SESSION_ID,
    });

    await sessionController.dispatch(meeting('m1', 1000));
    await sessionController.dispatch({
      type: 'CAPTION_CHUNK',
      chunk: { captionId: 'c1', speaker: 'Ana', text: 'cliente A', atMs: 1100 },
    });
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // Desliga (o cursor é esquecido) e, com o envio desligado, a pessoa entra em outra reunião.
    await patchAgenteConfig({ streamingEnabled: false });
    await streamer.whenAgenteStreamerIdle();
    await sessionController.dispatch({ type: 'MEETING_FINISHED', at: 2000 });
    await sessionController.dispatch(
      meeting('m2', 2000 + REJOIN_RESUME_WINDOW_MS + 1, 'xyz-wxyz-xyz'),
    );
    await sessionController.dispatch({
      type: 'CAPTION_CHUNK',
      chunk: { captionId: 'c1', speaker: 'Bia', text: 'cliente B', atMs: 5100 },
    });
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await streamer.whenAgenteStreamerIdle();

    // Religa já na reunião do cliente B, e ela continua falando.
    await patchAgenteConfig({ streamingEnabled: true });
    await streamer.whenAgenteStreamerIdle();
    await sessionController.dispatch({
      type: 'CAPTION_CHUNK',
      chunk: { captionId: 'c1', speaker: 'Bia', text: 'cliente B continua falando', atMs: 5300 },
    });
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS + AGENTE_PHRASE_MAX_WAIT_MS);
    await streamer.whenAgenteStreamerIdle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.waitFor(() =>
      expect(mock.session.values[STORAGE_KEYS.agenteWaiting]).toMatchObject({ waitingMeetingId: 'm2' }),
    );

    /*
     * Decisão do time (2026-10-10), documentada aqui para não virar regressão sem querer:
     * confirmar libera a reunião DESDE O INÍCIO, inclusive o que foi dito enquanto o toggle
     * estava desligado. Quem clica em "Continuar enviando para esta sessão" está mandando a
     * reunião inteira. Se um dia isso mudar, é decisão nova do time, não ajuste de teste.
     */
    await patchAgenteConfig({ confirmedMeetingId: 'm2' });
    await streamer.whenAgenteStreamerIdle();
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body as string)).toMatchObject({
      session_id: SESSION_ID,
      text: 'cliente B continua falando',
    });
  });

  it('grava o vínculo uma vez por (sessão, reunião) e não regrava quando a config já o tem', async () => {
    const { agenteStreamer } = await fresh();
    const bindMeeting = vi.fn<(sessionId: string, meetingId: string) => Promise<void>>(() =>
      Promise.resolve(),
    );
    const fetchMock = createFetchMock();
    agenteStreamer.configureAgenteStreamer({
      loadConfig: () => Promise.resolve(READY_CONFIG),
      send: (request) => fetchMock(request.url, request.init),
      bindMeeting,
    });

    await agenteStreamer.onSessionFlushed(meetingState());
    await agenteStreamer.onSessionFlushed(meetingState());
    await agenteStreamer.onSessionFlushed(meetingState());
    expect(bindMeeting).toHaveBeenCalledTimes(1);
    expect(bindMeeting).toHaveBeenCalledWith(SESSION_ID, 'm1');

    // Vínculo salvo que já é o da própria reunião (para a sessão atual): nada a gravar.
    const already = vi.fn<(sessionId: string, meetingId: string) => Promise<void>>(() =>
      Promise.resolve(),
    );
    agenteStreamer.configureAgenteStreamer({
      loadConfig: () => Promise.resolve(READY_CONFIG),
      loadBinding: () => Promise.resolve({ sessionId: SESSION_ID, meetingId: 'm1' }),
      bindMeeting: already,
    });
    await agenteStreamer.onSessionFlushed(meetingState());
    expect(already).not.toHaveBeenCalled();
  });

  it('IN-01: gravar o vínculo não zera o resultado do envio que a tela está mostrando', async () => {
    const { sessionController, agenteStreamer, mock } = await fresh({ realBinding: true });
    const { patchAgenteConfig } = await import('@/shared/config/agenteConfigStore');
    const { loadAgenteBinding } = await import('@/shared/config/agenteBindingStore');
    vi.stubGlobal('fetch', createFetchMock());
    await patchAgenteConfig({
      agenteBackendUrl: AGENTE_URL,
      streamingEnabled: true,
      agenteSessionId: SESSION_ID,
    });
    // Um 401 antigo na tela; só o fluxo do vínculo roda daqui em diante.
    mock.session.values[STORAGE_KEYS.agenteSendOutcome] = {
      lastOutcome: 'rejected',
      lastHttpStatus: 401,
      lastAttemptAt: 1,
    };

    await sessionController.dispatch(meeting('m1', 1000));
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await agenteStreamer.whenAgenteStreamerIdle();

    await vi.waitFor(async () =>
      expect(await loadAgenteBinding()).toEqual({ sessionId: SESSION_ID, meetingId: 'm1' }),
    );
    // Antes do WR-01 a gravação do vínculo voltava como `onChanged` da config e zerava isto.
    expect(mock.session.values[STORAGE_KEYS.agenteSendOutcome]).toMatchObject({ lastOutcome: 'rejected' });
  });

  it('vínculo de OUTRA sessão não vale: a reunião é aceita e o vínculo passa a ser desta sessão', async () => {
    const { agenteStreamer } = await fresh();
    const bindMeeting = vi.fn<(sessionId: string, meetingId: string) => Promise<void>>(() =>
      Promise.resolve(),
    );
    const fetchMock = createFetchMock();
    agenteStreamer.configureAgenteStreamer({
      loadConfig: () => Promise.resolve(READY_CONFIG),
      send: (request) => fetchMock(request.url, request.init),
      // Salvo para a sessão antiga, com uma reunião diferente da atual (m1).
      loadBinding: () => Promise.resolve({ sessionId: OTHER_SESSION_ID, meetingId: 'm-antiga' }),
      bindMeeting,
    });

    await agenteStreamer.onSessionFlushed(meetingState());
    await agenteStreamer.whenAgenteStreamerIdle();

    // Sem espera por confirmação (o vínculo antigo é de outra sessão) e com vínculo novo gravado.
    expect(bindMeeting).toHaveBeenCalledWith(SESSION_ID, 'm1');
  });

  it('vínculo da sessão atual com OUTRA reunião: espera e não grava vínculo enquanto espera', async () => {
    const { agenteStreamer, mock } = await fresh();
    const bindMeeting = vi.fn<(sessionId: string, meetingId: string) => Promise<void>>(() =>
      Promise.resolve(),
    );
    agenteStreamer.configureAgenteStreamer({
      loadConfig: () => Promise.resolve(READY_CONFIG),
      loadBinding: () => Promise.resolve({ sessionId: SESSION_ID, meetingId: 'm-antiga' }),
      bindMeeting,
    });

    await agenteStreamer.onSessionFlushed(meetingState());
    await agenteStreamer.whenAgenteStreamerIdle();

    expect(bindMeeting).not.toHaveBeenCalled();
    await vi.waitFor(() =>
      expect(mock.session.values[STORAGE_KEYS.agenteWaiting]).toMatchObject({ waitingMeetingId: 'm1' }),
    );
  });

  it('se gravar o vínculo falhar, o envio continua e a próxima passada tenta de novo', async () => {
    const { agenteStreamer } = await fresh();
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const bindMeeting = vi
      .fn<(sessionId: string, meetingId: string) => Promise<void>>()
      .mockRejectedValueOnce(new Error('storage cheio'))
      .mockResolvedValue(undefined);
    agenteStreamer.configureAgenteStreamer({
      loadConfig: () => Promise.resolve(READY_CONFIG),
      bindMeeting,
    });

    await agenteStreamer.onSessionFlushed(meetingState());
    await agenteStreamer.onSessionFlushed(meetingState());
    expect(bindMeeting).toHaveBeenCalledTimes(2);
    errorLog.mockRestore();
  });
});

/*
 * WR-04 (2ª revisão, decisão do time: opção 2-B — aceitar a perda, mas a tela não mente).
 * A fila de reenvio vive só na memória do service worker. Quando ele reinicia, o último
 * status gravado em storage.session pode ser "tentando de novo…" sem nenhuma tentativa
 * rodando. No boot, esse status passa a dizer a verdade: o envio foi interrompido.
 */
describe('WR-04: status "tentando de novo" não sobrevive ao reinício do service worker', () => {
  const STALE_RETRYING = { lastOutcome: 'retrying', lastHttpStatus: null, lastAttemptAt: 1 };

  it('no boot, "retrying" vira "interrupted" e o resto do status é preservado', async () => {
    const { agenteStreamer, mock } = await fresh();
    mock.session.values[STORAGE_KEYS.agenteSendOutcome] = { ...STALE_RETRYING, lastHttpStatus: 503 };

    await agenteStreamer.resumeAgenteStreamer();
    await agenteStreamer.whenAgenteStreamerIdle();

    expect(mock.session.values[STORAGE_KEYS.agenteSendOutcome]).toMatchObject({
      lastOutcome: 'interrupted',
      lastHttpStatus: 503,
      lastAttemptAt: 1,
    });
  });

  it.each(['sent', 'failed', 'rejected', 'interrupted'])(
    'no boot, um status "%s" já definitivo não é mexido',
    async (lastOutcome) => {
      const { agenteStreamer, mock } = await fresh();
      const before = { lastOutcome, lastHttpStatus: 401, lastAttemptAt: 7 };
      mock.session.values[STORAGE_KEYS.agenteSendOutcome] = { ...before };

      await agenteStreamer.resumeAgenteStreamer();
      await agenteStreamer.whenAgenteStreamerIdle();

      expect(mock.session.values[STORAGE_KEYS.agenteSendOutcome]).toMatchObject(before);
    },
  );

  it('sem status gravado, o boot não cria um', async () => {
    const { agenteStreamer, mock } = await fresh();

    await agenteStreamer.resumeAgenteStreamer();
    await agenteStreamer.whenAgenteStreamerIdle();

    expect(mock.session.values[STORAGE_KEYS.agenteSendOutcome]).toBeUndefined();
  });

  it('um envio novo depois do boot volta a mandar o status real (não fica preso em "interrupted")', async () => {
    const { sessionController, agenteStreamer, mock } = await fresh();
    const fetchMock = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);
    mock.session.values[STORAGE_KEYS.agenteSendOutcome] = { ...STALE_RETRYING };
    agenteStreamer.configureAgenteStreamer({ loadConfig: () => Promise.resolve(READY_CONFIG) });

    await agenteStreamer.resumeAgenteStreamer();
    await agenteStreamer.whenAgenteStreamerIdle();
    expect(mock.session.values[STORAGE_KEYS.agenteSendOutcome]).toMatchObject({ lastOutcome: 'interrupted' });

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
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await sessionController.dispatch({
      type: 'CAPTION_CHUNK',
      chunk: { captionId: 'c1', speaker: 'Ana', text: 'depois do boot', atMs: 1100 },
    });
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await vi.waitFor(() =>
      expect(mock.session.values[STORAGE_KEYS.agenteSendOutcome]).toMatchObject({ lastOutcome: 'sent' }),
    );
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
      chunk_id: expect.stringMatching(UUID_PATTERN),
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

  it('IN-11: fala acumulada com a URL A é descartada se a config mudar para a URL B (e a chave de B) antes do corte — a chave nunca vai para A', async () => {
    const { sessionController, agenteStreamer } = await fresh();
    const fetchMock = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
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
      chunk: { captionId: 'c1', speaker: 'Ana', text: 'fala do backend antigo', atMs: 1100 },
    });
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await agenteStreamer.onSessionFlushed(sessionController.getState());
    expect(fetchMock).not.toHaveBeenCalled();

    // Troca de backend: a URL e a chave mudam juntas; o session_id continua o mesmo.
    currentConfig = { ...currentConfig, agenteBackendUrl: OTHER_URL, agenteApiKey: 'chave-do-backend-b' };
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);

    // Nada sai: mandar a fala para A levaria a chave de B; mandar para B
    // quebraria o D-04 (o texto acumulado sob um destino só vai para ele).
    expect(fetchMock).not.toHaveBeenCalled();

    // IN-04: o descarte deixa rastro no log — só a contagem, nunca o texto da fala.
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).toContain('"discarded":1');
    expect(logged).not.toContain('fala do backend antigo');
    warn.mockRestore();
  });

  it('IN-01: snapshot antigo (fala pendente sem URL) é descartado na restauração — nada sai para a URL atual', async () => {
    const { agenteStreamer, mock } = await fresh();
    const fetchMock = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    agenteStreamer.configureAgenteStreamer({ loadConfig: () => Promise.resolve(READY_CONFIG) });

    // Formato gravado antes do IN-11: a fala pendente não carrega o backendUrl.
    const now = Date.now();
    mock.session.values[STORAGE_KEYS.agenteStreamer] = {
      cursor: null,
      pending: [
        { sessionId: SESSION_ID, segmentKey: '0:c1', speaker: 'Ana', text: 'fala do snapshot antigo', firstAt: now, lastAt: now },
      ],
    };

    await agenteStreamer.resumeAgenteStreamer();
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await agenteStreamer.whenAgenteStreamerIdle();

    expect(fetchMock).not.toHaveBeenCalled();
    // IN-04: o descarte deixa rastro — só a contagem, nunca o texto da fala.
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).toContain('"discarded":1');
    expect(logged).not.toContain('fala do snapshot antigo');
    warn.mockRestore();
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
