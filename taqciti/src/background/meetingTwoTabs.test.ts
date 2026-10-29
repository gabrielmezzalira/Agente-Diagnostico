/**
 * A mesma reunião em duas abas (Fase 10, TAQ-05, decisão D-03), com a máquina REAL e `chrome.tabs.query`
 * simulado. Prova que fechar a aba dona (DA-3) com outra aba na mesma call reaponta a reunião em vez de
 * encerrar; que a última saída encerra uma vez só; que a consulta falhando, vazia ou sem aba "na call" encerra
 * (D-17 / comportamento de sempre); e que a memória das abas na call (só RAM) se refaz pela legenda depois do
 * reinício do service worker, sem deixar uma legenda atrasada ressuscitar a aba que saiu.
 *
 * O módulo `meetingRoomTabs` guarda a memória em variáveis do módulo: cada teste importa uma cópia nova
 * (`vi.resetModules()`), que é também como o reinício do worker é simulado.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { transition, type MeetingEvent } from '@/features/meeting/machine';
import { IDLE_STATE, type MeetingState } from '@/shared/types/domain';
import { installChromeStorageMock } from '@/test/chromeStorageMock';

const ROOM = 'abc-defg-hij';
const OWNER = 7;
const OTHER = 9;
const NOW = 424242;
const ROOM_URL = `https://meet.google.com/${ROOM}`;

interface FakeTab {
  id?: number;
  url?: string;
}

const detected = (captionsEnabled = true): MeetingEvent => ({
  type: 'MEETING_DETECTED',
  meetingId: 'm1',
  meetingCode: ROOM,
  provider: 'google-meet',
  tabId: OWNER,
  title: 'Reunião de teste',
  captionsEnabled,
  at: 1000,
});

/** O service worker "acabou de acordar": módulos novos (memória vazia) e `chrome.tabs.query` simulado. */
async function startWorker(initialTabs: FakeTab[] = []) {
  vi.resetModules();
  let tabs = initialTabs;
  const query = vi.fn<(filter: unknown) => Promise<FakeTab[]>>(() => Promise.resolve(tabs));
  installChromeStorageMock({ extra: { tabs: { query } } });
  const roomTabs = await import('./meetingRoomTabs');
  const closed = await import('./meetingTabClosed');
  return {
    roomTabs,
    closed,
    query,
    setTabs: (next: FakeTab[]) => {
      tabs = next;
    },
  };
}

/** Reunião viva na aba dona, com a máquina real; guarda todos os eventos despachados. */
function liveMeeting(captionsEnabled = true) {
  let state: MeetingState = transition(IDLE_STATE, detected(captionsEnabled));
  const events: MeetingEvent[] = [];
  const dispatch = (event: MeetingEvent) => {
    events.push(event);
    state = transition(state, event);
    return Promise.resolve(state);
  };
  return {
    current: () => state,
    events,
    finishedCount: () => events.filter((event) => event.type === 'MEETING_FINISHED').length,
    getState: () => state,
    dispatch,
  };
}

type Worker = Awaited<ReturnType<typeof startWorker>>;

/** Fecha uma aba como o `tabs.onRemoved` do index.ts: marca a saída (síncrono) e roda a regra com a porta real. */
async function closeTab(worker: Worker, meeting: ReturnType<typeof liveMeeting>, tabId: number) {
  worker.roomTabs.markTabLeftCall(tabId);
  await worker.closed.onMeetingTabRemoved(tabId, {
    getState: meeting.getState,
    dispatch: meeting.dispatch,
    now: () => NOW,
    otherRoomTabId: worker.roomTabs.findOtherRoomTab,
  });
}

