/**
 * Composição de produção do agendador do encerramento (plano 08-27, Task 3, B4-b): falha segura (sem a
 * configuração de "está ao vivo?" ninguém é encerrado), delegação à instância ativa e adaptador de alarmes
 * sobre `chrome.alarms`. O store de associações e a fila são os reais sobre `chrome.storage` simulado.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeStorageMock } from '@/test/chromeStorageMock';
import type { FinishOutcome } from '@/features/agente/finishPolicy';

const S1 = '11111111-1111-1111-1111-111111111111';
const ALARM_NAME = 'agente-finish:m1';

async function boot(withAlarms = true) {
  vi.resetModules();
  const alarms = { create: vi.fn(() => Promise.resolve()), clear: vi.fn(() => Promise.resolve(true)) };
  installChromeStorageMock({ extra: withAlarms ? { alarms } : {} });
  const store = await import('@/shared/config/agenteAssociationStore');
  const module = await import('./agenteSessionFinisher');
  const { AgenteFinishError } = await import('@/features/agente/finishPolicy');
  const finishSession = vi.fn<(id: string) => Promise<FinishOutcome>>(() => Promise.resolve('finished'));
  async function seedLinkedPicker() {
    await store.applyAssociationEvent('m1', { type: 'created' });
    await store.applyAssociationEvent('m1', {
      type: 'link-started',
      origin: 'picker',
      clientName: 'ACME',
      sessionId: S1,
    });
    await store.applyAssociationEvent('m1', { type: 'link-completed', seedSent: {} });
  }
  return { ...module, alarms, store, finishSession, AgenteFinishError, seedLinkedPicker };
}
type Rig = Awaited<ReturnType<typeof boot>>;
let rig: Rig;

describe('importar o módulo', () => {
  it('não toca em chrome.alarms (nem existindo, nem faltando)', async () => {
    const withAlarms = await boot();
    expect(withAlarms.alarms.create).not.toHaveBeenCalled();
    expect(withAlarms.alarms.clear).not.toHaveBeenCalled();
    await expect(boot(false)).resolves.toBeDefined();
  });
});

describe('falha segura e delegação', () => {
  beforeEach(async () => {
    rig = await boot();
    await rig.seedLinkedPicker();
  });

  it('sem configurar isMeetingLive (padrão de produção) -> assume ao vivo e NÃO chama o finish', async () => {
    rig.configureAgenteSessionFinisher({ finisher: { finishSession: rig.finishSession } });

    await rig.agenteSessionFinisher.evaluate('m1');

    expect(rig.finishSession).not.toHaveBeenCalled();
    expect(await rig.store.getAssociation('m1')).not.toMatchObject({ sessionFinished: true });
  });

  it('configurado com isMeetingLive falso e fila vazia -> chama o finish uma vez', async () => {
    rig.configureAgenteSessionFinisher({
      isMeetingLive: () => false,
      finisher: { finishSession: rig.finishSession },
    });

    await rig.agenteSessionFinisher.evaluate('m1');

    expect(rig.finishSession.mock.calls).toEqual([[S1]]);
    expect(await rig.store.getAssociation('m1')).toMatchObject({ sessionFinished: true });
  });

  it('o objeto delega os quatro métodos à instância ativa (vi.spyOn funciona)', async () => {
    const methods = ['evaluate', 'handleAlarm', 'rescheduleAfterRestart', 'isClosing'] as const;
    for (const method of methods) {
      const spy = vi.spyOn(rig.agenteSessionFinisher, method).mockImplementation((() => undefined) as never);
      (rig.agenteSessionFinisher[method] as (arg?: string) => unknown)('m1');
      expect(spy).toHaveBeenCalledTimes(1);
    }
  });

  it('configure recria a instância: isClosing acompanha a chamada em voo da instância nova', async () => {
    let release: (outcome: FinishOutcome) => void = () => undefined;
    rig.finishSession.mockReturnValue(new Promise<FinishOutcome>((resolve) => (release = resolve)));
    rig.configureAgenteSessionFinisher({
      isMeetingLive: () => false,
      finisher: { finishSession: rig.finishSession },
    });

    const running = rig.agenteSessionFinisher.evaluate('m1');
    await vi.waitFor(() => expect(rig.agenteSessionFinisher.isClosing('m1')).toBe(true));
    release('finished');
    await running;

    expect(rig.agenteSessionFinisher.isClosing('m1')).toBe(false);
  });
});

describe('adaptador de alarmes de produção', () => {
  beforeEach(async () => {
    rig = await boot();
    await rig.seedLinkedPicker();
  });

  it('reunião ao vivo -> chrome.alarms.clear(nome)', async () => {
    rig.configureAgenteSessionFinisher({ finisher: { finishSession: rig.finishSession } });

    await rig.agenteSessionFinisher.evaluate('m1');

    expect(rig.alarms.clear).toHaveBeenCalledWith(ALARM_NAME);
  });

  it('falha retryable -> chrome.alarms.create(nome, { when })', async () => {
    rig.finishSession.mockRejectedValue(
      new rig.AgenteFinishError('503', { retryable: true, httpStatus: 503 }),
    );
    rig.configureAgenteSessionFinisher({
      isMeetingLive: () => false,
      finisher: { finishSession: rig.finishSession },
    });
    const before = Date.now();

    await rig.agenteSessionFinisher.evaluate('m1');

    expect(rig.alarms.create).toHaveBeenCalledWith(ALARM_NAME, { when: expect.any(Number) });
    const [, info] = rig.alarms.create.mock.calls[0] as unknown as [string, { when: number }];
    expect(info.when).toBeGreaterThanOrEqual(before + 30_000);
  });
});
