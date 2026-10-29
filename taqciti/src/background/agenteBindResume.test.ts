/**
 * "Continuar envio" com o encerramento da sessão em voo (Fase 10, plano 10-01, D-02 / WR-05).
 *
 * Se o agendador do encerramento (`agenteSessionFinisher`) está fechando a sessão desta reunião, o
 * "Continuar envio" é recusado em silêncio (`invalid-state`, D-18) ANTES de gravar `send-resumed` —
 * que apagaria o prazo de encerramento (`finishBy`, `finishTries`, `finishGaveUp`). Fora dessa janela
 * o botão segue como sempre (inclusive com a sessão já encerrada, DA-2).
 *
 * Os testes de composição usam a raiz de produção (`agenteAssociation`) com portas falsas e SEM injetar
 * `isClosing`: o que liga o serviço ao agendador é a própria composição, e é ela que se prova aqui.
 * Fixtures próprios (cópia mínima das formas de `agenteBindFlow.test.ts`) — nada é importado de outro teste.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeStorageMock } from '@/test/chromeStorageMock';
import type { applyAssociationEvent } from '@/shared/config/agenteAssociationStore';
import type { AgenteConfig } from '@/shared/config/agenteConfig';
import { IDLE_STATE } from '@/shared/types/domain';
import type { LiveSegment, MeetingRecord } from '@/shared/types/domain';

const SESSION_ID = '22222222-2222-2222-2222-222222222222';
/** Prazo de encerramento armado antes do "Continuar envio" (valor fixo: só precisa sobreviver intacto). */
const FINISH_BY = 1_700_000_000_000;

const READY_CONFIG: AgenteConfig = {
  agenteBackendUrl: 'http://127.0.0.1:8000',
  streamingEnabled: true,
  agenteSessionId: '',
  agenteApiKey: 's3cr3t',
  confirmedMeetingId: '',
};

function segmentsOf(count: number): LiveSegment[] {
  return Array.from({ length: count }, (_, index) => ({
    captionId: `c${index}`,
    speaker: 'Ana',
    text: `fala numero ${index}`,
    startOffsetMs: index * 1000,
    endOffsetMs: index * 1000 + 500,
  }));
}

const recordOf = (meetingId: string, count = 10): MeetingRecord =>
  ({ id: meetingId, title: 'Reunião guardada', segments: segmentsOf(count) }) as MeetingRecord;

/**
 * Sequência de eventos do store: reunião encerrada, envio manual parado na parte 4 de 10 (`send-failed`).
 * Recebe o `applyAssociationEvent` da MESMA instância de módulo do cenário (depois do `resetModules`).
 */
async function stopSendAt(apply: typeof applyAssociationEvent) {
  await apply('m2', { type: 'created' });
  await apply('m2', { type: 'meeting-ended' });
  await apply('m2', {
    type: 'send-started',
    origin: 'manual-id',
    clientName: 'Sessão 22222222',
    sessionId: SESSION_ID,
  });
  await apply('m2', { type: 'send-progress', done: 4, total: 10 });
  await apply('m2', { type: 'send-failed', error: 'send' });
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe('agenteAssociation.resumeSend — D-02 (WR-05), composição real', () => {
  /**
   * Imports dinâmicos DENTRO do cenário (depois do `resetModules`): a composição, o agendador e o store
   * precisam ser a mesma instância de módulo. `isClosing` NÃO é injetado — vem do `activeDeps` de produção.
   */
  async function composeStoppedSend() {
    installChromeStorageMock({
      extra: {
        runtime: { sendMessage: vi.fn(() => Promise.resolve()) },
        tabs: { sendMessage: vi.fn(() => Promise.resolve()) },
      },
    });
    const { createFakeClientDirectory, createFakeSessionGateway } =
      await import('@/test/fakeClientDirectory');
    const { agenteAssociation, configureAgenteAssociation } = await import('./agenteAssociation');
    const { agenteSessionFinisher } = await import('./agenteSessionFinisher');
    const store = await import('@/shared/config/agenteAssociationStore');
    const send = vi.fn(() => Promise.resolve({ ok: true, status: 202 } as Response));
    configureAgenteAssociation({
      directory: createFakeClientDirectory([]),
      sessions: createFakeSessionGateway(),
      getMeetingState: () => IDLE_STATE,
      getRecord: () => Promise.resolve(recordOf('m2')),
      loadConfig: () => Promise.resolve(READY_CONFIG),
      send,
      sleep: () => Promise.resolve(),
      onSettled: () => Promise.resolve(),
    });
    await stopSendAt(store.applyAssociationEvent);
    await store.applyAssociationEvent('m2', { type: 'finish-armed', by: FINISH_BY });
    await store.applyAssociationEvent('m2', { type: 'finish-failed' });
    return { agenteAssociation, agenteSessionFinisher, store, send };
  }

  it('com o encerramento em voo: recusa invalid-state, não envia e mantém finishBy e finishTries', async () => {
    const { agenteAssociation, agenteSessionFinisher, store, send } = await composeStoppedSend();
    vi.spyOn(agenteSessionFinisher, 'isClosing').mockReturnValue(true);

    expect(await agenteAssociation.resumeSend('m2')).toEqual({ ok: false, error: 'invalid-state' });

    expect(send).not.toHaveBeenCalled();
    expect(await store.getAssociation('m2')).toMatchObject({
      state: 'send-failed',
      finishBy: FINISH_BY,
      finishTries: 1,
    });
  });

  it('confere o encerramento da reunião certa (isClosing recebe m2)', async () => {
    const { agenteAssociation, agenteSessionFinisher } = await composeStoppedSend();
    const closing = vi.spyOn(agenteSessionFinisher, 'isClosing').mockReturnValue(true);

    await agenteAssociation.resumeSend('m2');

    expect(closing).toHaveBeenCalledWith('m2');
  });

  it('controle — sem encerramento em voo: retoma da parte 4 para a mesma sessão e termina em sent', async () => {
    const { agenteAssociation, agenteSessionFinisher, store, send } = await composeStoppedSend();
    vi.spyOn(agenteSessionFinisher, 'isClosing').mockReturnValue(false);

    expect(await agenteAssociation.resumeSend('m2')).toEqual({ ok: true });

    await vi.waitFor(async () => expect((await store.getAssociation('m2'))?.state).toBe('sent'));
    expect(send).toHaveBeenCalledTimes(6); // partes 4..9
  });
});