describe('MEETING_TAB_CHANGED na máquina', () => {
  it.each([
    ['recording', () => liveMeeting().current()],
    ['paused', () => transition(liveMeeting().current(), { type: 'PAUSE' })],
    ['captionsRequired', () => liveMeeting(false).current()],
  ])('em %s reaponta session.tabId e deixa o resto igual', (phase, build) => {
    const before = build();
    expect(before.phase).toBe(phase);
    const after = transition(before, { type: 'MEETING_TAB_CHANGED', tabId: OTHER });
    expect(after.phase).toBe(phase);
    expect(after.session?.tabId).toBe(OTHER);
    expect({ ...after.session, tabId: OWNER }).toEqual(before.session);
  });

  it('em idle e em ended devolve o MESMO estado', () => {
    const ended = transition(liveMeeting().current(), { type: 'MEETING_FINISHED', at: NOW });
    expect(ended.phase).toBe('ended');
    expect(transition(IDLE_STATE, { type: 'MEETING_TAB_CHANGED', tabId: OTHER })).toBe(IDLE_STATE);
    expect(transition(ended, { type: 'MEETING_TAB_CHANGED', tabId: OTHER })).toBe(ended);
  });
});

describe('findOtherRoomTab (adaptador do chrome.tabs)', () => {
  let worker: Worker;
  beforeEach(async () => {
    worker = await startWorker();
  });

  it('consulta só as abas do Meet e devolve a aba que entrou na call na mesma sala', async () => {
    worker.setTabs([{ id: OWNER, url: ROOM_URL }, { id: OTHER, url: ROOM_URL }]);
    worker.roomTabs.markTabJoinedCall(OTHER, ROOM);
    await expect(worker.roomTabs.findOtherRoomTab(ROOM, OWNER)).resolves.toBe(OTHER);
    expect(worker.query).toHaveBeenCalledWith({ url: '*://meet.google.com/*' });
  });

  it('aceita /meet/<código> e compara o código sem diferenciar maiúsculas', async () => {
    worker.setTabs([{ id: OTHER, url: `https://meet.google.com/meet/ABC-defg-HIJ?authuser=1` }]);
    worker.roomTabs.markTabJoinedCall(OTHER, 'ABC-DEFG-hij');
    await expect(worker.roomTabs.findOtherRoomTab(ROOM, OWNER)).resolves.toBe(OTHER);
  });

  it.each<[string, FakeTab[]]>([
    ['lista vazia', []],
    ['só a aba excluída', [{ id: OWNER, url: ROOM_URL }]],
    ['outra sala', [{ id: OTHER, url: 'https://meet.google.com/zzz-yyyy-xxx' }]],
    ['host parecido', [{ id: OTHER, url: `https://meet.google.com.evil.com/${ROOM}` }]],
    ['aba sem id', [{ url: ROOM_URL }]],
    ['aba sem url', [{ id: OTHER }]],
  ])('devolve null: %s', async (_name, tabs) => {
    worker.setTabs(tabs);
    worker.roomTabs.markTabJoinedCall(OTHER, ROOM);
    await expect(worker.roomTabs.findOtherRoomTab(ROOM, OWNER)).resolves.toBeNull();
  });

  it('aba na sala que nunca entrou na call (pré-entrada) não conta', async () => {
    worker.setTabs([{ id: OTHER, url: ROOM_URL }]);
    await expect(worker.roomTabs.findOtherRoomTab(ROOM, OWNER)).resolves.toBeNull();
  });

  it('aba registrada em OUTRA sala não conta para esta sala', async () => {
    worker.setTabs([{ id: OTHER, url: ROOM_URL }]);
    worker.roomTabs.markTabJoinedCall(OTHER, 'zzz-yyyy-xxx');
    await expect(worker.roomTabs.findOtherRoomTab(ROOM, OWNER)).resolves.toBeNull();
  });

  it('aba que saiu da call (markTabLeftCall) não conta', async () => {
    worker.setTabs([{ id: OTHER, url: ROOM_URL }]);
    worker.roomTabs.markTabJoinedCall(OTHER, ROOM);
    worker.roomTabs.markTabLeftCall(OTHER);
    await expect(worker.roomTabs.findOtherRoomTab(ROOM, OWNER)).resolves.toBeNull();
  });

  it('com duas candidatas, escolhe a primeira na ordem devolvida pela consulta', async () => {
    worker.roomTabs.markTabJoinedCall(OTHER, ROOM);
    worker.roomTabs.markTabJoinedCall(11, ROOM);
    worker.setTabs([{ id: OTHER, url: ROOM_URL }, { id: 11, url: ROOM_URL }]);
    await expect(worker.roomTabs.findOtherRoomTab(ROOM, OWNER)).resolves.toBe(OTHER);
    worker.setTabs([{ id: 11, url: ROOM_URL }, { id: OTHER, url: ROOM_URL }]);
    await expect(worker.roomTabs.findOtherRoomTab(ROOM, OWNER)).resolves.toBe(11);
  });

  it('a rejeição da consulta propaga (quem trata é a regra)', async () => {
    worker.query.mockRejectedValueOnce(new Error('tabs indisponível'));
    await expect(worker.roomTabs.findOtherRoomTab(ROOM, OWNER)).rejects.toThrow('tabs indisponível');
  });

  it('uma aba que fecha enquanto a consulta corre não é escolhida (a memória é lida depois do await)', async () => {
    worker.roomTabs.markTabJoinedCall(OTHER, ROOM);
    let release: (tabs: FakeTab[]) => void = () => undefined;
    worker.query.mockImplementationOnce(() => new Promise<FakeTab[]>((resolve) => (release = resolve)));
    const pending = worker.roomTabs.findOtherRoomTab(ROOM, OWNER);
    worker.roomTabs.markTabLeftCall(OTHER);
    release([{ id: OTHER, url: ROOM_URL }]);
    await expect(pending).resolves.toBeNull();
  });
});

