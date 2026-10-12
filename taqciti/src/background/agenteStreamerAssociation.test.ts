/**
 * Teste ponta a ponta do tracer da Fase 8 (plano 08-01, TAQ-02, D-01/D-04/D-12): dispatch REAL da
 * máquina de estados -> flush do sessionController -> streamer COMPOSTO COMO EM PRODUÇÃO (a política
 * de destino é a da associação, nunca sobrescrita aqui) -> store de associação no storage simulado
 * -> `fetch`. Prova que o vínculo da reunião decide o destino: sem associação `linked` nada sai,
 * mesmo com um ID salvo na config; com ela, tudo vai para `association.sessionId`.
 *
 * Mesma convenção de tempo do `agenteStreamer.test.ts` da Fase 7: todo envio avança o flush de
 * 250 ms e a janela de silêncio da fala; toda ausência drena a fila antes de afirmar (WR-09).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeStorageMock } from '@/test/chromeStorageMock';
import { STATE_FLUSH_INTERVAL_MS, STORAGE_KEYS } from '@/shared/config/constants';
import { AGENTE_PHRASE_QUIET_MS, type AgenteConfig } from '@/shared/config/agenteConfig';
import { segmentKey, splitWords } from '@/features/agente/wordDelta';
import type { AssociationEvent } from '@/features/agente/association';
import type { MeetingEvent } from '@/features/meeting/machine';

/* https:// porque `isValidAgenteBackendUrl` só aceita http: em loopback (WR-06). */
const AGENTE_URL = 'https://agente.test';
const SESSION_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_SESSION_ID = '22222222-2222-2222-2222-222222222222';

const READY_CONFIG: AgenteConfig = {
  agenteBackendUrl: AGENTE_URL,
  streamingEnabled: true,
  agenteSessionId: SESSION_ID,
  agenteApiKey: 's3cr3t',
  confirmedMeetingId: '',
};

function detected(meetingId: string): MeetingEvent {
  return {
    type: 'MEETING_DETECTED',
    meetingId,
    meetingCode: 'abc-defg-hij',
    provider: 'google-meet',
    tabId: 1,
    title: 'Reunião de teste',
    captionsEnabled: true,
    at: 1000,
  };
}

function caption(text: string, atMs = 1100): MeetingEvent {
  return { type: 'CAPTION_CHUNK', chunk: { captionId: 'c1', speaker: 'Ana', text, atMs } };
}

function createFetchMock() {
  return vi.fn<(input: string, init: RequestInit) => Promise<Response>>(() =>
    Promise.resolve({ ok: true, status: 202 } as Response),
  );
}

/** Corpo JSON do envio de número `index` (0 = primeiro). */
function bodyOf(fetchMock: ReturnType<typeof createFetchMock>, index: number) {
  return JSON.parse(fetchMock.mock.calls[index]![1].body as string) as {
    session_id: string;
    text: string;
  };
}

