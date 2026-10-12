/**
 * Gatilhos do encerramento automático da sessão (plano 08-25, decisão B4-b, T-08-52 e T-08-53): a máquina real da
 * reunião e o envio em partes AVISAM o agendador do 08-27 (`agenteSessionFinisher.evaluate`) no fim ou na
 * preempção da reunião, ao terminar ou parar o envio em partes e ao concluir o vínculo. O agendador é espiado:
 * a decisão de encerrar (ou esperar, ou ignorar) é dele e já é testada no 08-27; aqui só se prova que o aviso
 * chega, uma vez, sem esperar e sem derrubar nada.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeStorageMock } from '@/test/chromeStorageMock';
import type { MeetingEvent } from '@/features/meeting/machine';
import type { UploadPart } from '@/features/agente/meetingUploader';
import type { AgenteConfig, ExtensionChunkRequest } from '@/shared/config/agenteConfig';

const SESSION_ID = '11111111-1111-1111-1111-111111111111';

const READY_CONFIG: AgenteConfig = {
  agenteBackendUrl: 'https://agente.test',
  streamingEnabled: true,
  agenteSessionId: '',
  agenteApiKey: 's3cr3t',
  confirmedMeetingId: '',
};

function detected(meetingId: string, meetingCode = 'abc-defg-hij', at = 1000): MeetingEvent {
  return {
    type: 'MEETING_DETECTED',
    meetingId,
    meetingCode,
    provider: 'google-meet',
    tabId: 7,
    title: 'Reunião de teste',
    captionsEnabled: true,
    at,
  };
}

const caption = (text: string): MeetingEvent => ({
  type: 'CAPTION_CHUNK',
  chunk: { captionId: 'c1', speaker: 'Ana', text, atMs: 1100 },
});

async function fresh() {
  const mock = installChromeStorageMock({
    extra: {
      runtime: { sendMessage: vi.fn(() => Promise.resolve()) },
      tabs: { sendMessage: vi.fn(() => Promise.resolve()) },
    },
  });
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, status: 202 } as Response)));
  const sessionController = await import('./sessionController');
  const store = await import('@/shared/config/agenteAssociationStore');
  const { agenteSessionFinisher } = await import('./agenteSessionFinisher');
  const { patchAgenteConfig } = await import('@/shared/config/agenteConfigStore');
  await patchAgenteConfig({ streamingEnabled: true });
  const evaluate = vi.spyOn(agenteSessionFinisher, 'evaluate').mockResolvedValue(undefined);

  const settle = async () => {
    await vi.advanceTimersByTimeAsync(10);
    await vi.advanceTimersByTimeAsync(10);
  };
  const dispatch = async (event: MeetingEvent) => {
    const result = await sessionController.dispatch(event);
    await settle();
    return result;
  };
  /** m1 com falas, vinculada pelo seletor (linked) — a que o agendador pode encerrar. */
  const linkedMeeting = async () => {
    await dispatch(detected('m1'));
    await dispatch(caption('olá tudo bem'));
    await store.applyAssociationEvent('m1', { type: 'link-started', origin: 'picker', clientName: 'ACME', sessionId: SESSION_ID });
    await store.applyAssociationEvent('m1', { type: 'link-completed', seedSent: {} });
  };
  return { mock, sessionController, store, evaluate, dispatch, settle, linkedMeeting };
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('fim e preempção da reunião avisam o agendador (B4-b)', () => {
  it('reunião vinculada (linked, picker) termina -> evaluate("m1") uma vez', async () => {
    const { dispatch, linkedMeeting, evaluate } = await fresh();
    await linkedMeeting();
    expect(evaluate).not.toHaveBeenCalled();
    await dispatch({ type: 'MEETING_FINISHED', at: 5000 });
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(evaluate).toHaveBeenCalledWith('m1');
  });

  it('reunião vinculada preemptada por outra sala -> evaluate("m1") e a pending da m2 nasce', async () => {
    const { dispatch, linkedMeeting, evaluate, store } = await fresh();
    await linkedMeeting();
    await dispatch(detected('m2', 'zzz-zzzz-zzz', 2000));
    expect(evaluate).toHaveBeenCalledWith('m1');
    expect((await store.getAssociation('m2'))?.state).toBe('pending');
  });

  it('o gancho não espera o agendador: com um evaluate que nunca resolve, a associação da reunião seguinte nasce mesmo assim (T-08-53)', async () => {
    const { dispatch, linkedMeeting, evaluate, store } = await fresh();
    evaluate.mockImplementation(() => new Promise<void>(() => undefined));
    await linkedMeeting();
    await dispatch(detected('m2', 'zzz-zzzz-zzz', 2000));
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(await store.getAssociation('m2')).toEqual({ meetingId: 'm2', state: 'pending' });
  });

  it('um evaluate que rejeita só vai para o log: o dispatch devolve o estado e a associação nova nasce', async () => {
    const { dispatch, linkedMeeting, evaluate, store } = await fresh();
    const { logger } = await import('@/shared/services/log');
    const logSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    evaluate.mockRejectedValue(new Error('boom'));
    await linkedMeeting();
    await dispatch(detected('m2', 'zzz-zzzz-zzz', 2000));
    expect(logSpy).toHaveBeenCalled();
    expect((await store.getAssociation('m2'))?.state).toBe('pending');
  });

  it('ended-unsent termina -> evaluate é chamado (o agendador ignora pela elegibilidade, 08-16/08-27)', async () => {
    const { dispatch, evaluate } = await fresh();
    await dispatch(detected('m1'));
    await dispatch(caption('olá tudo bem'));
    await dispatch({ type: 'MEETING_FINISHED', at: 5000 });
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(evaluate).toHaveBeenCalledWith('m1');
  });

  it('pending com 0 falas: a associação é removida e o evaluate NÃO é chamado', async () => {
    const { dispatch, evaluate, store } = await fresh();
    await dispatch(detected('m1'));
    await dispatch({ type: 'MEETING_FINISHED', at: 5000 });
    expect(await store.getAssociation('m1')).toBeNull();
    expect(evaluate).not.toHaveBeenCalled();
  });

  it('reunião sem associação (envio desligado): nada é avisado', async () => {
    const { dispatch, evaluate, store } = await fresh();
    const { patchAgenteConfig } = await import('@/shared/config/agenteConfigStore');
    await patchAgenteConfig({ streamingEnabled: false });
    await dispatch(detected('m1'));
    await dispatch({ type: 'MEETING_FINISHED', at: 5000 });
    expect(await store.getAssociation('m1')).toBeNull();
    expect(evaluate).not.toHaveBeenCalled();
  });
});