describe('fluxo: fechar a aba dona (DA-3) com a máquina real', () => {
  it('(a) fecha a dona com a outra aba na call: continua ao vivo na outra, sem MEETING_FINISHED', async () => {
    const worker = await startWorker([{ id: OTHER, url: ROOM_URL }]);
    const meeting = liveMeeting();
    worker.roomTabs.markTabJoinedCall(OTHER, ROOM);

    await closeTab(worker, meeting, OWNER);

    expect(meeting.current().phase).toBe('recording');
    expect(meeting.current().session?.tabId).toBe(OTHER);
    expect(meeting.events).toEqual([{ type: 'MEETING_TAB_CHANGED', tabId: OTHER }]);
    expect(meeting.finishedCount()).toBe(0);
  });

  it('(c) fecha a dona e depois a que sobrou: encerra, com um único MEETING_FINISHED', async () => {
    const worker = await startWorker([{ id: OTHER, url: ROOM_URL }]);
    const meeting = liveMeeting();
    worker.roomTabs.markTabJoinedCall(OTHER, ROOM);

    await closeTab(worker, meeting, OWNER);
    worker.setTabs([]);
    await closeTab(worker, meeting, OTHER);

    expect(meeting.current().phase).toBe('ended');
    expect(meeting.current().session?.endedAt).toBe(NOW);
    expect(meeting.finishedCount()).toBe(1);
  });

  it('(d) fecha uma aba que NÃO é a dona: nada é despachado', async () => {
    const worker = await startWorker([{ id: OTHER, url: ROOM_URL }]);
    const meeting = liveMeeting();
    worker.roomTabs.markTabJoinedCall(OTHER, ROOM);

    await closeTab(worker, meeting, OTHER);

    expect(meeting.events).toEqual([]);
    expect(meeting.current().phase).toBe('recording');
    expect(meeting.current().session?.tabId).toBe(OWNER);
    expect(worker.query).not.toHaveBeenCalled();
  });

  it('(e) uma aba só (a consulta devolve lista vazia): encerra, como hoje', async () => {
    const worker = await startWorker([]);
    const meeting = liveMeeting();

    await closeTab(worker, meeting, OWNER);

    expect(meeting.current().phase).toBe('ended');
    expect(meeting.finishedCount()).toBe(1);
  });

  it('(g) a consulta rejeita: encerra (D-17, falha segura)', async () => {
    const worker = await startWorker([{ id: OTHER, url: ROOM_URL }]);
    const meeting = liveMeeting();
    worker.roomTabs.markTabJoinedCall(OTHER, ROOM);
    worker.query.mockRejectedValueOnce(new Error('tabs indisponível'));

    await closeTab(worker, meeting, OWNER);

    expect(meeting.current().phase).toBe('ended');
    expect(meeting.finishedCount()).toBe(1);
  });

  it('a outra aba está na sala mas só na tela de pré-entrada (nunca entrou na call): encerra', async () => {
    const worker = await startWorker([{ id: OTHER, url: ROOM_URL }]);
    const meeting = liveMeeting();

    await closeTab(worker, meeting, OWNER);

    expect(meeting.current().phase).toBe('ended');
    expect(meeting.finishedCount()).toBe(1);
  });

  it('a outra aba está em OUTRA sala: encerra', async () => {
    const worker = await startWorker([{ id: OTHER, url: 'https://meet.google.com/zzz-yyyy-xxx' }]);
    const meeting = liveMeeting();
    worker.roomTabs.markTabJoinedCall(OTHER, 'zzz-yyyy-xxx');

    await closeTab(worker, meeting, OWNER);

    expect(meeting.current().phase).toBe('ended');
  });

  it('sem a porta otherRoomTabId (padrão): encerra e nunca consulta abas', async () => {
    const worker = await startWorker([{ id: OTHER, url: ROOM_URL }]);
    const meeting = liveMeeting();
    worker.roomTabs.markTabJoinedCall(OTHER, ROOM);

    await worker.closed.onMeetingTabRemoved(OWNER, { getState: meeting.getState, dispatch: meeting.dispatch, now: () => NOW });

    expect(meeting.current().phase).toBe('ended');
    expect(worker.query).not.toHaveBeenCalled();
  });
});

