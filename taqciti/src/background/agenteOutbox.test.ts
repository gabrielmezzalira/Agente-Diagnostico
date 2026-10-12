/**
 * Teste ponta a ponta da fila durável de envio (plano 08-23, TAQ-02, D-18): dispatch REAL da máquina ->
 * streamer COMPOSTO COMO EM PRODUÇÃO (destino pela associação, fila em `taq:agenteOutbox`, status em
 * `taq:agenteDelivery`, rastro em `taq:agenteDropTrace`) -> `send` falso. Só a config, o `send` e o
 * reenvio (`outboxResendEnabled`) são injetados. Prova: queda do Agente -> fila durável -> reinício do
 * service worker (módulos recarregados, mesmo storage) -> volta do Agente -> tudo sai na ordem, sem a
 * chave no storage; e o rastro de falas descartadas sobrevive ao próximo "ok" e ao reinício.
 *
 * Mesma convenção de tempo do `agenteStreamerAssociation.test.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeStorageMock } from '@/test/chromeStorageMock';
import { STATE_FLUSH_INTERVAL_MS, STORAGE_KEYS } from '@/shared/config/constants';
import {
  AGENTE_PHRASE_QUIET_MS,
  type AgenteConfig,
  type ExtensionChunkRequest,
} from '@/shared/config/agenteConfig';
import type { AssociationEvent } from '@/features/agente/association';
import type { MeetingEvent } from '@/features/meeting/machine';

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
/** 1 s + 2 s + 4 s de espera entre as 4 tentativas: depois disto o topo da fila esgotou o ciclo. */
const CYCLE_MS = 8_000;

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

const caption = (text: string): MeetingEvent => ({
  type: 'CAPTION_CHUNK',
  chunk: { captionId: 'c1', speaker: 'Ana', text, atMs: 1100 },
});

/** `send` falso: responde com o HTTP que o teste manda (503 = Agente fora do ar). */
function sendControl(initial: number) {
  let httpStatus = initial;
  const send = vi.fn<(request: ExtensionChunkRequest) => Promise<Response>>(() =>
    Promise.resolve({ ok: httpStatus < 300, status: httpStatus } as Response),
  );
  return { send, setStatus: (value: number) => (httpStatus = value) };
}

const bodiesOf = (send: ReturnType<typeof sendControl>['send']) =>
  send.mock.calls.map(([request]) => JSON.parse(String(request.init.body)) as { session_id: string; text: string });

interface Setup {
  config?: () => AgenteConfig;
  send: ReturnType<typeof sendControl>['send'];
  resend: boolean;
  local?: Record<string, unknown>;
}

