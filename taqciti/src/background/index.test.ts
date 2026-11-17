/**
 * Caracterização do entry point do service worker (Fase 10, plano 10-08, D-05).
 *
 * Esta é a "foto" do `index.ts` tirada ANTES de dividi-lo em bootstrap / listeners do navegador /
 * roteador de mensagens. Nenhum outro teste importa o `index.ts`, então "a suíte continua verde" não
 * provaria nada sobre a ligação do worker. Aqui se prova:
 *   1. os 7 listeners do Chrome e o feed AGP são registrados de forma SÍNCRONA, com o `ready` ainda
 *      pendente — no MV3, listener registrado tarde é worker que acorda sem handler;
 *   2. a cadeia `ready` mantém a ordem (migrar → hidratar → streamer → recuperar → recuperar vínculos →
 *      relançar → varrer encerramento → preferências);
 *   3. a tabela "tipo de mensagem → porta chamada" do roteador e o efeito de cada listener do navegador.
 *
 * ESTE ARQUIVO NÃO PODE SER EDITADO NO COMMIT DA DIVISÃO: ele passa sem retoque antes e depois do corte.
 *
 * Só as PORTAS (módulos de regra e de estado) são simuladas, por caminho de módulo. O wrapper `onMessage`
 * com o esquema zod e o `chrome` simulado são os de verdade — por isso as mensagens abaixo são válidas
 * segundo `src/shared/types/messages.ts`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { PROVIDER_GOOGLE_MEET } from '@/shared/config/constants';
import { installChromeStorageMock } from '@/test/chromeStorageMock';

const IDLE = { phase: 'idle', session: null };
const DISPATCHED = { phase: 'paused', session: null };
const MEETING_CODE = 'abc-defg-hij';
const SESSION_UUID = '11111111-1111-1111-1111-111111111111';
const TAB_ID = 7;

const ASSOCIATION_COMMANDS = ['listClients', 'open', 'defer', 'bind', 'discard', 'resumeSend'] as const;

/** Criadas uma única vez e antes dos imports (o `vi.mock` é içado); reconfiguradas a cada teste. */
const ports = vi.hoisted(() => ({
  dispatch: vi.fn(),
  getState: vi.fn(),
  hydrate: vi.fn(),
  recoverInterruptedMeetings: vi.fn(),
  deleteRecord: vi.fn(),
  patchRecord: vi.fn(),
  bumpMetrics: vi.fn(),
  migrateLocalStorage: vi.fn(),
  backfillOpenTabs: vi.fn(),
  canInject: vi.fn(),
  ensurePanelInTab: vi.fn(),
  openWideView: vi.fn(),
  forgetPanelTab: vi.fn(),
  rememberPanelTab: vi.fn(),
  onMeetingTabRemoved: vi.fn(),
  onMeetingEndedInTab: vi.fn(),
  onMeetingTabNavigated: vi.fn(),
  findOtherRoomTab: vi.fn(),
  markTabJoinedCall: vi.fn(),
  markTabLeftCall: vi.fn(),
  noteTabCaptionActivity: vi.fn(),
  noteTabUrlChanged: vi.fn(),
  resumeAgenteStreamer: vi.fn(),
  isMeetingLive: vi.fn(),
  recoverAssociationsAfterRestart: vi.fn(),
  releaseMeetingAssociation: vi.fn(),
  shouldStartFreshMeeting: vi.fn(),
  registerAgpQuestionsFeed: vi.fn(),
  configureAgenteSessionFinisher: vi.fn(),
  ensurePanelPrefs: vi.fn(),
  patchPanelPrefs: vi.fn(),
  association: {
    listClients: vi.fn(),
    open: vi.fn(),
    defer: vi.fn(),
    bind: vi.fn(),
    discard: vi.fn(),
    resumeSend: vi.fn(),
    resumeLiveLinksAfterRestart: vi.fn(),
  },
  finisher: { restartGaveUpRounds: vi.fn(), handleAlarm: vi.fn(), rescheduleAfterRestart: vi.fn() },
}));