async function fresh(options: { local?: Record<string, unknown>; config?: () => AgenteConfig } = {}) {
  const mock = installChromeStorageMock({
    local: options.local,
    extra: {
      runtime: { sendMessage: vi.fn(() => Promise.resolve()) },
      tabs: { sendMessage: vi.fn(() => Promise.resolve()) },
    },
  });
  const sessionController = await import('./sessionController');
  const agenteStreamer = await import('./agenteStreamer');
  const store = await import('@/shared/config/agenteAssociationStore');
  const currentConfig = options.config ?? (() => READY_CONFIG);
  // Só a config é trocada: `destination` (a política de produção) e o vínculo CR-01 ficam reais.
  agenteStreamer.configureAgenteStreamer({ loadConfig: () => Promise.resolve(currentConfig()) });
  const fetchMock = createFetchMock();
  vi.stubGlobal('fetch', fetchMock);

  const apply = (meetingId: string, event: AssociationEvent) =>
    store.applyAssociationEvent(meetingId, event);
  /** created -> link-started -> link-completed: a reunião fica `linked` para `sessionId`. */
  async function link(
    meetingId: string,
    sessionId: string,
    origin: 'picker' | 'manual-id',
    seedSent: Record<string, number> = {},
  ) {
    await apply(meetingId, { type: 'created' });
    await apply(meetingId, { type: 'link-started', origin, clientName: 'ACME', sessionId });
    await apply(meetingId, { type: 'link-completed', seedSent });
  }
  /** Passa o flush de 250 ms e a janela de silêncio da fala. */
  async function letPhraseOut() {
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await agenteStreamer.whenAgenteStreamerIdle();
  }
  /** Contagem de palavras de cada segmento ao vivo agora (a semente de um vínculo feito neste instante). */
  function seedNow(): Record<string, number> {
    const seed: Record<string, number> = {};
    sessionController.getState().session?.segments.forEach((segment, index) => {
      seed[segmentKey(segment, index)] = splitWords(segment.text).length;
    });
    return seed;
  }
  const rawAssociations = () => mock.local.values[STORAGE_KEYS.agenteAssociations];
  return { sessionController, agenteStreamer, store, fetchMock, mock, link, apply, letPhraseOut, seedNow, rawAssociations };
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('sem associação linked nada sai (SC3, D-01, D-04)', () => {
  it('reunião sem associação: o ID salvo na config não envia nada', async () => {
    const { sessionController, letPhraseOut, fetchMock } = await fresh();
    await sessionController.dispatch(detected('m1'));
    await sessionController.dispatch(caption('olá tudo bem'));
    await letPhraseOut();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('associação só criada (pending): nada sai', async () => {
    const { sessionController, apply, letPhraseOut, fetchMock } = await fresh();
    await sessionController.dispatch(detected('m1'));
    await apply('m1', { type: 'created' });
    await sessionController.dispatch(caption('olá tudo bem'));
    await letPhraseOut();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['manual-id', 'picker'] as const)(
    'linked (%s): a fala vai para a sessão da associação, nunca para a da config',
    async (origin) => {
      const { sessionController, link, letPhraseOut, fetchMock } = await fresh();
      await sessionController.dispatch(detected('m1'));
      await link('m1', OTHER_SESSION_ID, origin);
      await sessionController.dispatch(caption('olá tudo bem'));
      await letPhraseOut();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(bodyOf(fetchMock, 0)).toMatchObject({ session_id: OTHER_SESSION_ID, text: 'olá tudo bem' });
    },
  );

  it('o JSON cru de taq:agenteAssociations nunca contém a chave da config', async () => {
    const { sessionController, link, letPhraseOut, rawAssociations } = await fresh();
    await sessionController.dispatch(detected('m1'));
    await link('m1', OTHER_SESSION_ID, 'picker');
    await sessionController.dispatch(caption('olá tudo bem'));
    await letPhraseOut();
    expect(rawAssociations()).toBeDefined();
    expect(JSON.stringify(rawAssociations())).not.toContain('s3cr3t');
  });
});

describe('vínculo em andamento e semente (linking -> linked)', () => {
  it('linking segura o envio; ao virar linked só sai o que passa da semente, que é consumida', async () => {
    const { sessionController, apply, seedNow, letPhraseOut, fetchMock, rawAssociations } = await fresh();
    await sessionController.dispatch(detected('m1'));
    await apply('m1', { type: 'created' });
    await apply('m1', { type: 'link-started', origin: 'manual-id', clientName: 'ACME', sessionId: OTHER_SESSION_ID });

    await sessionController.dispatch(caption('olá tudo bem'));
    await letPhraseOut();
    expect(fetchMock).not.toHaveBeenCalled(); // linking = hold

    await apply('m1', { type: 'link-completed', seedSent: seedNow() });
    await sessionController.dispatch(caption('olá tudo bem como vai'));
    await letPhraseOut();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(bodyOf(fetchMock, 0)).toMatchObject({ session_id: OTHER_SESSION_ID, text: 'como vai' });
    const stored = rawAssociations() as Record<string, Record<string, unknown>>;
    expect(stored.m1).toMatchObject({ state: 'linked', sessionId: OTHER_SESSION_ID });
    expect(stored.m1).not.toHaveProperty('seedSent');
  });

  it('semente vazia ({}): vínculo feito com 0 segmentos manda tudo desde o início', async () => {
    const { sessionController, link, letPhraseOut, fetchMock, rawAssociations } = await fresh();
    await sessionController.dispatch(detected('m1'));
    await link('m1', OTHER_SESSION_ID, 'picker', {});
    await sessionController.dispatch(caption('primeira fala inteira'));
    await letPhraseOut();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(bodyOf(fetchMock, 0).text).toBe('primeira fala inteira');
    const stored = rawAssociations() as Record<string, Record<string, unknown>>;
    expect(stored.m1).not.toHaveProperty('seedSent');
  });

  it('reunião terminou durante o vínculo e nenhum flush veio depois: reevaluate manda o resto uma vez', async () => {
    const { sessionController, agenteStreamer, apply, seedNow, letPhraseOut, fetchMock } = await fresh();
    await sessionController.dispatch(detected('m1'));
    await apply('m1', { type: 'created' });
    await apply('m1', { type: 'link-started', origin: 'manual-id', clientName: 'ACME', sessionId: OTHER_SESSION_ID });

    await sessionController.dispatch(caption('olá tudo bem'));
    await letPhraseOut();
    const snapshot = seedNow();
    await sessionController.dispatch(caption('olá tudo bem como vai você'));
    await letPhraseOut();
    await sessionController.dispatch({ type: 'MEETING_FINISHED', at: 5000 });
    await agenteStreamer.whenAgenteStreamerIdle();
    expect(fetchMock).not.toHaveBeenCalled();

    await apply('m1', { type: 'link-completed', seedSent: snapshot });
    await agenteStreamer.reevaluateAgenteStreamer();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(bodyOf(fetchMock, 0)).toMatchObject({ session_id: OTHER_SESSION_ID, text: 'como vai você' });

    await agenteStreamer.reevaluateAgenteStreamer(); // segundo passo: nada novo para mandar
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await agenteStreamer.whenAgenteStreamerIdle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('idle e disabled (D-09 da Fase 7 preservado)', () => {
  it('reunião nova sem vínculo (idle) não cancela a fala já endereçada da reunião anterior', async () => {
    const { sessionController, link, fetchMock, agenteStreamer } = await fresh();
    await sessionController.dispatch(detected('m1'));
    await link('m1', OTHER_SESSION_ID, 'picker');
    await sessionController.dispatch(caption('fala pendente da primeira'));
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS); // a fala entra na janela
    await agenteStreamer.whenAgenteStreamerIdle();
    expect(fetchMock).not.toHaveBeenCalled();

    await sessionController.dispatch(detected('m2')); // sem associação: idle
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await agenteStreamer.whenAgenteStreamerIdle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(bodyOf(fetchMock, 0)).toMatchObject({
      session_id: OTHER_SESSION_ID,
      text: 'fala pendente da primeira',
    });
  });

  it('desligar o toggle descarta o que estava pendente (disabled)', async () => {
    let config = READY_CONFIG;
    const { sessionController, link, fetchMock, agenteStreamer } = await fresh({ config: () => config });
    await sessionController.dispatch(detected('m1'));
    await link('m1', OTHER_SESSION_ID, 'picker');
    await sessionController.dispatch(caption('isso é confidencial'));
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await agenteStreamer.whenAgenteStreamerIdle();

    config = { ...READY_CONFIG, streamingEnabled: false };
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await agenteStreamer.whenAgenteStreamerIdle();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('o vínculo CR-01 da Fase 7 não manda em destino de associação', () => {
  it('sessão colada que o CR-01 ligava a outra reunião recebe a fala sem espera e sem regravar o vínculo', async () => {
    const oldBinding = { sessionId: OTHER_SESSION_ID, meetingId: 'reuniao-antiga' };
    const { sessionController, link, letPhraseOut, fetchMock, mock } = await fresh({
      local: { [STORAGE_KEYS.agenteBinding]: oldBinding },
    });
    await sessionController.dispatch(detected('m1'));
    await link('m1', OTHER_SESSION_ID, 'manual-id');
    await sessionController.dispatch(caption('olá tudo bem'));
    await letPhraseOut();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(bodyOf(fetchMock, 0)).toMatchObject({ session_id: OTHER_SESSION_ID, text: 'olá tudo bem' });
    expect(mock.local.values[STORAGE_KEYS.agenteBinding]).toEqual(oldBinding);
  });
});
