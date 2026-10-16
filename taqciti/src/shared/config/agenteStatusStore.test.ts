/**
 * O status de runtime do envio ao Agente em DUAS chaves de storage.session, cada uma com um
 * único dono (WR-02, 3ª revisão). Os testes cobrem o jeito real de falhar do desenho antigo
 * (um objeto só, read-modify-write entre tela e service worker), não propriedades abstratas.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '@/shared/config/constants';
import { installChromeStorageMock } from '@/test/chromeStorageMock';
import { EMPTY_AGENTE_STATUS, type AgenteStreamingStatus } from './agenteStatus';

beforeEach(() => {
  vi.resetModules();
});

async function fresh(session: Record<string, unknown> = {}) {
  const mock = installChromeStorageMock({ session });
  const store = await import('./agenteStatusStore');
  return { mock, ...store };
}

const REJECTED = { lastOutcome: 'rejected', lastHttpStatus: 401, lastAttemptAt: 1 };

describe('loadAgenteStatus', () => {
  it('sem nada salvo é o status vazio', async () => {
    const { loadAgenteStatus } = await fresh();
    expect(await loadAgenteStatus()).toEqual(EMPTY_AGENTE_STATUS);
  });

  it('junta o resultado do envio e a espera por confirmação', async () => {
    const { loadAgenteStatus } = await fresh({
      [STORAGE_KEYS.agenteSendOutcome]: REJECTED,
      [STORAGE_KEYS.agenteWaiting]: { waitingMeetingId: 'm2' },
    });
    expect(await loadAgenteStatus()).toEqual({ ...REJECTED, waitingMeetingId: 'm2' });
  });
});

/*
 * Teste-semente do WR-02. Com um objeto só, o reset da tela lia o status (ainda com
 * `waitingMeetingId: 'm2'`) e gravava por cima DEPOIS do service worker ter zerado a espera:
 * o aviso "Reunião nova detectada" voltava e ficava até o service worker reiniciar.
 * Aqui a leitura da session devolve esse retrato velho em qualquer chamada — se alguma escrita
 * dependesse de ler antes, ressuscitaria o 'm2'.
 */
describe('WR-02: tela e service worker não se desfazem', () => {
  function staleReads(session: { get: ReturnType<typeof vi.fn> }) {
    session.get.mockImplementation(async () => ({
      [STORAGE_KEYS.agenteWaiting]: { waitingMeetingId: 'm2' },
      [STORAGE_KEYS.agenteSendOutcome]: REJECTED,
    }));
  }

  it('o reset da tela intercalado com o service worker zerando a espera termina com a espera zerada', async () => {
    const { mock, resetSendOutcome, writeWaitingMeeting } = await fresh({
      [STORAGE_KEYS.agenteWaiting]: { waitingMeetingId: 'm2' },
      [STORAGE_KEYS.agenteSendOutcome]: REJECTED,
    });
    staleReads(mock.session);

    await Promise.all([
      writeWaitingMeeting(null), // o service worker, depois de trocar a sessão
      resetSendOutcome(), // a tela, ao salvar a config
    ]);

    expect(mock.session.values[STORAGE_KEYS.agenteWaiting]).toEqual({ waitingMeetingId: null });
    expect(mock.session.values[STORAGE_KEYS.agenteSendOutcome]).toEqual({
      lastOutcome: null,
      lastHttpStatus: null,
      lastAttemptAt: null,
    });
  });

  it('um resultado de envio do service worker não desfaz a espera, e o reset da tela não a mexe', async () => {
    const { mock, writeSendOutcome, resetSendOutcome, writeWaitingMeeting } = await fresh();
    staleReads(mock.session);

    await Promise.all([
      writeWaitingMeeting('m3'),
      writeSendOutcome({ lastOutcome: 'sent', lastHttpStatus: 202, lastAttemptAt: 5 }),
      resetSendOutcome(),
    ]);

    expect(mock.session.values[STORAGE_KEYS.agenteWaiting]).toEqual({ waitingMeetingId: 'm3' });
  });

  it('escrever o resultado ou zerá-lo não lê o storage; a espera é escrita por valor inteiro', async () => {
    const { mock, writeSendOutcome, resetSendOutcome, writeWaitingMeeting } = await fresh();
    await writeSendOutcome({ lastOutcome: 'retrying', lastHttpStatus: null, lastAttemptAt: 1 });
    await resetSendOutcome();
    await writeWaitingMeeting('m2');
    expect(mock.session.get).not.toHaveBeenCalled();
  });

  it('as escritas do mesmo contexto saem na ordem (retrying, depois sent)', async () => {
    const { mock, writeSendOutcome } = await fresh();
    void writeSendOutcome({ lastOutcome: 'retrying', lastHttpStatus: 503, lastAttemptAt: 1 });
    await writeSendOutcome({ lastOutcome: 'sent', lastHttpStatus: 202, lastAttemptAt: 2 });
    expect(mock.session.values[STORAGE_KEYS.agenteSendOutcome]).toMatchObject({ lastOutcome: 'sent' });
  });
});