vi.mock('./sessionController', () => ({
  dispatch: ports.dispatch,
  getState: ports.getState,
  hydrate: ports.hydrate,
  recoverInterruptedMeetings: ports.recoverInterruptedMeetings,
}));
vi.mock('./history', () => ({ deleteRecord: ports.deleteRecord, patchRecord: ports.patchRecord }));
vi.mock('./metrics', () => ({ bumpMetrics: ports.bumpMetrics }));
vi.mock('./storageMigrations', () => ({ migrateLocalStorage: ports.migrateLocalStorage }));
vi.mock('./injectPanel', () => ({
  backfillOpenTabs: ports.backfillOpenTabs,
  canInject: ports.canInject,
  ensurePanelInTab: ports.ensurePanelInTab,
}));
vi.mock('./sidePanel', () => ({ openWideView: ports.openWideView }));
vi.mock('./panelTabs', () => ({
  forgetPanelTab: ports.forgetPanelTab,
  rememberPanelTab: ports.rememberPanelTab,
}));
vi.mock('./meetingTabClosed', () => ({ onMeetingTabRemoved: ports.onMeetingTabRemoved }));
vi.mock('./meetingEndedInTab', () => ({ onMeetingEndedInTab: ports.onMeetingEndedInTab }));
vi.mock('./meetingTabNavigated', () => ({ onMeetingTabNavigated: ports.onMeetingTabNavigated }));
vi.mock('./meetingRoomTabs', () => ({
  findOtherRoomTab: ports.findOtherRoomTab,
  markTabJoinedCall: ports.markTabJoinedCall,
  markTabLeftCall: ports.markTabLeftCall,
  noteTabCaptionActivity: ports.noteTabCaptionActivity,
  noteTabUrlChanged: ports.noteTabUrlChanged,
}));
vi.mock('./agenteAssociation', () => ({ agenteAssociation: ports.association }));
vi.mock('./agenteStreamer', () => ({ resumeAgenteStreamer: ports.resumeAgenteStreamer }));
vi.mock('./agenteAssociationLifecycle', () => ({
  isMeetingLive: ports.isMeetingLive,
  recoverAssociationsAfterRestart: ports.recoverAssociationsAfterRestart,
}));
vi.mock('./agenteAssociationRelease', () => ({
  releaseMeetingAssociation: ports.releaseMeetingAssociation,
}));
vi.mock('./agenteSessionFinisher', () => ({
  agenteSessionFinisher: ports.finisher,
  configureAgenteSessionFinisher: ports.configureAgenteSessionFinisher,
}));
vi.mock('./agenteFreshStart', () => ({ shouldStartFreshMeeting: ports.shouldStartFreshMeeting }));
vi.mock('./agpQuestionsFeedInstance', () => ({
  registerAgpQuestionsFeed: ports.registerAgpQuestionsFeed,
}));
vi.mock('@/features/panel/prefsStore', () => ({
  ensurePanelPrefs: ports.ensurePanelPrefs,
  patchPanelPrefs: ports.patchPanelPrefs,
}));

type Listener = (...args: unknown[]) => unknown;

function eventStub() {
  return { addListener: vi.fn(), removeListener: vi.fn() };
}

type Events = ReturnType<typeof installEvents>;

/** `chrome` simulado com os 7 eventos que o service worker assina; cada `addListener` só registra. */
function installEvents() {
  const events = {
    onInstalled: eventStub(),
    onStartup: eventStub(),
    onMessage: eventStub(),
    onClicked: eventStub(),
    onRemoved: eventStub(),
    onUpdated: eventStub(),
    onAlarm: eventStub(),
  };
  installChromeStorageMock({
    extra: {
      runtime: {
        onInstalled: events.onInstalled,
        onStartup: events.onStartup,
        onMessage: events.onMessage,
      },
      action: { onClicked: events.onClicked },
      tabs: { onRemoved: events.onRemoved, onUpdated: events.onUpdated },
      alarms: { create: vi.fn(), clear: vi.fn(), get: vi.fn(), onAlarm: events.onAlarm },
    },
  });
  return events;
}

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

let events: Events;
let consoleError: MockInstance;

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);

  ports.getState.mockReturnValue(IDLE);
  ports.dispatch.mockResolvedValue(DISPATCHED);
  for (const port of [
    ports.hydrate,
    ports.recoverInterruptedMeetings,
    ports.recoverAssociationsAfterRestart,
    ports.resumeAgenteStreamer,
    ports.ensurePanelPrefs,
    ports.patchPanelPrefs,
    ports.ensurePanelInTab,
    ports.forgetPanelTab,
    ports.rememberPanelTab,
    ports.onMeetingTabRemoved,
    ports.onMeetingEndedInTab,
    ports.onMeetingTabNavigated,
    ports.bumpMetrics,
    ports.deleteRecord,
    ports.patchRecord,
    ports.releaseMeetingAssociation,
    ports.association.resumeLiveLinksAfterRestart,
    ports.finisher.restartGaveUpRounds,
    ports.finisher.handleAlarm,
    ports.finisher.rescheduleAfterRestart,
  ]) {
    port.mockResolvedValue(undefined);
  }
  ports.backfillOpenTabs.mockResolvedValue(3);
  ports.openWideView.mockResolvedValue(true);
  ports.findOtherRoomTab.mockResolvedValue(null);
  ports.shouldStartFreshMeeting.mockResolvedValue(false);
  ports.isMeetingLive.mockReturnValue(true);
  ports.canInject.mockReturnValue(true);
  for (const command of ASSOCIATION_COMMANDS) {
    ports.association[command].mockResolvedValue({ ok: true, command });
  }
  events = installEvents();
});