describe('reaprendizado pela legenda depois do reinício do worker (memória vazia)', () => {
  it('noteTabCaptionActivity faz a aba contar como "na call" na sala da sessão', async () => {
    const worker = await startWorker([{ id: OTHER, url: ROOM_URL }]);
    await expect(worker.roomTabs.findOtherRoomTab(ROOM, OWNER)).resolves.toBeNull();
    worker.roomTabs.noteTabCaptionActivity(OTHER, ROOM);
    await expect(worker.roomTabs.findOtherRoomTab(ROOM, OWNER)).resolves.toBe(OTHER);
  });

  it('com a legenda da outra aba, fechar a dona reaponta em vez de encerrar', async () => {
    const worker = await startWorker([{ id: OTHER, url: ROOM_URL }]);
    const meeting = liveMeeting();
    worker.roomTabs.noteTabCaptionActivity(OTHER, meeting.current().session?.meetingCode);

    await closeTab(worker, meeting, OWNER);

    expect(meeting.current().phase).toBe('recording');
    expect(meeting.current().session?.tabId).toBe(OTHER);
    expect(meeting.finishedCount()).toBe(0);
  });

  it('sem nenhuma legenda (memória vazia): encerra, o comportamento seguro de hoje', async () => {
    const worker = await startWorker([{ id: OTHER, url: ROOM_URL }]);
    const meeting = liveMeeting();

    await closeTab(worker, meeting, OWNER);

    expect(meeting.current().phase).toBe('ended');
    expect(meeting.finishedCount()).toBe(1);
  });

  it('aba indefinida ou sala indefinida não marcam nada', async () => {
    const worker = await startWorker([{ id: OTHER, url: ROOM_URL }]);
    worker.roomTabs.noteTabCaptionActivity(undefined, ROOM);
    worker.roomTabs.noteTabCaptionActivity(OTHER, undefined);
    await expect(worker.roomTabs.findOtherRoomTab(ROOM, OWNER)).resolves.toBeNull();
  });

  it('legenda atrasada não ressuscita aba que saiu; só um novo meet/detected a faz contar de novo', async () => {
    const worker = await startWorker([{ id: OTHER, url: ROOM_URL }]);
    worker.roomTabs.markTabJoinedCall(OTHER, ROOM);
    worker.roomTabs.markTabLeftCall(OTHER);

    worker.roomTabs.noteTabCaptionActivity(OTHER, ROOM);
    await expect(worker.roomTabs.findOtherRoomTab(ROOM, OWNER)).resolves.toBeNull();

    worker.roomTabs.markTabJoinedCall(OTHER, ROOM);
    await expect(worker.roomTabs.findOtherRoomTab(ROOM, OWNER)).resolves.toBe(OTHER);
  });
});