describe('aba da reunião fechada no meio da call (08-26) acaba na avaliação do encerramento', () => {
  it('aba fechada -> MEETING_FINISHED pelo handler do 08-26 -> evaluate("m1")', async () => {
    const { sessionController, linkedMeeting, evaluate, settle } = await fresh();
    const { onMeetingTabRemoved } = await import('./meetingTabClosed');
    await linkedMeeting();
    await onMeetingTabRemoved(7, {
      getState: sessionController.getState,
      dispatch: sessionController.dispatch,
      now: () => 9000,
    });
    await settle();
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(evaluate).toHaveBeenCalledWith('m1');
  });
});

function parts(count: number): UploadPart[] {
  return Array.from({ length: count }, (_, index) => ({
    index,
    key: `${index}:c${index}`,
    chunkId: `bulk:m1:${index}`,
    text: `fala numero ${index}`,
    speaker: 'Ana',
    words: 3,
  }));
}

/** O envio em partes de verdade, com associação semeada e `send`/`sleep` falsos. */
async function bindUpload(startEvents: 'live' | 'ended', status = 202) {
  vi.useRealTimers();
  installChromeStorageMock({});
  const { runBindUpload } = await import('./agenteBindUpload');
  const store = await import('@/shared/config/agenteAssociationStore');
  await store.applyAssociationEvent('m1', { type: 'created' });
  if (startEvents === 'ended') {
    await store.applyAssociationEvent('m1', { type: 'meeting-ended' });
    await store.applyAssociationEvent('m1', { type: 'send-started', origin: 'picker', clientName: 'ACME', sessionId: SESSION_ID });
  } else {
    await store.applyAssociationEvent('m1', { type: 'link-started', origin: 'picker', clientName: 'ACME', sessionId: SESSION_ID });
  }
  const calls: string[] = [];
  const seenStates: (string | undefined)[] = [];
  const onSettled = vi.fn(async (meetingId: string) => {
    calls.push(`settled:${meetingId}`);
    seenStates.push((await store.getAssociation(meetingId))?.state);
  });
  const onLinked = vi.fn(async () => void calls.push('linked'));
  const send = vi.fn<(request: ExtensionChunkRequest) => Promise<Response>>(
    async () => ({ ok: status < 400, status }) as Response,
  );
  const run = (overrides: { onSettled?: typeof onSettled } = {}) =>
    runBindUpload(
      { loadConfig: () => Promise.resolve(READY_CONFIG), send, sleep: () => Promise.resolve(), onLinked, onSettled, ...overrides },
      'm1',
      SESSION_ID,
      parts(2),
    );
  return { run, onSettled, onLinked, calls, seenStates, store };
}