/** Importa o service worker com a migração ainda pendente (o `ready` só anda quando o teste mandar). */
async function boot() {
  const migration = deferred();
  ports.migrateLocalStorage.mockReturnValue(migration.promise);
  await import('./index');
  const ready = ports.registerAgpQuestionsFeed.mock.calls[0]?.[0] as Promise<void>;
  return { migration, ready };
}

function registered(stub: ReturnType<typeof eventStub>): Listener {
  const listener: unknown = stub.addListener.mock.calls[0]?.[0];
  if (typeof listener !== 'function') throw new Error('listener não registrado');
  return listener as Listener;
}

/** Entrega uma mensagem ao listener de `runtime.onMessage` e espera o `sendResponse`. */
function send(message: unknown, sender: unknown = { tab: { id: TAB_ID } }): Promise<unknown> {
  const listener = registered(events.onMessage);
  return new Promise((resolve) => {
    const keepsChannelOpen = listener(message, sender, resolve);
    expect(keepsChannelOpen).toBe(true);
  });
}

describe('registro síncrono dos listeners (MV3)', () => {
  it('registra os 7 listeners do Chrome, o feed AGP e o configurador do encerramento com o ready ainda pendente', async () => {
    await boot();

    expect(events.onInstalled.addListener).toHaveBeenCalledTimes(1);
    expect(events.onClicked.addListener).toHaveBeenCalledTimes(1);
    expect(events.onRemoved.addListener).toHaveBeenCalledTimes(1);
    expect(events.onUpdated.addListener).toHaveBeenCalledTimes(1);
    expect(events.onStartup.addListener).toHaveBeenCalledTimes(1);
    expect(events.onAlarm.addListener).toHaveBeenCalledTimes(1);
    expect(events.onMessage.addListener).toHaveBeenCalledTimes(1);
    expect(ports.registerAgpQuestionsFeed).toHaveBeenCalledTimes(1);
    expect(ports.registerAgpQuestionsFeed).toHaveBeenCalledWith(expect.any(Promise));
    expect(ports.configureAgenteSessionFinisher).toHaveBeenCalledTimes(1);
    // A cadeia de inicialização está parada na migração: nada dela rodou ainda.
    expect(ports.migrateLocalStorage).toHaveBeenCalledTimes(1);
    expect(ports.hydrate).not.toHaveBeenCalled();
  });

  it('entrega ao feed AGP o mesmo ready que só resolve depois da migração', async () => {
    const { migration, ready } = await boot();
    let settled = false;
    void ready.then(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(settled).toBe(false);

    migration.resolve();
    await ready;
    expect(settled).toBe(true);
  });
});

describe('cadeia ready', () => {
  it('mantém a ordem: migrar, hidratar, streamer, recuperar, recuperar vínculos, relançar, varrer encerramento, preferências', async () => {
    const { migration, ready } = await boot();
    migration.resolve();
    await ready;

    const chain = [
      ports.migrateLocalStorage,
      ports.hydrate,
      ports.resumeAgenteStreamer,
      ports.recoverInterruptedMeetings,
      ports.recoverAssociationsAfterRestart,
      ports.association.resumeLiveLinksAfterRestart,
      ports.finisher.rescheduleAfterRestart,
      ports.ensurePanelPrefs,
    ];
    for (const step of chain) expect(step).toHaveBeenCalledTimes(1);
    const order = chain.map((step) => step.mock.invocationCallOrder[0] ?? Number.NaN);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(new Set(order).size).toBe(chain.length);
  });

  it('recupera os vínculos com o estado atual e entrega a regra "está ao vivo?" ao agendador do encerramento', async () => {
    const { migration, ready } = await boot();
    migration.resolve();
    await ready;

    expect(ports.recoverAssociationsAfterRestart).toHaveBeenCalledWith(IDLE);
    const config = ports.configureAgenteSessionFinisher.mock.calls[0]?.[0] as {
      isMeetingLive: (meetingId: string) => boolean;
    };
    ports.isMeetingLive.mockReturnValue(false);
    expect(config.isMeetingLive('m1')).toBe(false);
    expect(ports.isMeetingLive).toHaveBeenCalledWith(IDLE, 'm1');
  });

  it('captura a falha da migração: o ready resolve, a cadeia para e o erro vai ao log', async () => {
    const { migration, ready } = await boot();
    migration.reject(new Error('migração falhou'));

    await expect(ready).resolves.toBeUndefined();
    expect(ports.hydrate).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it('captura a falha do relançar do vínculo e da varredura do encerramento sem parar a cadeia', async () => {
    ports.association.resumeLiveLinksAfterRestart.mockRejectedValue(new Error('relançar falhou'));
    ports.finisher.rescheduleAfterRestart.mockRejectedValue(new Error('varredura falhou'));
    const { migration, ready } = await boot();
    migration.resolve();

    await expect(ready).resolves.toBeUndefined();
    await vi.waitFor(() => expect(consoleError).toHaveBeenCalledTimes(2));
    expect(ports.ensurePanelPrefs).toHaveBeenCalledTimes(1);
  });
});

describe('listeners do navegador', () => {
  it('runtime.onInstalled alcança as abas abertas só depois do ready', async () => {
    const { migration, ready } = await boot();

    registered(events.onInstalled)();
    await Promise.resolve();
    expect(ports.backfillOpenTabs).not.toHaveBeenCalled();

    migration.resolve();
    await ready;
    await vi.waitFor(() => expect(ports.backfillOpenTabs).toHaveBeenCalledTimes(1));
  });

  it('action.onClicked em página que não aceita o painel abre a tela larga', async () => {
    await boot();
    const tab = { id: 3, url: 'chrome://newtab/' };
    ports.canInject.mockReturnValue(false);

    registered(events.onClicked)(tab);

    expect(ports.canInject).toHaveBeenCalledWith('chrome://newtab/');
    expect(ports.openWideView).toHaveBeenCalledWith(tab);
    expect(ports.patchPanelPrefs).not.toHaveBeenCalled();
    expect(ports.ensurePanelInTab).not.toHaveBeenCalled();
  });

  it('action.onClicked em página comum grava presence open e só então garante o painel na aba', async () => {
    await boot();
    const tab = { id: 3, url: 'https://meet.google.com/abc-defg-hij' };

    registered(events.onClicked)(tab);

    await vi.waitFor(() => expect(ports.ensurePanelInTab).toHaveBeenCalledWith(tab));
    expect(ports.patchPanelPrefs).toHaveBeenCalledWith({ presence: 'open' });
    expect(ports.openWideView).not.toHaveBeenCalled();
    const patched = ports.patchPanelPrefs.mock.invocationCallOrder[0] ?? Number.NaN;
    const ensured = ports.ensurePanelInTab.mock.invocationCallOrder[0] ?? Number.NaN;
    expect(patched).toBeLessThan(ensured);
  });

  it('tabs.onRemoved esquece o painel e marca "saiu da call" de forma síncrona; a regra da reunião espera o ready', async () => {
    const { migration, ready } = await boot();

    registered(events.onRemoved)(5);

    expect(ports.forgetPanelTab).toHaveBeenCalledWith(5);
    expect(ports.markTabLeftCall).toHaveBeenCalledWith(5);
    expect(ports.onMeetingTabRemoved).not.toHaveBeenCalled();

    migration.resolve();
    await ready;
    await vi.waitFor(() => expect(ports.onMeetingTabRemoved).toHaveBeenCalledTimes(1));
    expect(ports.onMeetingTabRemoved).toHaveBeenCalledWith(
      5,
      expect.objectContaining({
        getState: ports.getState,
        dispatch: ports.dispatch,
        otherRoomTabId: ports.findOtherRoomTab,
      }),
    );
  });

  it('tabs.onUpdated com url anota a mudança de forma síncrona; a regra da navegação espera o ready', async () => {
    const { migration, ready } = await boot();
    const url = 'https://example.com/outra-pagina';

    registered(events.onUpdated)(5, { url });

    expect(ports.noteTabUrlChanged).toHaveBeenCalledWith(5, url);
    expect(ports.onMeetingTabNavigated).not.toHaveBeenCalled();

    migration.resolve();
    await ready;
    await vi.waitFor(() => expect(ports.onMeetingTabNavigated).toHaveBeenCalledTimes(1));
    expect(ports.onMeetingTabNavigated).toHaveBeenCalledWith(
      5,
      url,
      expect.objectContaining({
        getState: ports.getState,
        dispatch: ports.dispatch,
        otherRoomTabId: ports.findOtherRoomTab,
      }),
    );
  });

  it('tabs.onUpdated sem url (só status) não chama nenhuma das duas portas', async () => {
    const { migration, ready } = await boot();
    migration.resolve();
    await ready;

    registered(events.onUpdated)(5, { status: 'loading' });
    await Promise.resolve();
    await Promise.resolve();

    expect(ports.noteTabUrlChanged).not.toHaveBeenCalled();
    expect(ports.onMeetingTabNavigated).not.toHaveBeenCalled();
  });

  it('runtime.onStartup dá uma rodada nova de encerramento depois do ready', async () => {
    const { migration, ready } = await boot();

    registered(events.onStartup)();
    await Promise.resolve();
    expect(ports.finisher.restartGaveUpRounds).not.toHaveBeenCalled();

    migration.resolve();
    await ready;
    await vi.waitFor(() => expect(ports.finisher.restartGaveUpRounds).toHaveBeenCalledTimes(1));
  });

  it('runtime.onStartup captura a falha da nova rodada e só registra no log', async () => {
    ports.finisher.restartGaveUpRounds.mockRejectedValue(new Error('rodada falhou'));
    const { migration, ready } = await boot();
    migration.resolve();
    await ready;

    registered(events.onStartup)();

    await vi.waitFor(() => expect(consoleError).toHaveBeenCalledTimes(1));
  });

  it('alarms.onAlarm entrega o nome do alarme ao agendador depois do ready', async () => {
    const { migration, ready } = await boot();

    registered(events.onAlarm)({ name: 'agente-finish:m1' });
    await Promise.resolve();
    expect(ports.finisher.handleAlarm).not.toHaveBeenCalled();

    migration.resolve();
    await ready;
    await vi.waitFor(() => expect(ports.finisher.handleAlarm).toHaveBeenCalledWith('agente-finish:m1'));
  });
});

interface RouterCase {
  name: string;
  message: unknown;
  sender?: unknown;
  /** Ajusta as portas antes de a mensagem chegar. */
  arrange?: () => void;
  check: (response: unknown) => void;
}

/** O evento foi despachado e a resposta é o resultado do `dispatch`. */
function dispatches(event: unknown) {
  return (response: unknown) => {
    expect(ports.dispatch).toHaveBeenCalledWith(event);
    expect(response).toEqual(DISPATCHED);
  };
}

/** O comando foi para o método de mesmo nome de `agenteAssociation` e a resposta é a dele. */
function delegates(command: (typeof ASSOCIATION_COMMANDS)[number], ...args: unknown[]) {
  return (response: unknown) => {
    expect(ports.association[command]).toHaveBeenCalledWith(...args);
    expect(response).toEqual({ ok: true, command });
  };
}

const CURRENT_ENDED = {
  phase: 'ended',
  session: { meetingId: 'm1', meetingCode: MEETING_CODE },
};
const CURRENT_LIVE = {
  phase: 'recording',
  session: { meetingId: 'm1', meetingCode: MEETING_CODE },
};
/** Reunião ao vivo cuja aba dona é conhecida (WR-01, plano 10-18). */
const CURRENT_LIVE_OWNED = {
  phase: 'recording',
  session: { meetingId: 'm1', meetingCode: MEETING_CODE, tabId: TAB_ID },
};
const OTHER_TAB_ID = 8;

const ROUTER_CASES: RouterCase[] = [
  {
    name: 'meet/detected sem título: marca a aba na call e abre a reunião com o título padrão',
    message: { type: 'meet/detected', meetingCode: MEETING_CODE, title: '   ', captionsEnabled: true },
    check: (response) => {
      expect(ports.markTabJoinedCall).toHaveBeenCalledWith(TAB_ID, MEETING_CODE);
      expect(ports.shouldStartFreshMeeting).toHaveBeenCalledWith(IDLE, MEETING_CODE);
      expect(ports.dispatch).toHaveBeenCalledWith({
        type: 'MEETING_DETECTED',
        meetingId: expect.any(String),
        meetingCode: MEETING_CODE,
        provider: PROVIDER_GOOGLE_MEET,
        tabId: TAB_ID,
        title: expect.stringMatching(/^Reunião de \d{2}\/\d{2} às /),
        titleAuto: true,
        captionsEnabled: true,
        at: expect.any(Number),
      });
      expect(response).toEqual(IDLE);
    },
  },
  {
    name: 'meet/detected com título e reunião nova: usa o título dado e pede começo do zero',
    message: { type: 'meet/detected', meetingCode: MEETING_CODE, title: 'Sync semanal', captionsEnabled: false },
    arrange: () => ports.shouldStartFreshMeeting.mockResolvedValue(true),
    check: (response) => {
      expect(ports.dispatch).toHaveBeenCalledWith({
        type: 'MEETING_DETECTED',
        meetingId: expect.any(String),
        meetingCode: MEETING_CODE,
        provider: PROVIDER_GOOGLE_MEET,
        tabId: TAB_ID,
        title: 'Sync semanal',
        titleAuto: false,
        captionsEnabled: false,
        at: expect.any(Number),
        startFresh: true,
      });
      expect(response).toEqual(IDLE);
    },
  },
  {
    name: 'meet/detected sem aba remetente: não marca a call e guarda tabId nulo',
    message: { type: 'meet/detected', meetingCode: MEETING_CODE, title: 'Sync', captionsEnabled: true },
    sender: {},
    check: () => {
      expect(ports.markTabJoinedCall).not.toHaveBeenCalled();
      expect(ports.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'MEETING_DETECTED', tabId: null }));
    },
  },
  {
    name: 'meet/ended: entrega a aba remetente e as portas à regra de encerramento',
    message: { type: 'meet/ended' },
    check: (response) => {
      expect(ports.onMeetingEndedInTab).toHaveBeenCalledWith(
        TAB_ID,
        expect.objectContaining({
          getState: ports.getState,
          dispatch: ports.dispatch,
          otherRoomTabId: ports.findOtherRoomTab,
          markLeftCall: ports.markTabLeftCall,
        }),
      );
      expect(response).toEqual(IDLE);
    },
  },
  {
    name: 'meet/captions: CAPTIONS_STATE',
    message: { type: 'meet/captions', enabled: false },
    check: dispatches({ type: 'CAPTIONS_STATE', enabled: false }),
  },
  {
    name: 'meet/chunk em estado ocioso: anota a atividade sem código de reunião e despacha CAPTION_CHUNK',
    message: { type: 'meet/chunk', chunk: { captionId: 'c1', speaker: 'Ana', text: 'oi', atMs: 10 } },
    check: (response) => {
      expect(ports.noteTabCaptionActivity).toHaveBeenCalledWith(TAB_ID, undefined);
      dispatches({
        type: 'CAPTION_CHUNK',
        chunk: { captionId: 'c1', speaker: 'Ana', text: 'oi', atMs: 10 },
      })(response);
    },
  },
  {
    name: 'meet/chunk com reunião ao vivo: anota a atividade com o código da reunião',
    message: { type: 'meet/chunk', chunk: { captionId: 'c2', speaker: null, text: 'tchau', atMs: 20 } },
    arrange: () => ports.getState.mockReturnValue(CURRENT_LIVE),
    check: () => {
      expect(ports.noteTabCaptionActivity).toHaveBeenCalledWith(TAB_ID, MEETING_CODE);
    },
  },
  {
    name: 'meet/chunk da aba dona da reunião: despacha CAPTION_CHUNK (WR-01)',
    message: { type: 'meet/chunk', chunk: { captionId: 'c3', speaker: 'Ana', text: 'bom dia', atMs: 30 } },
    arrange: () => ports.getState.mockReturnValue(CURRENT_LIVE_OWNED),
    check: dispatches({
      type: 'CAPTION_CHUNK',
      chunk: { captionId: 'c3', speaker: 'Ana', text: 'bom dia', atMs: 30 },
    }),
  },
  {
    name: 'meet/chunk de aba que não é a dona: não despacha, mas reaprende a aba na call (WR-01)',
    message: { type: 'meet/chunk', chunk: { captionId: 'x9', speaker: 'Ana', text: 'bom dia', atMs: 31 } },
    sender: { tab: { id: OTHER_TAB_ID } },
    arrange: () => ports.getState.mockReturnValue(CURRENT_LIVE_OWNED),
    check: (response) => {
      expect(ports.noteTabCaptionActivity).toHaveBeenCalledWith(OTHER_TAB_ID, MEETING_CODE);
      expect(ports.dispatch).not.toHaveBeenCalled();
      expect(response).toEqual(CURRENT_LIVE_OWNED);
    },
  },
  {
    name: 'meet/chunk sem aba dona conhecida: despacha como antes (WR-01)',
    message: { type: 'meet/chunk', chunk: { captionId: 'c4', speaker: null, text: 'ok', atMs: 40 } },
    sender: { tab: { id: OTHER_TAB_ID } },
    arrange: () => ports.getState.mockReturnValue(CURRENT_LIVE),
    check: dispatches({
      type: 'CAPTION_CHUNK',
      chunk: { captionId: 'c4', speaker: null, text: 'ok', atMs: 40 },
    }),
  },
  {
    name: 'meet/participants: PARTICIPANTS_UPDATED',
    message: { type: 'meet/participants', participants: [{ name: 'Ana', isHost: true }] },
    check: dispatches({ type: 'PARTICIPANTS_UPDATED', participants: [{ name: 'Ana', isHost: true }] }),
  },
  {
    name: 'meet/accountContext: ACCOUNT_BOUNDARY_UPDATED só com a conta do Meet',
    message: {
      type: 'meet/accountContext',
      context: {
        email: 'ana@exemplo.com',
        displayName: 'Ana',
        observedAt: 1,
        source: 'meet_account_control',
        confidence: 0.9,
      },
    },
    check: dispatches({
      type: 'ACCOUNT_BOUNDARY_UPDATED',
      boundary: {
        meet: {
          email: 'ana@exemplo.com',
          displayName: 'Ana',
          observedAt: 1,
          source: 'meet_account_control',
          confidence: 0.9,
        },
        product: null,
        mismatch: false,
      },
    }),
  },
  {
    name: 'meet/speakersMerged: SPEAKERS_MERGED',
    message: { type: 'meet/speakersMerged', renames: [{ from: 'Ana S.', to: 'Ana Souza' }] },
    check: dispatches({ type: 'SPEAKERS_MERGED', renames: [{ from: 'Ana S.', to: 'Ana Souza' }] }),
  },
  {
    name: 'meet/reconnect: RECONNECT',
    message: { type: 'meet/reconnect' },
    check: dispatches({ type: 'RECONNECT' }),
  },
  {
    name: 'meet/captureDegraded (parser): conta a degradação e a falha do parser, depois CAPTURE_DEGRADED',
    message: { type: 'meet/captureDegraded', reason: 'parser' },
    check: (response) => {
      expect(ports.bumpMetrics).toHaveBeenCalledWith({ captureDegradedTotal: 1, parserFailuresTotal: 1 });
      dispatches({ type: 'CAPTURE_DEGRADED', at: expect.any(Number) })(response);
    },
  },
  {
    name: 'meet/captureDegraded (stall): conta só a degradação',
    message: { type: 'meet/captureDegraded', reason: 'stall' },
    check: (response) => {
      expect(ports.bumpMetrics).toHaveBeenCalledWith({ captureDegradedTotal: 1 });
      dispatches({ type: 'CAPTURE_DEGRADED', at: expect.any(Number) })(response);
    },
  },
  {
    name: 'panel/openRequest (histórico de uma reunião): abre a tela larga nessa reunião e responde ok',
    message: { type: 'panel/openRequest', view: 'history', recordId: 'm1' },
    check: (response) => {
      expect(ports.openWideView).toHaveBeenCalledWith({ id: TAB_ID }, { history: true, recordId: 'm1' });
      expect(response).toEqual({ ok: true });
    },
  },
  {
    name: 'panel/openRequest (sem destino): abre a tela da fase atual',
    message: { type: 'panel/openRequest' },
    check: () => {
      expect(ports.openWideView).toHaveBeenCalledWith({ id: TAB_ID }, { history: false, recordId: null });
    },
  },
  {
    name: 'panel/mounted: lembra a aba do painel e devolve o estado',
    message: { type: 'panel/mounted' },
    check: (response) => {
      expect(ports.rememberPanelTab).toHaveBeenCalledWith(TAB_ID);
      expect(response).toEqual(IDLE);
    },
  },
  {
    name: 'ui/getState: devolve o estado',
    message: { type: 'ui/getState' },
    check: (response) => {
      expect(ports.dispatch).not.toHaveBeenCalled();
      expect(response).toEqual(IDLE);
    },
  },
  { name: 'ui/pause: PAUSE', message: { type: 'ui/pause' }, check: dispatches({ type: 'PAUSE' }) },
  { name: 'ui/resume: RESUME', message: { type: 'ui/resume' }, check: dispatches({ type: 'RESUME' }) },
  {
    name: 'ui/clearTranscript: CLEAR_TRANSCRIPT',
    message: { type: 'ui/clearTranscript' },
    check: dispatches({ type: 'CLEAR_TRANSCRIPT' }),
  },
  {
    name: 'ui/finish: MEETING_FINISHED',
    message: { type: 'ui/finish' },
    check: dispatches({ type: 'MEETING_FINISHED', at: expect.any(Number) }),
  },
  {
    name: 'ui/rename: RENAME e responde ok',
    message: { type: 'ui/rename', title: 'Novo nome' },
    check: (response) => {
      expect(ports.dispatch).toHaveBeenCalledWith({ type: 'RENAME', title: 'Novo nome' });
      expect(response).toEqual({ ok: true });
    },
  },
  { name: 'ui/reset: RESET', message: { type: 'ui/reset' }, check: dispatches({ type: 'RESET' }) },
  {
    name: 'ui/dismissLanguageWarning: LANGUAGE_WARNING_DISMISSED',
    message: { type: 'ui/dismissLanguageWarning' },
    check: dispatches({ type: 'LANGUAGE_WARNING_DISMISSED' }),
  },
  {
    name: 'ui/history/delete da reunião encerrada que está na tela: RESET, apaga o registro e solta o vínculo',
    message: { type: 'ui/history/delete', id: 'm1' },
    arrange: () => ports.getState.mockReturnValue(CURRENT_ENDED),
    check: (response) => {
      expect(ports.dispatch).toHaveBeenCalledWith({ type: 'RESET' });
      expect(ports.deleteRecord).toHaveBeenCalledWith('m1');
      expect(ports.releaseMeetingAssociation).toHaveBeenCalledWith('m1');
      expect(response).toEqual({ ok: true });
    },
  },
  {
    name: 'ui/history/delete de outra reunião: sem RESET, apaga o registro e solta o vínculo',
    message: { type: 'ui/history/delete', id: 'm9' },
    arrange: () => ports.getState.mockReturnValue(CURRENT_ENDED),
    check: (response) => {
      expect(ports.dispatch).not.toHaveBeenCalled();
      expect(ports.deleteRecord).toHaveBeenCalledWith('m9');
      expect(ports.releaseMeetingAssociation).toHaveBeenCalledWith('m9');
      expect(response).toEqual({ ok: true });
    },
  },
  {
    name: 'ui/history/rename da reunião que está na tela: regrava o registro e RENAME',
    message: { type: 'ui/history/rename', id: 'm1', title: 'Outro título' },
    arrange: () => ports.getState.mockReturnValue(CURRENT_LIVE),
    check: (response) => {
      expect(ports.patchRecord).toHaveBeenCalledWith('m1', { title: 'Outro título' });
      expect(ports.dispatch).toHaveBeenCalledWith({ type: 'RENAME', title: 'Outro título' });
      expect(response).toEqual({ ok: true });
    },
  },
  {
    name: 'ui/history/rename de outra reunião: só regrava o registro',
    message: { type: 'ui/history/rename', id: 'm9', title: 'Outro título' },
    arrange: () => ports.getState.mockReturnValue(CURRENT_LIVE),
    check: (response) => {
      expect(ports.patchRecord).toHaveBeenCalledWith('m9', { title: 'Outro título' });
      expect(ports.dispatch).not.toHaveBeenCalled();
      expect(response).toEqual({ ok: true });
    },
  },
  {
    name: 'ui/agente/clients/list: agenteAssociation.listClients',
    message: { type: 'ui/agente/clients/list' },
    check: delegates('listClients'),
  },
  {
    name: 'ui/agente/meeting/open: agenteAssociation.open',
    message: { type: 'ui/agente/meeting/open', meetingId: 'm1' },
    check: delegates('open', 'm1'),
  },
  {
    name: 'ui/agente/meeting/defer: agenteAssociation.defer',
    message: { type: 'ui/agente/meeting/defer', meetingId: 'm1' },
    check: delegates('defer', 'm1'),
  },
  {
    name: 'ui/agente/meeting/bind: agenteAssociation.bind com o alvo',
    message: {
      type: 'ui/agente/meeting/bind',
      meetingId: 'm1',
      target: { kind: 'manual', sessionId: SESSION_UUID },
    },
    check: delegates('bind', 'm1', { kind: 'manual', sessionId: SESSION_UUID }),
  },
  {
    name: 'ui/agente/meeting/discard: agenteAssociation.discard',
    message: { type: 'ui/agente/meeting/discard', meetingId: 'm1' },
    check: delegates('discard', 'm1'),
  },
  {
    name: 'ui/agente/meeting/resume-send: agenteAssociation.resumeSend',
    message: { type: 'ui/agente/meeting/resume-send', meetingId: 'm1' },
    check: delegates('resumeSend', 'm1'),
  },
  {
    name: 'state/updated: responde undefined e não mexe em nenhuma porta de estado',
    message: { type: 'state/updated', state: IDLE },
    check: (response) => {
      expect(response).toBeUndefined();
      expect(ports.dispatch).not.toHaveBeenCalled();
    },
  },
];

describe('roteador de mensagens (tipo de mensagem → porta chamada)', () => {
  it.each(ROUTER_CASES)('$name', async ({ message, sender, arrange, check }) => {
    const { migration } = await boot();
    migration.resolve();
    arrange?.();

    const response = await send(message, sender);

    check(response);
  });

  it('panel/mounted sem aba remetente não lembra nenhuma aba', async () => {
    const { migration } = await boot();
    migration.resolve();

    const response = await send({ type: 'panel/mounted' }, {});

    expect(ports.rememberPanelTab).not.toHaveBeenCalled();
    expect(response).toEqual(IDLE);
  });

  it('só responde depois do ready: a porta não é chamada enquanto a migração está pendente', async () => {
    const { migration } = await boot();

    const pending = send({ type: 'ui/pause' });
    await Promise.resolve();
    await Promise.resolve();
    expect(ports.dispatch).not.toHaveBeenCalled();

    migration.resolve();
    await expect(pending).resolves.toEqual(DISPATCHED);
    expect(ports.dispatch).toHaveBeenCalledWith({ type: 'PAUSE' });
  });

  it('descarta mensagem inválida pelo esquema zod sem chamar nenhuma porta', async () => {
    const { migration } = await boot();
    migration.resolve();
    const respond = vi.fn();

    const keepsChannelOpen = registered(events.onMessage)({ type: 'ui/rename', title: '' }, { tab: { id: TAB_ID } }, respond);
    await Promise.resolve();

    expect(keepsChannelOpen).toBe(false);
    expect(respond).not.toHaveBeenCalled();
    expect(ports.dispatch).not.toHaveBeenCalled();
  });

  it('responde erro interno quando a porta falha', async () => {
    ports.dispatch.mockRejectedValue(new Error('porta falhou'));
    const { migration } = await boot();
    migration.resolve();

    await expect(send({ type: 'ui/pause' })).resolves.toEqual({ ok: false, error: 'internal' });
  });
});
