/**
 * Prova do D-11 (WR-04) na COMPOSIÇÃO DE PRODUÇÃO do feed do painel AGP: o `agpQuestionsFeedInstance.ts` real
 * (sessionController, store de associações e leitor de config reais sobre o storage simulado; só o `WebSocket`
 * global é falso e nunca toca a rede) decide pela fase da reunião e pelo `streamingEnabled` se abre o socket,
 * se o fecha mantendo as perguntas (`paused`) ou se limpa o feed. Conectar no `/ws` cria o pipeline de IA do
 * backend, então "abrir fora de gravando + vínculo + envio ligado" é o erro que este arquivo existe para barrar.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { transition, type MeetingEvent } from '@/features/meeting/machine';
import { EMPTY_AGP_FEED } from '@/shared/config/agpQuestionsStore';
import { STORAGE_KEYS } from '@/shared/config/constants';
import { IDLE_STATE, type MeetingState } from '@/shared/types/domain';
import { installChromeStorageMock } from '@/test/chromeStorageMock';

// Os imports dinâmicos do `sessionController` carregam muitos módulos: com a suíte inteira rodando em máquina carregada
// o prazo padrão de 5 s pode estourar sem que nada esteja errado.
vi.setConfig({ testTimeout: 30_000 });

const SESSION_ID = '11111111-1111-1111-1111-111111111111';
const MEETING_ID = 'm1';
const BACKEND = 'http://127.0.0.1:8000';
const SOCKET_URL = `ws://127.0.0.1:8000/ws/${SESSION_ID}`;

const detected = (captionsEnabled: boolean): MeetingEvent => ({
  type: 'MEETING_DETECTED',
  meetingId: MEETING_ID,
  meetingCode: 'abc-defg-hij',
  provider: 'google-meet',
  tabId: 1,
  title: 'Reunião de teste',
  captionsEnabled,
  at: 1000,
});

// Estados reais da máquina da reunião (não objetos montados à mão): só a fase muda entre eles.
const RECORDING = transition(IDLE_STATE, detected(true));
const PAUSED = transition(RECORDING, { type: 'PAUSE' });
const CAPTIONS_REQUIRED = transition(IDLE_STATE, detected(false));
const ENDED = transition(RECORDING, { type: 'MEETING_FINISHED', at: 9000 });

/** O `WebSocket` do navegador, falso: guarda cada instância e nunca abre rede. */
class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  closed = false;
  readonly send = vi.fn();
  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }
  close() {
    this.closed = true;
  }
  receive(event: string, data: unknown) {
    this.onmessage?.({ data: JSON.stringify({ event, data }) });
  }
}

const QUESTION = { id: 'qa', text: 'Qual o gargalo?', block: 'negocio', status: 'queued', lens: 'dados' };

async function fresh(
  initial: MeetingState,
  options: { linked?: boolean; streaming?: boolean; backendUrl?: string } = {},
) {
  const { linked = true, streaming = true, backendUrl = BACKEND } = options;
  const mock = installChromeStorageMock({
    session: { [STORAGE_KEYS.state]: initial },
    extra: {
      runtime: { sendMessage: vi.fn(() => Promise.resolve()) },
      tabs: { sendMessage: vi.fn(() => Promise.resolve()) },
    },
  });
  const controller = await import('./sessionController');
  const associations = await import('@/shared/config/agenteAssociationStore');
  const { patchAgenteConfig } = await import('@/shared/config/agenteConfigStore');
  const { loadAgpFeed } = await import('@/shared/config/agpQuestionsStore');
  const { agpQuestionsFeed } = await import('./agpQuestionsFeedInstance');

  await controller.hydrate();
  if (linked) {
    await associations.applyAssociationEvent(MEETING_ID, { type: 'created' });
    await associations.applyAssociationEvent(MEETING_ID, {
      type: 'link-started',
      origin: 'picker',
      clientName: 'ACME',
      sessionId: SESSION_ID,
    });
    await associations.applyAssociationEvent(MEETING_ID, { type: 'link-completed', seedSent: {} });
  }
  await patchAgenteConfig({ streamingEnabled: streaming, agenteBackendUrl: backendUrl });

  return {
    reconcile: () => agpQuestionsFeed.reconcile(),
    feed: loadAgpFeed,
    setConfig: patchAgenteConfig,
    /** Troca a fase como o service worker a vê: grava o `taq:state` novo e reidrata o `sessionController`. */
    setState: async (state: MeetingState) => {
      await mock.session.set({ [STORAGE_KEYS.state]: state });
      await controller.hydrate();
    },
  };
}

const urls = () => FakeWebSocket.instances.map((socket) => socket.url);
const noSends = () => FakeWebSocket.instances.every((socket) => socket.send.mock.calls.length === 0);