describe('fim do envio em partes avisa o encerramento (onSettled, B4-b)', () => {
  it('reunião encerrada com o envio concluído -> onSettled("m1") uma vez, com a associação já em sent', async () => {
    const { run, onSettled, seenStates } = await bindUpload('ended');
    await run();
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(onSettled).toHaveBeenCalledWith('m1');
    await vi.waitFor(() => expect(seenStates).toEqual(['sent']));
  });

  it('envio parado por recusa definitiva -> onSettled uma vez, DEPOIS de aplicar send-failed', async () => {
    const { run, onSettled, seenStates } = await bindUpload('ended', 400);
    await run();
    expect(onSettled).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(seenStates).toEqual(['send-failed']));
  });

  it('vínculo ao vivo concluído -> onSettled depois de onLinked', async () => {
    const { run, calls, seenStates } = await bindUpload('live');
    await run();
    await vi.waitFor(() => expect(calls).toEqual(['linked', 'settled:m1']));
    await vi.waitFor(() => expect(seenStates).toEqual(['linked']));
  });

  it('vínculo ao vivo parado -> onSettled uma vez, depois de aplicar link-failed, sem onLinked', async () => {
    const { run, onLinked, onSettled, seenStates } = await bindUpload('live', 400);
    await run();
    expect(onLinked).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(seenStates).toEqual(['send-failed']));
  });

  it('onSettled que rejeita: o envio em partes não falha e o erro vai para o log', async () => {
    const { run } = await bindUpload('ended');
    const { logger } = await import('@/shared/services/log');
    const logSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    await expect(run({ onSettled: vi.fn(() => Promise.reject(new Error('boom'))) })).resolves.toBeUndefined();
    await vi.waitFor(() => expect(logSpy).toHaveBeenCalled());
  });

  it('onSettled que nunca resolve: o envio em partes termina mesmo assim (não espera o agendador)', async () => {
    const { run } = await bindUpload('ended');
    await expect(run({ onSettled: vi.fn(() => new Promise<void>(() => undefined)) })).resolves.toBeUndefined();
  });

  it('sem onSettled (dependência opcional) nada muda', async () => {
    const { run, store } = await bindUpload('ended');
    await run({ onSettled: undefined });
    expect((await store.getAssociation('m1'))?.state).toBe('sent');
  });
});
