/**
 * O agendador do encerramento da sessão (plano 08-27, Task 2, B4-b): encerrar na hora com a fila vazia,
 * esperar a última fala, prazo de 5 min com envio parado, backoff limitado e desistência sem laço.
 * Portas falsas (finisher, alarmes, relógio, sleep, fila, estado da reunião); o store de associações é o
 * real sobre `chrome.storage` simulado.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeStorageMock } from '@/test/chromeStorageMock';
import type { AssociationEvent, AssociationOrigin } from '@/features/agente/association';
import { AGENTE_FINISH_ALARM_PREFIX, type FinishOutcome } from '@/features/agente/finishPolicy';

const T0 = 1_000_000;
const S1 = '11111111-1111-1111-1111-111111111111';
const ALARM = (meetingId: string) => `${AGENTE_FINISH_ALARM_PREFIX}${meetingId}`;
const MIN = 60_000;
const HOUR = 60 * MIN;
const BACKOFF = [30_000, MIN, 2 * MIN, 4 * MIN, 8 * MIN, 30 * MIN, HOUR, 2 * HOUR, 4 * HOUR, 8 * HOUR];

type SeedState = 'linked' | 'sent' | 'send-failed';
const FLOWS: Record<SeedState, AssociationEvent[]> = {
  linked: [{ type: 'link-completed', seedSent: {} }],
  sent: [{ type: 'meeting-ended' }, { type: 'send-completed', seedSent: {} }],
  'send-failed': [{ type: 'meeting-ended' }, { type: 'send-failed', error: 'send' }],
};

async function boot() {
  vi.resetModules();
  installChromeStorageMock();
  const store = await import('@/shared/config/agenteAssociationStore');
  const { logger } = await import('@/shared/services/log');
  // Depois do resetModules a classe do instance é outra: o erro do teste tem que vir do mesmo registro.
  const { AgenteFinishError } = await import('@/features/agente/finishPolicy');
  const { createAgenteSessionFinisher } = await import('./agenteSessionFinisherInstance');
  const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
  let clock = T0;
  let live = false;
  let counts: number[] = [0];
  const finishSession = vi.fn<(id: string) => Promise<FinishOutcome>>(() => Promise.resolve('finished'));
  const sleep = vi.fn((ms: number): Promise<void> => Promise.resolve().then(() => void (clock += ms)));
  const alarms = { create: vi.fn(() => Promise.resolve()), clear: vi.fn(() => Promise.resolve()) };
  const whenStreamerIdle = vi.fn(() => Promise.resolve());
  const nudgeDelivery = vi.fn(() => Promise.resolve());
  const countQueued = vi.fn(() => Promise.resolve(counts.length > 1 ? (counts.shift() as number) : (counts[0] as number)));
  const applyEvent = vi.fn(store.applyAssociationEvent);
  const finisher = createAgenteSessionFinisher({
    finisher: { finishSession },
    alarms,
    now: () => clock,
    sleep,
    isMeetingLive: () => live,
    countQueued,
    whenStreamerIdle,
    nudgeDelivery,
    getAssociation: store.getAssociation,
    loadAssociations: store.loadAssociations,
    applyEvent,
  });
  async function seed(meetingId: string, state: SeedState = 'linked', origin: AssociationOrigin = 'picker') {
    const apply = (event: AssociationEvent) => store.applyAssociationEvent(meetingId, event);
    await apply({ type: 'created' });
    if (state === 'linked') await apply({ type: 'link-started', origin, clientName: 'ACME', sessionId: S1 });
    else {
      await apply({ type: 'meeting-ended' });
      await apply({ type: 'send-started', origin, clientName: 'ACME', sessionId: S1 });
    }
    for (const event of FLOWS[state].filter((e) => state === 'linked' || e.type !== 'meeting-ended')) await apply(event);
  }
  return {
    finisher, finishSession, AgenteFinishError, sleep, alarms, whenStreamerIdle, nudgeDelivery, countQueued, applyEvent, warn,
    seed, get: store.getAssociation, apply: store.applyAssociationEvent,
    clock: () => clock, advance: (ms: number) => void (clock += ms),
    setLive: (value: boolean) => void (live = value), setCounts: (...values: number[]) => void (counts = values),
  };
}
type Rig = Awaited<ReturnType<typeof boot>>;
let rig: Rig;
beforeEach(async () => {
  rig = await boot();
});

describe('encerrar na hora (B4-b)', () => {
  it('(a) picker linked, reunião encerrada, fila vazia -> finishSession uma vez e sessionFinished', async () => {
    await rig.seed('m1');
    await rig.finisher.evaluate('m1');
    expect(rig.finishSession.mock.calls).toEqual([[S1]]);
    expect(await rig.get('m1')).toMatchObject({ sessionFinished: true });
    expect(rig.alarms.create).not.toHaveBeenCalled();
  });

  it('(b) origin manual-id -> nada chamado e nenhum alarme', async () => {
    await rig.seed('m1', 'linked', 'manual-id');
    await rig.finisher.evaluate('m1');
    expect(rig.finishSession).not.toHaveBeenCalled();
    expect(rig.alarms.create).not.toHaveBeenCalled();
  });

  it('(c) associação já com sessionFinished -> nada', async () => {
    await rig.seed('m1');
    await rig.apply('m1', { type: 'session-finished' });
    await rig.finisher.evaluate('m1');
    expect(rig.finishSession).not.toHaveBeenCalled();
  });

  it('(d) reunião ao vivo -> nada chamado e o alarme da reunião é limpo', async () => {
    await rig.seed('m1');
    rig.setLive(true);
    await rig.finisher.evaluate('m1');
    expect(rig.finishSession).not.toHaveBeenCalled();
    expect(rig.alarms.clear).toHaveBeenCalledWith(ALARM('m1'));
  });

  it('(e) última fala em voo: espera o streamer e a fila zerar antes do finish', async () => {
    await rig.seed('m1');
    rig.setCounts(1, 1, 0);
    await rig.finisher.evaluate('m1');
    expect(rig.sleep).toHaveBeenCalledTimes(2);
    expect(rig.whenStreamerIdle.mock.invocationCallOrder[0]).toBeLessThan(rig.sleep.mock.invocationCallOrder[0] as number);
    expect(rig.sleep.mock.invocationCallOrder[1]).toBeLessThan(rig.finishSession.mock.invocationCallOrder[0] as number);
  });

  it('(l) gone -> session-finished aplicado e alarme limpo', async () => {
    await rig.seed('m1');
    rig.finishSession.mockResolvedValue('gone');
    await rig.finisher.evaluate('m1');
    expect(await rig.get('m1')).toMatchObject({ sessionFinished: true });
    expect(rig.alarms.clear).toHaveBeenCalledWith(ALARM('m1'));
  });
});

describe('fila parada: prazo de 5 minutos (B4-b)', () => {
  it('(f) fila não zera dentro da graça -> arma finishBy (+5 min), alarme em +30 s, kick, sem finish', async () => {
    await rig.seed('m1', 'sent');
    rig.setCounts(1);
    await rig.finisher.evaluate('m1');
    const armedAt = T0 + 10_000; // a graça de 10 s já passou quando o prazo é armado
    expect(rig.sleep).toHaveBeenCalledTimes(10);
    expect((await rig.get('m1'))?.finishBy).toBe(armedAt + 5 * MIN);
    expect(rig.alarms.create).toHaveBeenCalledWith(ALARM('m1'), armedAt + 30_000);
    expect(rig.nudgeDelivery).toHaveBeenCalledTimes(1);
    expect(rig.finishSession).not.toHaveBeenCalled();
  });

  it('(g) o alarme dispara e a fila já esvaziou -> encerra antes do prazo', async () => {
    await rig.seed('m1');
    rig.setCounts(1);
    await rig.finisher.evaluate('m1');
    rig.setCounts(0);
    await rig.finisher.handleAlarm(ALARM('m1'));
    expect(rig.finishSession).toHaveBeenCalledTimes(1);
  });

  it('(h) o alarme dispara depois do finishBy com a fila ainda cheia -> encerra sem esperar a graça', async () => {
    await rig.seed('m1');
    rig.setCounts(1);
    await rig.finisher.evaluate('m1');
    const sleeps = rig.sleep.mock.calls.length;
    rig.advance(5 * MIN);
    await rig.finisher.handleAlarm(ALARM('m1'));
    expect(rig.finishSession).toHaveBeenCalledTimes(1);
    expect(rig.sleep.mock.calls.length).toBe(sleeps);
  });

  it('(i) send-failed -> arma o prazo sem esperar a fila; alarme em +30 s; depois de 5 min encerra', async () => {
    await rig.seed('m1', 'send-failed');
    await rig.finisher.evaluate('m1');
    expect(rig.sleep).not.toHaveBeenCalled();
    expect(rig.countQueued).not.toHaveBeenCalled();
    expect(rig.nudgeDelivery).not.toHaveBeenCalled();
    expect(rig.alarms.create).toHaveBeenCalledWith(ALARM('m1'), T0 + 30_000);
    expect(rig.finishSession).not.toHaveBeenCalled();
    rig.advance(5 * MIN);
    await rig.finisher.handleAlarm(ALARM('m1'));
    expect(rig.finishSession).toHaveBeenCalledTimes(1);
  });

  it('(p) finishBy já no passado (reinício do navegador) -> finish imediato, sem a graça', async () => {
    await rig.seed('m1');
    await rig.apply('m1', { type: 'finish-armed', by: T0 - 1 });
    rig.setCounts(5);
    await rig.finisher.evaluate('m1');
    expect(rig.finishSession).toHaveBeenCalledTimes(1);
    expect(rig.countQueued).not.toHaveBeenCalled();
    expect(rig.sleep).not.toHaveBeenCalled();
  });
});

describe('falha, repetição e desistência (T-08-49)', () => {
  const retryable = () => new rig.AgenteFinishError('falhou', { retryable: true, httpStatus: 503 });

  it('(j) erro retryable: alarme na espera da tabela e, na 11ª falha, desiste sem 12ª chamada', async () => {
    await rig.seed('m1');
    rig.finishSession.mockRejectedValue(retryable());
    for (let i = 0; i < 10; i += 1) {
      await rig.finisher.evaluate('m1');
      expect(rig.alarms.create).toHaveBeenLastCalledWith(ALARM('m1'), rig.clock() + (BACKOFF[i] as number));
      rig.advance(BACKOFF[i] as number);
    }
    await rig.finisher.evaluate('m1');
    expect(await rig.get('m1')).toMatchObject({ finishTries: 11, finishGaveUp: true });
    expect(rig.alarms.clear).toHaveBeenLastCalledWith(ALARM('m1'));
    expect(rig.warn).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ meetingId: 'm1' }));
    await rig.finisher.evaluate('m1');
    await rig.finisher.handleAlarm(ALARM('m1'));
    expect(rig.finishSession).toHaveBeenCalledTimes(11);
  });

  it('(k) recusa definitiva (401) -> desiste de uma vez, sem alarme e sem segunda chamada', async () => {
    await rig.seed('m1');
    rig.finishSession.mockRejectedValue(new rig.AgenteFinishError('401', { retryable: false, httpStatus: 401 }));
    await rig.finisher.evaluate('m1');
    await rig.finisher.evaluate('m1');
    expect(rig.finishSession).toHaveBeenCalledTimes(1);
    expect(await rig.get('m1')).toMatchObject({ finishGaveUp: true });
    expect(rig.alarms.create).not.toHaveBeenCalled();
  });
});

describe('concorrência, boot e reentrada', () => {
  it('(m) duas avaliações simultâneas -> uma só chamada; isClosing só durante a chamada', async () => {
    await rig.seed('m1');
    let release: (outcome: FinishOutcome) => void = () => undefined;
    rig.finishSession.mockReturnValue(new Promise<FinishOutcome>((resolve) => (release = resolve)));
    const first = rig.finisher.evaluate('m1');
    const second = rig.finisher.evaluate('m1');
    await vi.waitFor(() => expect(rig.finisher.isClosing('m1')).toBe(true));
    release('finished');
    await Promise.all([first, second]);
    expect(rig.finishSession).toHaveBeenCalledTimes(1);
    expect(rig.finisher.isClosing('m1')).toBe(false);
  });

  it('(n) boot: só a associação elegível é avaliada, uma de cada vez; quem desistiu NÃO é retomado aqui (CR-02)', async () => {
    await rig.seed('m1');
    await rig.seed('m2');
    await rig.apply('m2', { type: 'session-finished' });
    await rig.seed('m3', 'linked', 'manual-id');
    await rig.seed('m4');
    await rig.apply('m4', { type: 'finish-failed', definitive: true });
    let inFlight = 0;
    let maxInFlight = 0;
    rig.finishSession.mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      return 'finished';
    });
    await rig.finisher.rescheduleAfterRestart();
    expect(rig.finishSession).toHaveBeenCalledTimes(1);
    expect(maxInFlight).toBe(1);
    expect(await rig.get('m4')).toMatchObject({ finishGaveUp: true });
    // O service worker acorda a todo momento: acordar de novo (e de novo) nunca reabre a rodada de quem desistiu.
    await rig.finisher.rescheduleAfterRestart();
    await rig.finisher.rescheduleAfterRestart();
    expect(rig.finishSession).toHaveBeenCalledTimes(1);
  });

  it('(n2) DA-5: a abertura do navegador dá UMA rodada nova a quem desistiu; falhando de novo, desiste de novo e não gira', async () => {
    await rig.seed('m1');
    await rig.apply('m1', { type: 'finish-failed', definitive: true });
    expect(await rig.get('m1')).toMatchObject({ finishGaveUp: true });
    rig.finishSession.mockRejectedValue(new rig.AgenteFinishError('401', { retryable: false, httpStatus: 401 }));
    await rig.finisher.restartGaveUpRounds();
    expect(rig.finishSession).toHaveBeenCalledTimes(1);
    expect(await rig.get('m1')).toMatchObject({ finishGaveUp: true });
    await rig.finisher.evaluate('m1');
    await rig.finisher.handleAlarm(ALARM('m1'));
    await rig.finisher.rescheduleAfterRestart();
    expect(rig.finishSession).toHaveBeenCalledTimes(1);
  });

  it('(n3) DA-5: nova rodada bem-sucedida encerra a sessão; encerradas, do plano B e não desistidas ficam de fora', async () => {
    await rig.seed('m1');
    await rig.apply('m1', { type: 'finish-failed', definitive: true });
    await rig.seed('m2', 'linked', 'manual-id');
    await rig.apply('m2', { type: 'finish-failed', definitive: true });
    await rig.seed('m3');
    await rig.finisher.restartGaveUpRounds();
    expect(rig.finishSession).toHaveBeenCalledTimes(1);
    expect(await rig.get('m1')).toMatchObject({ sessionFinished: true });
    expect(await rig.get('m3')).not.toMatchObject({ sessionFinished: true });
  });

  it('(o) a reunião volta ao vivo entre a graça e a chamada -> finishSession não é chamado', async () => {
    await rig.seed('m1');
    rig.setCounts(1, 0);
    rig.sleep.mockImplementationOnce(() => {
      rig.setLive(true);
      return Promise.resolve();
    });
    await rig.finisher.evaluate('m1');
    expect(rig.sleep).toHaveBeenCalledTimes(1);
    expect(rig.finishSession).not.toHaveBeenCalled();
  });

  it('a reunião volta ao vivo durante a graça com a fila cheia -> nenhum prazo é armado', async () => {
    await rig.seed('m1');
    rig.setCounts(1);
    rig.sleep.mockImplementationOnce(() => {
      rig.setLive(true);
      return Promise.resolve();
    });
    await rig.finisher.evaluate('m1');
    // a espera continua até a graça acabar; ao final a sala está ao vivo: nada de prazo nem de finish
    expect((await rig.get('m1'))?.finishBy).toBeUndefined();
    expect(rig.alarms.create).not.toHaveBeenCalled();
    expect(rig.finishSession).not.toHaveBeenCalled();
  });

  it('(r) a mesma reunião volta ao vivo com o finish em voo -> além de session-finished, aplica meeting-resumed', async () => {
    await rig.seed('m1', 'sent');
    rig.finishSession.mockImplementation(() => {
      rig.setLive(true);
      return Promise.resolve('finished');
    });
    await rig.finisher.evaluate('m1');
    const types = rig.applyEvent.mock.calls.map(([, event]) => event.type);
    expect(types.slice(-2)).toEqual(['session-finished', 'meeting-resumed']);
  });

  it('handleAlarm ignora nomes sem o prefixo', async () => {
    await rig.seed('m1');
    await rig.finisher.handleAlarm('outro-alarme:m1');
    expect(rig.finishSession).not.toHaveBeenCalled();
  });
});