beforeEach(() => {
  vi.resetModules();
  FakeWebSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeWebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it('os estados de partida são as fases certas da máquina', () => {
  expect([RECORDING, PAUSED, CAPTIONS_REQUIRED, ENDED].map((state) => state.phase)).toEqual([
    'recording',
    'paused',
    'captionsRequired',
    'ended',
  ]);
});

describe('gravando + vínculo explícito + envio ligado: abre', () => {
  it('abre exatamente 1 socket, com a URL do backend e a sessão da associação, e nunca manda nada', async () => {
    const t = await fresh(RECORDING);
    await t.reconcile();
    expect(urls()).toEqual([SOCKET_URL]);
    await t.reconcile();
    expect(urls()).toEqual([SOCKET_URL]);
    expect(noSends()).toBe(true);
  });
});

describe('envio desligado, pausa ou sem legendas: fecha, mantém as perguntas e não abre outro', () => {
  async function recordingWithQuestion() {
    const t = await fresh(RECORDING);
    await t.reconcile();
    const socket = FakeWebSocket.instances[0] as FakeWebSocket;
    socket.onopen?.();
    socket.receive('initial_state', { questions: [QUESTION] });
    await t.reconcile();
    expect(await t.feed()).toMatchObject({ sessionId: SESSION_ID, connection: 'live' });
    return { t, socket };
  }

  const kept = [{ id: 'qa', text: 'Qual o gargalo?', block: 'negocio', lens: 'dados', status: 'queued' }];

  it('envio desligado: o socket fecha, nenhum novo abre e a lista fica como paused; ligar de novo abre um NOVO', async () => {
    const { t, socket } = await recordingWithQuestion();
    await t.setConfig({ streamingEnabled: false });
    await t.reconcile();
    expect(socket.closed).toBe(true);
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(await t.feed()).toEqual({ sessionId: SESSION_ID, connection: 'paused', questions: kept });
    await t.setConfig({ streamingEnabled: true });
    await t.reconcile();
    expect(urls()).toEqual([SOCKET_URL, SOCKET_URL]);
    expect(FakeWebSocket.instances[1]?.closed).toBe(false);
    expect(noSends()).toBe(true);
  });

  it.each([
    ['paused', PAUSED],
    ['captionsRequired', CAPTIONS_REQUIRED],
  ])('fase %s (com o envio ligado): fecha o socket, nenhum novo, paused com a lista mantida', async (_phase, state) => {
    const { t, socket } = await recordingWithQuestion();
    await t.setState(state);
    await t.reconcile();
    expect(socket.closed).toBe(true);
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(await t.feed()).toEqual({ sessionId: SESSION_ID, connection: 'paused', questions: kept });
  });

  it('voltar a gravar depois da pausa abre um socket novo', async () => {
    const { t } = await recordingWithQuestion();
    await t.setState(PAUSED);
    await t.reconcile();
    await t.setState(RECORDING);
    await t.reconcile();
    expect(urls()).toEqual([SOCKET_URL, SOCKET_URL]);
  });
});

describe('nada a seguir: nenhum socket e o feed volta ao vazio', () => {
  it('reunião encerrada desde o começo: nenhum socket, EMPTY_AGP_FEED', async () => {
    const t = await fresh(ENDED);
    await t.reconcile();
    expect(FakeWebSocket.instances).toHaveLength(0);
    expect(await t.feed()).toEqual(EMPTY_AGP_FEED);
    await t.setState(RECORDING); // controle: só a fase impedia
    await t.reconcile();
    expect(urls()).toEqual([SOCKET_URL]);
  });

  it('a reunião encerra no meio da call: o socket fecha e o feed limpa', async () => {
    const t = await fresh(RECORDING);
    await t.reconcile();
    await t.setState(ENDED);
    await t.reconcile();
    expect(FakeWebSocket.instances[0]?.closed).toBe(true);
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(await t.feed()).toEqual(EMPTY_AGP_FEED);
  });

  it('sem vínculo explícito: nenhum socket, EMPTY_AGP_FEED', async () => {
    const t = await fresh(RECORDING, { linked: false });
    await t.reconcile();
    expect(FakeWebSocket.instances).toHaveLength(0);
    expect(await t.feed()).toEqual(EMPTY_AGP_FEED);
  });

  it('URL do backend inválida (http em host remoto): nenhum socket, EMPTY_AGP_FEED', async () => {
    const t = await fresh(RECORDING, { backendUrl: 'http://exemplo.com' });
    await t.reconcile();
    expect(FakeWebSocket.instances).toHaveLength(0);
    expect(await t.feed()).toEqual(EMPTY_AGP_FEED);
    await t.setConfig({ agenteBackendUrl: BACKEND }); // controle: só a URL impedia
    await t.reconcile();
    expect(urls()).toEqual([SOCKET_URL]);
  });
});
