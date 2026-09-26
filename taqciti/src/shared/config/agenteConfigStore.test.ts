/**
 * O registro único da configuração do Agente (D-08): estes testes cobrem os
 * mesmos jeitos reais de esse registro "esquecer" um campo ou vazar entre
 * abas que `prefsStore.test.ts` cobre para as preferências do painel — não
 * propriedades abstratas do módulo.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AGENTE_CONFIG } from '@/shared/config/agenteConfig';
import type { AgenteConfig } from '@/shared/config/agenteConfig';
import { STORAGE_KEYS } from '@/shared/config/constants';
import { installChromeStorageMock } from '@/test/chromeStorageMock';

const SAVED_SESSION_ID = '11111111-1111-1111-1111-111111111111';

beforeEach(() => {
  vi.resetModules();
});

async function fresh(saved?: unknown) {
  const mock = installChromeStorageMock(
    saved === undefined ? {} : { local: { [STORAGE_KEYS.agenteConfig]: saved } },
  );
  const store = await import('./agenteConfigStore');
  return { ...store, mock };
}

describe('loadAgenteConfig', () => {
  it('sem nada salvo devolve exatamente o padrão da build', async () => {
    const { loadAgenteConfig } = await fresh();
    expect(await loadAgenteConfig()).toEqual(DEFAULT_AGENTE_CONFIG);
  });
});

describe('patchAgenteConfig', () => {
  it('muda só o campo pedido, preservando os demais já salvos', async () => {
    const { patchAgenteConfig } = await fresh({
      ...DEFAULT_AGENTE_CONFIG,
      agenteBackendUrl: 'https://agente.exemplo',
      agenteApiKey: 'chave-antiga',
    });
    const next = await patchAgenteConfig({ agenteSessionId: SAVED_SESSION_ID });
    expect(next).toEqual({
      ...DEFAULT_AGENTE_CONFIG,
      agenteBackendUrl: 'https://agente.exemplo',
      agenteApiKey: 'chave-antiga',
      agenteSessionId: SAVED_SESSION_ID,
    });
  });

  /*
   * O mesmo lost update que a fila de `prefsStore.ts` corrige: sem
   * serializar, dois campos gravados na mesma volta apagariam um ao outro.
   */
  it('três patches concorrentes não se apagam', async () => {
    const { patchAgenteConfig } = await fresh();

    const [, , last] = await Promise.all([
      patchAgenteConfig({ agenteBackendUrl: 'https://agente.exemplo' }),
      patchAgenteConfig({ streamingEnabled: true }),
      patchAgenteConfig({ agenteSessionId: SAVED_SESSION_ID }),
    ]);

    expect(last).toMatchObject({
      agenteBackendUrl: 'https://agente.exemplo',
      streamingEnabled: true,
      agenteSessionId: SAVED_SESSION_ID,
    });
  });

  it('normaliza na escrita: lixo não entra no storage', async () => {
    const { patchAgenteConfig, mock } = await fresh();
    await patchAgenteConfig({
      agenteBackendUrl: ' agente.exemplo/ ',
      streamingEnabled: 'sim' as unknown as boolean,
    });

    const saved = mock.local.values[STORAGE_KEYS.agenteConfig] as AgenteConfig;
    expect(saved.agenteBackendUrl).toBe('https://agente.exemplo');
    expect(saved.streamingEnabled).toBe(DEFAULT_AGENTE_CONFIG.streamingEnabled);
  });

  /*
   * Invariante (assumption-delta): campo salvo vence o padrão da build;
   * campo ausente cai no padrão — nunca os dois pela metade.
   */
  it('valor salvo parcial: campo salvo vence, campo ausente cai no padrão da build', async () => {
    const { loadAgenteConfig } = await fresh({ agenteSessionId: SAVED_SESSION_ID });
    const config = await loadAgenteConfig();
    expect(config.agenteSessionId).toBe(SAVED_SESSION_ID);
    expect(config.agenteBackendUrl).toBe(DEFAULT_AGENTE_CONFIG.agenteBackendUrl);
    expect(config.streamingEnabled).toBe(DEFAULT_AGENTE_CONFIG.streamingEnabled);
  });
});

describe('subscribeAgenteConfig', () => {
  it('entrega o valor atual logo de cara', async () => {
    const { subscribeAgenteConfig } = await fresh({
      ...DEFAULT_AGENTE_CONFIG,
      agenteSessionId: SAVED_SESSION_ID,
    });
    const seen: AgenteConfig[] = [];
    subscribeAgenteConfig((c) => seen.push(c));
    await vi.waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]?.agenteSessionId).toBe(SAVED_SESSION_ID);
  });

  /*
   * O ponto inteiro do padrão: um patch feito por outra tela (ou pela Fase 8
   * escrevendo o session_id detectado) precisa chegar a TODA superfície que
   * assinou, não só à que gravou.
   */
  it('um patch feito em "outra aba" chega a dois assinantes', async () => {
    const { subscribeAgenteConfig, patchAgenteConfig } = await fresh();
    const abaA: AgenteConfig[] = [];
    const abaB: AgenteConfig[] = [];
    subscribeAgenteConfig((c) => abaA.push(c));
    subscribeAgenteConfig((c) => abaB.push(c));

    await patchAgenteConfig({ agenteSessionId: SAVED_SESSION_ID });

    await vi.waitFor(() => {
      expect(abaA.at(-1)?.agenteSessionId).toBe(SAVED_SESSION_ID);
      expect(abaB.at(-1)?.agenteSessionId).toBe(SAVED_SESSION_ID);
    });
  });

  it('gravar STORAGE_KEYS.history não dispara o callback', async () => {
    const { subscribeAgenteConfig } = await fresh();
    const seen: AgenteConfig[] = [];
    subscribeAgenteConfig((c) => seen.push(c));
    await vi.waitFor(() => expect(seen).toHaveLength(1));

    await chrome.storage.local.set({ [STORAGE_KEYS.history]: [] });
    expect(seen).toHaveLength(1);
  });

  it('cancelar a assinatura solta o listener', async () => {
    const { subscribeAgenteConfig, patchAgenteConfig } = await fresh();
    const seen: AgenteConfig[] = [];
    const off = subscribeAgenteConfig((c) => seen.push(c));
    await vi.waitFor(() => expect(seen).toHaveLength(1));

    off();
    await patchAgenteConfig({ streamingEnabled: true });
    expect(seen).toHaveLength(1);
  });
});

describe('createAgenteConfigReader', () => {
  it('primeira chamada devolve a config salva; após um patch, a próxima chamada devolve o valor novo', async () => {
    const { createAgenteConfigReader, patchAgenteConfig } = await fresh({
      ...DEFAULT_AGENTE_CONFIG,
      agenteBackendUrl: 'https://agente.exemplo',
    });
    const readConfig = createAgenteConfigReader();

    expect((await readConfig()).agenteBackendUrl).toBe('https://agente.exemplo');

    await patchAgenteConfig({ streamingEnabled: true });
    expect((await readConfig()).streamingEnabled).toBe(true);
  });

  it('em várias chamadas seguidas, chrome.storage.local.get da chave é chamado uma única vez', async () => {
    const { createAgenteConfigReader, mock } = await fresh();
    const readConfig = createAgenteConfigReader();

    await readConfig();
    await readConfig();
    await readConfig();

    expect(mock.local.get).toHaveBeenCalledTimes(1);
  });
});