/** Sobe o service worker: módulos novos, storage com os valores dados, deps de produção + as injetadas. */
async function boot({ config = () => READY_CONFIG, send, resend, local }: Setup) {
  vi.resetModules();
  const mock = installChromeStorageMock({
    local,
    extra: {
      runtime: { sendMessage: vi.fn(() => Promise.resolve()) },
      tabs: { sendMessage: vi.fn(() => Promise.resolve()) },
    },
  });
  const sessionController = await import('./sessionController');
  const agenteStreamer = await import('./agenteStreamer');
  const store = await import('@/shared/config/agenteAssociationStore');
  agenteStreamer.configureAgenteStreamer({
    loadConfig: () => Promise.resolve(config()),
    send,
    outboxResendEnabled: resend,
  });
  const raw = (key: string) => JSON.stringify(mock.local.values[key] ?? null);
  const stored = (key: string) => JSON.parse(raw(key)) as unknown;
  async function link(meetingId: string, sessionId: string) {
    const apply = (event: AssociationEvent) => store.applyAssociationEvent(meetingId, event);
    await apply({ type: 'created' });
    await apply({ type: 'link-started', origin: 'picker', clientName: 'ACME', sessionId });
    await apply({ type: 'link-completed', seedSent: {} });
  }
  async function letPhraseOut() {
    await vi.advanceTimersByTimeAsync(STATE_FLUSH_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await agenteStreamer.whenAgenteStreamerIdle();
  }
  return { mock, sessionController, agenteStreamer, raw, stored, link, letPhraseOut };
}

/** Reunião m1 vinculada, com duas falas ditas (a 2ª é só o trecho novo). */
async function twoPhrases(setup: Awaited<ReturnType<typeof boot>>) {
  await setup.sessionController.dispatch(detected('m1'));
  await setup.link('m1', OTHER_SESSION_ID);
  await setup.sessionController.dispatch(caption('olá tudo bem'));
  await setup.letPhraseOut();
  await vi.advanceTimersByTimeAsync(CYCLE_MS);
  await setup.sessionController.dispatch(caption('olá tudo bem como vai'));
  await setup.letPhraseOut();
}

/** O service worker "para" (nenhuma instância antiga reage) e sobe de novo com o mesmo storage. */
function restart(old: Awaited<ReturnType<typeof boot>>, setup: Omit<Setup, 'local'>) {
  vi.clearAllTimers();
  return boot({ ...setup, local: JSON.parse(JSON.stringify(old.mock.local.values)) as Record<string, unknown> });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('padrão de produção (reenvio desligado): a Fase 7 continua e a fala descartada fica no rastro', () => {
  it('503 sempre -> failed e a próxima fala sai; o rastro sobrevive ao "ok" e ao reinício, sem chave nem texto', async () => {
    const agente = sendControl(503);
    const sw = await boot({ send: agente.send, resend: false });
    await sw.sessionController.dispatch(detected('m1'));
    await sw.link('m1', OTHER_SESSION_ID);
    await sw.sessionController.dispatch(caption('olá tudo bem'));
    await sw.letPhraseOut();
    await vi.advanceTimersByTimeAsync(CYCLE_MS);

    expect(sw.stored(STORAGE_KEYS.agenteDelivery)).toMatchObject({ status: 'failed' });
    expect(sw.stored(STORAGE_KEYS.agenteDropTrace)).toMatchObject({
      sessionId: OTHER_SESSION_ID,
      count: 1,
      lastReason: 'failed',
    });

    agente.setStatus(202);
    await sw.sessionController.dispatch(caption('olá tudo bem como vai'));
    await sw.letPhraseOut();
    expect(bodiesOf(agente.send).at(-1)).toMatchObject({ session_id: OTHER_SESSION_ID, text: 'como vai' });
    expect(sw.stored(STORAGE_KEYS.agenteDelivery)).toMatchObject({ status: 'ok' });
    expect(sw.stored(STORAGE_KEYS.agenteDropTrace)).toMatchObject({ count: 1 }); // o "ok" não apagou

    const after = await restart(sw, { send: sendControl(202).send, resend: false });
    await after.agenteStreamer.resumeAgenteStreamer();
    expect(after.stored(STORAGE_KEYS.agenteDropTrace)).toMatchObject({ sessionId: OTHER_SESSION_ID, count: 1 });
    const trace = after.raw(STORAGE_KEYS.agenteDropTrace);
    expect(trace).not.toContain('s3cr3t');
    expect(trace).not.toContain('olá tudo bem');
  });
});

describe('reenvio ligado: a fila durável sobrevive a queda e a reinício, na ordem', () => {
  it('Agente fora do ar -> offline com 2 na fila; o JSON cru da fila não tem a chave', async () => {
    const agente = sendControl(503);
    const sw = await boot({ send: agente.send, resend: true });
    await twoPhrases(sw);

    expect(sw.stored(STORAGE_KEYS.agenteDelivery)).toMatchObject({ status: 'offline', queued: 2 });
    expect(sw.stored(STORAGE_KEYS.agenteOutbox)).toHaveLength(2);
    expect(sw.raw(STORAGE_KEYS.agenteOutbox)).not.toContain('s3cr3t');
    expect(sw.raw(STORAGE_KEYS.agenteOutbox)).not.toContain('x-agente-key');
  });

  it('reinício com o Agente de volta: as 2 falas saem na ordem original, a fila esvazia e o status volta a ok', async () => {
    const sw = await boot({ send: sendControl(503).send, resend: true });
    await twoPhrases(sw);
    const before = sw.raw(STORAGE_KEYS.agenteOutbox);

    const up = sendControl(202);
    const after = await restart(sw, { send: up.send, resend: true });
    // `configureAgenteStreamer` descartou a instância criada no import: a fila durável tem de continuar lá.
    expect(after.raw(STORAGE_KEYS.agenteOutbox)).toBe(before);
    expect(up.send).not.toHaveBeenCalled();

    await after.agenteStreamer.resumeAgenteStreamer();
    await vi.advanceTimersByTimeAsync(15_000);

    expect(bodiesOf(up.send)).toEqual([
      expect.objectContaining({ session_id: OTHER_SESSION_ID, text: 'olá tudo bem' }),
      expect.objectContaining({ session_id: OTHER_SESSION_ID, text: 'como vai' }),
    ]);
    expect(after.stored(STORAGE_KEYS.agenteOutbox)).toEqual([]);
    expect(after.stored(STORAGE_KEYS.agenteDelivery)).toMatchObject({ status: 'ok', queued: 0 });
    expect((after.stored(STORAGE_KEYS.agenteDelivery) as { recoveredAt: unknown }).recoveredAt).toEqual(expect.any(Number));
  });

  it('reunião nova sem vínculo (idle) não apaga a fila da reunião anterior', async () => {
    const sw = await boot({ send: sendControl(503).send, resend: true });
    await twoPhrases(sw);
    await sw.sessionController.dispatch(detected('m2')); // sem associação: idle
    await vi.advanceTimersByTimeAsync(AGENTE_PHRASE_QUIET_MS);
    await sw.agenteStreamer.whenAgenteStreamerIdle();
    expect(sw.stored(STORAGE_KEYS.agenteOutbox)).toHaveLength(2);
  });

  it('desligar o toggle limpa a fila durável (D-09 da Fase 7) sem somar no rastro', async () => {
    let config = READY_CONFIG;
    const sw = await boot({ send: sendControl(503).send, resend: true, config: () => config });
    await twoPhrases(sw);
    const traceBefore = sw.raw(STORAGE_KEYS.agenteDropTrace);

    config = { ...READY_CONFIG, streamingEnabled: false };
    await sw.sessionController.dispatch(caption('olá tudo bem como vai você hoje'));
    await sw.letPhraseOut();

    expect(sw.stored(STORAGE_KEYS.agenteOutbox)).toEqual([]);
    expect(sw.raw(STORAGE_KEYS.agenteDropTrace)).toBe(traceBefore);
  });
});

describe('reinício com o envio desligado ou a config não pronta (D-09 da Fase 7 também no boot)', () => {
  it.each([
    ['envio desligado', { ...READY_CONFIG, streamingEnabled: false }],
    ['config não pronta (URL vazia)', { ...READY_CONFIG, agenteBackendUrl: '' }],
  ])('%s: zero envios, fila limpa e rastro sem incremento', async (_name, notReady) => {
    const sw = await boot({ send: sendControl(503).send, resend: true });
    await twoPhrases(sw);
    expect(sw.stored(STORAGE_KEYS.agenteOutbox)).toHaveLength(2);
    const traceBefore = sw.raw(STORAGE_KEYS.agenteDropTrace);

    const up = sendControl(202); // responderia 202 se alguém tentasse
    const after = await restart(sw, { send: up.send, resend: true, config: () => notReady });
    expect(after.stored(STORAGE_KEYS.agenteOutbox)).toHaveLength(2); // o descarte da instância não limpou

    await after.agenteStreamer.resumeAgenteStreamer();
    await vi.advanceTimersByTimeAsync(15_000);

    expect(up.send).not.toHaveBeenCalled();
    expect(after.stored(STORAGE_KEYS.agenteOutbox)).toEqual([]);
    expect(after.raw(STORAGE_KEYS.agenteDropTrace)).toBe(traceBefore);
  });
});
