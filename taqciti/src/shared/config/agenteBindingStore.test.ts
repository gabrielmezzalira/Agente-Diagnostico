/**
 * O vínculo "sessão do Agente → última reunião enviada" (CR-01, WR-01): a chave própria
 * `taq:agenteBinding` existe para a tela e o service worker nunca desfazerem o que o outro
 * gravou. Os testes cobrem esse jeito real de falhar, não propriedades abstratas do módulo.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AGENTE_CONFIG } from '@/shared/config/agenteConfig';
import { STORAGE_KEYS } from '@/shared/config/constants';
import { installChromeStorageMock } from '@/test/chromeStorageMock';
import { boundMeetingFor, normalizeAgenteBinding } from './agenteBindingStore';

const SESSION_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_SESSION_ID = '22222222-2222-2222-2222-222222222222';

beforeEach(() => {
  vi.resetModules();
});

async function fresh(local: Record<string, unknown> = {}) {
  const mock = installChromeStorageMock({ local });
  const bindingStore = await import('./agenteBindingStore');
  const configStore = await import('./agenteConfigStore');
  return { mock, ...bindingStore, ...configStore };
}

describe('normalizeAgenteBinding', () => {
  it('par de strings não vazias é mantido', () => {
    expect(normalizeAgenteBinding({ sessionId: 'S1', meetingId: 'm1' })).toEqual({
      sessionId: 'S1',
      meetingId: 'm1',
    });
  });

  it('ausente, malformado ou com campo vazio vira "sem vínculo"', () => {
    for (const raw of [null, undefined, 'm1', 42, {}, { sessionId: 'S1' }, { sessionId: '', meetingId: 'm1' }]) {
      expect(normalizeAgenteBinding(raw)).toBeNull();
    }
    expect(normalizeAgenteBinding({ sessionId: 'S1', meetingId: 7 })).toBeNull();
  });
});

describe('boundMeetingFor', () => {
  it('só vale para a sessão com que o vínculo foi gravado', () => {
    const binding = { sessionId: 'S1', meetingId: 'm1' };
    expect(boundMeetingFor(binding, 'S1')).toBe('m1');
    expect(boundMeetingFor(binding, 'S2')).toBe('');
    expect(boundMeetingFor(null, 'S1')).toBe('');
  });
});

describe('loadAgenteBinding / writeAgenteBinding', () => {
  it('sem nada salvo, não há vínculo', async () => {
    const { loadAgenteBinding } = await fresh();
    expect(await loadAgenteBinding()).toBeNull();
  });

  it('grava o par na chave própria de storage.local e lê de volta', async () => {
    const { loadAgenteBinding, writeAgenteBinding, mock } = await fresh();
    await writeAgenteBinding(SESSION_ID, 'm1');
    expect(mock.local.values[STORAGE_KEYS.agenteBinding]).toEqual({ sessionId: SESSION_ID, meetingId: 'm1' });
    expect(await loadAgenteBinding()).toEqual({ sessionId: SESSION_ID, meetingId: 'm1' });
  });

  it('é escrita direta: não lê o storage antes de gravar', async () => {
    const { writeAgenteBinding, mock } = await fresh();
    await writeAgenteBinding(SESSION_ID, 'm1');
    expect(mock.local.get).not.toHaveBeenCalled();
  });

  it('o vínculo é gravado no storage.local — sobrevive ao "fechar o navegador" (que só apaga a session)', async () => {
    const { writeAgenteBinding, loadAgenteBinding, mock } = await fresh();
    await writeAgenteBinding(SESSION_ID, 'm1');
    for (const key of Object.keys(mock.session.values)) delete mock.session.values[key];
    expect(await loadAgenteBinding()).toEqual({ sessionId: SESSION_ID, meetingId: 'm1' });
  });
});

/*
 * Teste-semente do WR-01. Antes, o vínculo morava dentro de `taq:agenteConfig` e dois contextos
 * (tela e service worker) faziam read-modify-write do objeto inteiro: uma gravação apagava a
 * outra. Aqui a leitura da tela fica "parada" (devolve um retrato velho) enquanto o service
 * worker grava — o pior intercalamento — e nenhum dos dois pode perder o que o outro gravou.
 */
describe('WR-01: tela e service worker não se desfazem', () => {
  async function slowReads(local: { get: ReturnType<typeof vi.fn> }) {
    const original = local.get.getMockImplementation()!;
    local.get.mockImplementation(async (...args: unknown[]) => {
      const snapshot = await original(...(args as [string]));
      await new Promise((resolve) => setTimeout(resolve, 5)); // a gravação do outro lado cabe aqui
      return snapshot;
    });
  }

  it('um salvamento da tela concorrente com a gravação do vínculo não apaga o vínculo', async () => {
    const { mock, patchAgenteConfig, writeAgenteBinding, loadAgenteBinding, loadAgenteConfig } = await fresh({
      [STORAGE_KEYS.agenteConfig]: { ...DEFAULT_AGENTE_CONFIG, agenteSessionId: SESSION_ID },
    });
    await slowReads(mock.local);

    await Promise.all([
      patchAgenteConfig({ agenteApiKey: 'chave-nova' }), // a tela salvando
      writeAgenteBinding(SESSION_ID, 'm1'), // o service worker vinculando, ao mesmo tempo
      patchAgenteConfig({ agenteBackendUrl: 'https://agente.exemplo' }),
    ]);

    expect(await loadAgenteBinding()).toEqual({ sessionId: SESSION_ID, meetingId: 'm1' });
    expect(await loadAgenteConfig()).toMatchObject({
      agenteApiKey: 'chave-nova',
      agenteBackendUrl: 'https://agente.exemplo',
    });
  });

  it('gravar o vínculo não desfaz o que a tela acabou de salvar (toggle e sessão nova)', async () => {
    const { mock, patchAgenteConfig, writeAgenteBinding, loadAgenteConfig } = await fresh({
      [STORAGE_KEYS.agenteConfig]: { ...DEFAULT_AGENTE_CONFIG, agenteSessionId: SESSION_ID, streamingEnabled: true },
    });
    await slowReads(mock.local);

    await Promise.all([
      writeAgenteBinding(SESSION_ID, 'm1'),
      patchAgenteConfig({ streamingEnabled: false, agenteSessionId: OTHER_SESSION_ID }),
    ]);

    expect(await loadAgenteConfig()).toMatchObject({
      streamingEnabled: false,
      agenteSessionId: OTHER_SESSION_ID,
    });
  });

  it('gravar o vínculo não dispara o onChanged da config', async () => {
    const { mock, writeAgenteBinding, onAgenteConfigChange } = await fresh();
    const onConfig = vi.fn();
    const stop = onAgenteConfigChange(onConfig);
    await writeAgenteBinding(SESSION_ID, 'm1');
    expect(onConfig).not.toHaveBeenCalled();
    expect(mock.local.set).toHaveBeenCalledTimes(1);
    stop();
  });
});
