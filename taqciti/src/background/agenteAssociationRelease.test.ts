/**
 * Apagar uma reunião do histórico (Fase 8, WR-02): a associação que ainda deve o encerramento da sessão no
 * Agente fica de pé e o agendador é chamado na hora; quem não deve mais nada sai junto, como antes.
 * Store real sobre `chrome.storage` simulado; o agendador é falso.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MeetingAssociation } from '@/features/agente/association';
import { STORAGE_KEYS } from '@/shared/config/constants';
import { installChromeStorageMock } from '@/test/chromeStorageMock';

const SID = '55555555-5555-5555-5555-555555555555';
const KEY = STORAGE_KEYS.agenteAssociations;

async function boot(associations: Record<string, MeetingAssociation>) {
  vi.resetModules();
  const mock = installChromeStorageMock({ local: { [KEY]: associations } });
  const evaluate = vi.fn((_meetingId: string) => Promise.resolve());
  vi.doMock('./agenteSessionFinisher', () => ({ agenteSessionFinisher: { evaluate } }));
  const { releaseMeetingAssociation } = await import('./agenteAssociationRelease');
  const map = () => mock.local.values[KEY] as Record<string, MeetingAssociation>;
  return { releaseMeetingAssociation, evaluate, map };
}

beforeEach(() => {
  vi.resetModules();
});

describe('releaseMeetingAssociation (WR-02)', () => {
  it.each(['linked', 'sent', 'send-failed'] as const)(
    '%s com sessão do picker aberta: a associação fica e o encerramento é pedido',
    async (state) => {
      const rig = await boot({ m1: { meetingId: 'm1', state, sessionId: SID, origin: 'picker' } });
      await rig.releaseMeetingAssociation('m1');
      expect(rig.map()).toHaveProperty('m1');
      expect(rig.evaluate).toHaveBeenCalledWith('m1');
    },
  );

  it('sessão que a Taqciti desistiu de encerrar também fica (ganha rodada nova no boot)', async () => {
    const rig = await boot({
      m1: { meetingId: 'm1', state: 'sent', sessionId: SID, origin: 'picker', finishGaveUp: true },
    });
    await rig.releaseMeetingAssociation('m1');
    expect(rig.map()).toHaveProperty('m1');
  });

  it.each([
    ['sessão já encerrada', { state: 'sent', sessionId: SID, origin: 'picker', sessionFinished: true }],
    ['plano B (ID colado)', { state: 'sent', sessionId: SID, origin: 'manual-id' }],
    ['sem sessão (nunca vinculada)', { state: 'ended-unsent' }],
  ] as const)('%s: a associação sai junto, sem pedir encerramento', async (_nome, extra) => {
    const rig = await boot({ m1: { meetingId: 'm1', ...extra } as MeetingAssociation });
    await rig.releaseMeetingAssociation('m1');
    expect(rig.map()).not.toHaveProperty('m1');
    expect(rig.evaluate).not.toHaveBeenCalled();
  });

  it('falha do agendador não derruba quem apagou a reunião', async () => {
    const rig = await boot({ m1: { meetingId: 'm1', state: 'sent', sessionId: SID, origin: 'picker' } });
    rig.evaluate.mockRejectedValue(new Error('rede'));
    await expect(rig.releaseMeetingAssociation('m1')).resolves.toBeUndefined();
  });
});
