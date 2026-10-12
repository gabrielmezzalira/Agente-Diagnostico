/**
 * Kick dedicado do envio (plano 08-27, Task 1, B4-b, D-18): `kickAgenteSender()` dá nova tentativa de
 * entrega à fila durável em QUALQUER estado da reunião. O `reevaluate` do streamer pararia antes do
 * kick quando a reunião atual não tem destino (pending, sent, send-failed...); o kick dedicado não
 * depende disso, só do portão `canDrain` da política ativa. Streamer real, fila em memória, send falso.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgenteConfig, ExtensionChunkRequest } from '@/shared/config/agenteConfig';
import type { AssociationState, MeetingAssociation } from '@/features/agente/association';
import type { OutboxItem } from '@/features/agente/outbox';
import { createAssociationDestination } from './agenteStreamDestination';
import { createMemorySendQueue } from './agenteSendQueue';
import { configureAgenteStreamer, kickAgenteSender, whenAgenteStreamerIdle } from './agenteStreamer';

const AGENTE_URL = 'https://agente.test';
const S1 = '11111111-1111-1111-1111-111111111111';
const READY: AgenteConfig = {
  agenteBackendUrl: AGENTE_URL,
  streamingEnabled: true,
  agenteSessionId: '',
  agenteApiKey: 's3cr3t',
  confirmedMeetingId: '',
};

const stuckItem: OutboxItem = {
  chunkId: 'c1',
  backendUrl: AGENTE_URL,
  sessionId: S1,
  text: 'fala parada',
  speaker: 'Ana',
  enqueuedAt: 1,
};

/** O streamer real, com a política da associação lendo a associação (falsa) da reunião ATUAL. */
async function setup(config: AgenteConfig, currentMeeting: MeetingAssociation | null) {
  const queue = createMemorySendQueue();
  await queue.append([stuckItem]);
  const send = vi.fn<(request: ExtensionChunkRequest) => Promise<Response>>(() =>
    Promise.resolve({ ok: true, status: 202 } as Response),
  );
  const settleStatusAfterRestart = vi.fn(() => Promise.resolve());
  const snapshot = {
    load: vi.fn(() => Promise.resolve(null)),
    save: vi.fn(() => Promise.resolve()),
    clear: vi.fn(() => Promise.resolve()),
  };
  const reportStatus = {
    writeSendOutcome: vi.fn(),
    writeWaiting: vi.fn(),
    writeDelivery: vi.fn(),
    recordDropped: vi.fn(),
  };
  configureAgenteStreamer({
    loadConfig: () => Promise.resolve(config),
    send,
    outbox: queue,
    snapshot,
    reportStatus,
    settleStatusAfterRestart,
    onConfigChange: undefined,
    destination: createAssociationDestination({
      getAssociation: () => Promise.resolve(currentMeeting),
      clearSeed: () => Promise.resolve(),
    }),
  });
  return { queue, send, settleStatusAfterRestart, snapshot, reportStatus };
}

const associationIn = (state: AssociationState): MeetingAssociation => ({
  meetingId: 'm2',
  state,
  sessionId: S1,
  origin: 'picker',
});

const bodyOf = (send: ReturnType<typeof vi.fn>) =>
  JSON.parse(String((send.mock.calls[0]?.[0] as ExtensionChunkRequest).init.body)) as {
    session_id: string;
    text: string;
  };

afterEach(() => {
  configureAgenteStreamer({}); // descarta a instância deixada pelo teste
});

describe('kickAgenteSender: nova tentativa da fila durável em qualquer estado da reunião', () => {
  it('outra reunião ao vivo, com associação pending -> a fala parada da sessão S1 é tentada', async () => {
    const fake = await setup(READY, { meetingId: 'm2', state: 'pending' });

    await kickAgenteSender();
    await whenAgenteStreamerIdle();

    expect(fake.send).toHaveBeenCalledTimes(1);
    expect(bodyOf(fake.send)).toMatchObject({ session_id: S1, text: 'fala parada' });
    // `whenAgenteStreamerIdle` não espera a resposta de rede: a fala só sai da fila quando o send confirma.
    await vi.waitFor(async () => expect(await fake.queue.load()).toEqual([]));
  });

  it.each<AssociationState>(['sent', 'send-failed'])(
    'associação da última reunião em %s (destino idle) -> também empurra a fila',
    async (state) => {
      const fake = await setup(READY, associationIn(state));

      await kickAgenteSender();
      await whenAgenteStreamerIdle();

      expect(fake.send).toHaveBeenCalledTimes(1);
      expect(bodyOf(fake.send)).toMatchObject({ session_id: S1 });
    },
  );

  it('envio desligado -> não chama o send (portão canDrain) e a fila continua intacta', async () => {
    const fake = await setup({ ...READY, streamingEnabled: false }, { meetingId: 'm2', state: 'pending' });

    await kickAgenteSender();
    await whenAgenteStreamerIdle();

    expect(fake.send).not.toHaveBeenCalled();
    expect(await fake.queue.load()).toHaveLength(1);
  });

  it('URL do backend inválida -> não chama o send', async () => {
    const fake = await setup(
      { ...READY, agenteBackendUrl: 'http://nao-e-loopback.test' },
      { meetingId: 'm2', state: 'pending' },
    );

    await kickAgenteSender();
    await whenAgenteStreamerIdle();

    expect(fake.send).not.toHaveBeenCalled();
  });

  it('não mexe no status de reinício, no cursor nem nas falas da janela', async () => {
    const fake = await setup(READY, { meetingId: 'm2', state: 'pending' });

    await kickAgenteSender();
    await whenAgenteStreamerIdle();

    expect(fake.settleStatusAfterRestart).not.toHaveBeenCalled();
    expect(fake.reportStatus.writeWaiting).not.toHaveBeenCalled();
    expect(fake.snapshot.load).not.toHaveBeenCalled();
    expect(fake.snapshot.save).not.toHaveBeenCalled();
    expect(fake.snapshot.clear).not.toHaveBeenCalled();
  });
});