describe('markInterruptedSend (WR-04) só mexe na chave do resultado', () => {
  it('"retrying" vira "interrupted", o resto do resultado fica, e a espera não é tocada', async () => {
    const { mock, markInterruptedSend } = await fresh({
      [STORAGE_KEYS.agenteSendOutcome]: { lastOutcome: 'retrying', lastHttpStatus: 503, lastAttemptAt: 9 },
      [STORAGE_KEYS.agenteWaiting]: { waitingMeetingId: 'm2' },
    });
    await markInterruptedSend();
    expect(mock.session.values[STORAGE_KEYS.agenteSendOutcome]).toEqual({
      lastOutcome: 'interrupted',
      lastHttpStatus: 503,
      lastAttemptAt: 9,
    });
    expect(mock.session.values[STORAGE_KEYS.agenteWaiting]).toEqual({ waitingMeetingId: 'm2' });
    expect(mock.session.set).toHaveBeenCalledTimes(1);
  });

  it('resultado definitivo ou ausente não é reescrito', async () => {
    const { mock, markInterruptedSend } = await fresh({ [STORAGE_KEYS.agenteSendOutcome]: REJECTED });
    await markInterruptedSend();
    expect(mock.session.set).not.toHaveBeenCalled();

    const empty = await fresh();
    await empty.markInterruptedSend();
    expect(empty.mock.session.set).not.toHaveBeenCalled();
  });
});

describe('subscribeAgenteStatus junta as duas chaves para a tela', () => {
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('entrega o valor atual logo de cara, já com as duas partes', async () => {
    const { subscribeAgenteStatus } = await fresh({
      [STORAGE_KEYS.agenteSendOutcome]: REJECTED,
      [STORAGE_KEYS.agenteWaiting]: { waitingMeetingId: 'm2' },
    });
    const onStatus = vi.fn<(status: AgenteStreamingStatus) => void>();
    const stop = subscribeAgenteStatus(onStatus);
    await flush();
    expect(onStatus).toHaveBeenLastCalledWith({ ...REJECTED, waitingMeetingId: 'm2' });
    stop();
  });

  it('mudança numa chave mantém a outra parte', async () => {
    const { mock, subscribeAgenteStatus } = await fresh({
      [STORAGE_KEYS.agenteWaiting]: { waitingMeetingId: 'm2' },
    });
    const onStatus = vi.fn<(status: AgenteStreamingStatus) => void>();
    const stop = subscribeAgenteStatus(onStatus);
    await flush();

    await mock.session.set({ [STORAGE_KEYS.agenteSendOutcome]: REJECTED });
    expect(onStatus).toHaveBeenLastCalledWith({ ...REJECTED, waitingMeetingId: 'm2' });

    await mock.session.set({ [STORAGE_KEYS.agenteWaiting]: { waitingMeetingId: null } });
    expect(onStatus).toHaveBeenLastCalledWith({ ...REJECTED, waitingMeetingId: null });
    stop();
  });

  it('uma mudança que chega antes da leitura inicial não é sobrescrita por ela (IN-02)', async () => {
    const { mock, subscribeAgenteStatus } = await fresh({
      [STORAGE_KEYS.agenteSendOutcome]: REJECTED,
    });
    const original = mock.session.get.getMockImplementation()!;
    // A leitura inicial sai com o retrato antigo, mas só resolve depois da mudança.
    mock.session.get.mockImplementation(async (...args: unknown[]) => {
      const snapshot = await original(...(args as [string]));
      await new Promise((resolve) => setTimeout(resolve, 5));
      return snapshot;
    });
    const onStatus = vi.fn<(status: AgenteStreamingStatus) => void>();
    const stop = subscribeAgenteStatus(onStatus);

    await mock.session.set({
      [STORAGE_KEYS.agenteSendOutcome]: { lastOutcome: 'sent', lastHttpStatus: 202, lastAttemptAt: 3 },
    });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(onStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({ lastOutcome: 'sent', lastHttpStatus: 202 }),
    );
    stop();
  });

  it('parar a assinatura silencia os próximos eventos', async () => {
    const { mock, subscribeAgenteStatus } = await fresh();
    const onStatus = vi.fn();
    const stop = subscribeAgenteStatus(onStatus);
    await flush();
    onStatus.mockClear();
    stop();
    await mock.session.set({ [STORAGE_KEYS.agenteSendOutcome]: REJECTED });
    expect(onStatus).not.toHaveBeenCalled();
  });
});
