/**
 * Teste de componente da tela "Agente Diagnóstico": salvar grava normalizado,
 * o toggle grava na hora, a chave vem mascarada, o rascunho não editado
 * sobrevive a uma escrita externa (lição G-06-1 da Fase 6) e o status exibido
 * bate com a config salva — mesmo padrão de TranscriptView.test.tsx
 * (createRoot + act, sem testing-library), combinado com o storage simulado
 * de `onChanged` de verdade (chromeStorageMock.ts).
 *
 * `flushUntil`: os efeitos desta tela dependem de uma cadeia assíncrona real
 * (chrome.storage.*.get/set, mockados como funções `async`). `act()` só
 * comita as atualizações pendentes quando o próprio callback assíncrono se
 * resolve — checar o DOM ENQUANTO ainda dentro do callback (como faria um
 * `vi.waitFor` chamado de dentro do `act`) nunca vê a mudança, porque o
 * commit só acontece depois. Por isso aqui cada passo de espera é o próprio
 * `act`, e a checagem do predicado acontece DEPOIS que ele resolve.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AGENTE_CONFIG, type AgenteConfig } from '@/shared/config/agenteConfig';
import { STORAGE_KEYS } from '@/shared/config/constants';
import { installChromeStorageMock } from '@/test/chromeStorageMock';

const RUNTIME_STUB = { getURL: (path: string) => `chrome-extension://taqciti/${path}` };

/** Setter nativo + evento `input` — é assim que digitar de verdade chega ao React. */
function typeInto(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

/** Ver comentário de topo do arquivo — por que o polling precisa ser feito assim. */
async function flushUntil(
  predicate: () => boolean,
  timeoutMs = 1_000,
  stepMs = 20,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, stepMs));
    });
    if (predicate()) return;
  }
  throw new Error('flushUntil: predicado não ficou verdadeiro a tempo');
}

describe('AgenteConfigScreen', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.resetModules();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  function statusText(): string {
    return host.querySelector('[aria-live="polite"]')?.textContent ?? '';
  }

  function fields() {
    return {
      sessionId: host.querySelector<HTMLInputElement>('#agente-session-id')!,
      backendUrl: host.querySelector<HTMLInputElement>('#agente-backend-url')!,
      apiKey: host.querySelector<HTMLInputElement>('#agente-api-key')!,
      toggle: host.querySelector<HTMLButtonElement>('[role="switch"]')!,
      saveButton: [...host.querySelectorAll('button')].find((b) =>
        /salv/i.test(b.textContent ?? ''),
      )!,
    };
  }

  async function renderScreen(saved?: Partial<AgenteConfig>, session: Record<string, unknown> = {}) {
    const mock = installChromeStorageMock({
      local: saved === undefined ? {} : { [STORAGE_KEYS.agenteConfig]: saved },
      session,
      extra: { runtime: RUNTIME_STUB },
    });
    const { AgenteConfigScreen } = await import('./AgenteConfigScreen');

    await act(async () => {
      root.render(<AgenteConfigScreen />);
    });
    // A primeira entrega da assinatura é assíncrona (loadAgenteConfig lê o
    // storage) — até lá o status vem vazio (readiness ainda null).
    await flushUntil(() => statusText() !== '');

    return mock;
  }

  /*
   * Antes, enquanto a config ainda não tinha chegado do storage, o aviso de
   * status ficava em branco — sem dizer à pessoa que a tela estava carregando.
   */
  it('(0) com a leitura da config pendente mostra "Carregando configuração…"; ao resolver, some', async () => {
    const mock = installChromeStorageMock({ extra: { runtime: RUNTIME_STUB } });
    const realGet = mock.local.get.getMockImplementation()!;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    mock.local.get.mockImplementationOnce(async (keys) => {
      await gate;
      return realGet(keys);
    });
    const { AgenteConfigScreen } = await import('./AgenteConfigScreen');

    await act(async () => {
      root.render(<AgenteConfigScreen />);
    });
    expect(statusText()).toBe('Carregando configuração…');
    // IN-02: sem conhecer o valor real, o toggle não pode aceitar clique.
    expect(fields().toggle.disabled).toBe(true);

    release();
    await flushUntil(() => statusText() !== 'Carregando configuração…');
    expect(statusText()).toBe('Desligado — nada é enviado ao Agente.');
    expect(fields().toggle.disabled).toBe(false);
  });

  it('(1) sem nada salvo, o ID vem vazio, o toggle desmarcado e o status é "Desligado"', async () => {
    await renderScreen();
    const { sessionId, toggle } = fields();

    expect(sessionId.value).toBe('');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(statusText()).toBe('Desligado — nada é enviado ao Agente.');
  });

  it('(2) salvar grava em taq:agenteConfig o objeto normalizado', async () => {
    const mock = await renderScreen();
    const { sessionId, backendUrl, apiKey, saveButton } = fields();
    const uuid = '11111111-1111-1111-1111-111111111111';

    typeInto(sessionId, uuid);
    typeInto(backendUrl, ' agente.exemplo/ ');
    typeInto(apiKey, 's3cr3t');

    await act(async () => {
      saveButton.click();
    });
    await flushUntil(() => (mock.local.set as ReturnType<typeof vi.fn>).mock.calls.length > 0);

    const saved = mock.local.values[STORAGE_KEYS.agenteConfig] as AgenteConfig;
    expect(saved).toEqual({
      agenteBackendUrl: 'https://agente.exemplo',
      agenteSessionId: uuid,
      agenteApiKey: 's3cr3t',
      streamingEnabled: false,
      confirmedMeetingId: '', // CR-01: nenhuma reunião nova confirmada
    });
  });

  it('(3) clicar no switch grava streamingEnabled na hora, sem precisar do "Salvar"', async () => {
    const mock = await renderScreen();
    const { toggle } = fields();

    await act(async () => {
      toggle.click();
    });
    await flushUntil(() => (mock.local.set as ReturnType<typeof vi.fn>).mock.calls.length > 0);

    const saved = mock.local.values[STORAGE_KEYS.agenteConfig] as AgenteConfig;
    expect(saved.streamingEnabled).toBe(true);
    await flushUntil(() => toggle.getAttribute('aria-checked') === 'true');
  });

  it('(4) o campo da chave vem mascarado (type=password)', async () => {
    await renderScreen();
    expect(fields().apiKey.type).toBe('password');
  });

  it('(5) digitar no ID sem salvar sobrevive a uma escrita externa no storage (G-06-1)', async () => {
    const mock = await renderScreen();
    const { sessionId, backendUrl } = fields();

    typeInto(sessionId, 'rascunho-nao-salvo');

    await act(async () => {
      await mock.local.set({
        [STORAGE_KEYS.agenteConfig]: {
          ...DEFAULT_AGENTE_CONFIG,
          agenteBackendUrl: 'https://outra-aba.exemplo',
        },
      });
    });
    // A propagação da mudança (onChanged -> setDrafts) também é assíncrona —
    // espera o campo NÃO editado (URL) refletir o valor vindo de fora, prova
    // de que a entrega da assinatura já rodou.
    await flushUntil(() => backendUrl.value === 'https://outra-aba.exemplo');

    // O campo editado (ID) não foi sobrescrito pela entrega externa.
    expect(sessionId.value).toBe('rascunho-nao-salvo');
  });

  it('(6) com o toggle ligado e o ID vazio, o status mostra "Falta o ID da sessão"', async () => {
    await renderScreen({ ...DEFAULT_AGENTE_CONFIG, streamingEnabled: true });
    expect(statusText()).toBe('Falta o ID da sessão do Agente — nada é enviado.');
  });

  /*
   * WR-04: antes, uma falha de escrita virava uma unhandled rejection e o
   * botão só voltava para "Salvar" sem dizer que nada foi gravado.
   */
  it('(7) uma falha ao salvar mostra mensagem de erro para a pessoa', async () => {
    const mock = await renderScreen();
    const { sessionId, saveButton } = fields();

    typeInto(sessionId, '11111111-1111-1111-1111-111111111111');
    (mock.local.set as ReturnType<typeof vi.fn>).mockImplementationOnce(() =>
      Promise.reject(new Error('falhou')),
    );

    await act(async () => {
      saveButton.click();
    });
    await flushUntil(
      () => (host.querySelector('[aria-live="assertive"]')?.textContent ?? '') !== '',
    );

    expect(host.querySelector('[aria-live="assertive"]')?.textContent).toBe(
      'Não foi possível salvar a configuração. Tente de novo.',
    );
  });

  it('(8) uma falha ao alternar o toggle mostra mensagem de erro para a pessoa', async () => {
    const mock = await renderScreen();
    const { toggle } = fields();

    (mock.local.set as ReturnType<typeof vi.fn>).mockImplementationOnce(() =>
      Promise.reject(new Error('falhou')),
    );

    await act(async () => {
      toggle.click();
    });
    await flushUntil(
      () => (host.querySelector('[aria-live="assertive"]')?.textContent ?? '') !== '',
    );

    expect(host.querySelector('[aria-live="assertive"]')?.textContent).toBe(
      'Não foi possível salvar a configuração. Tente de novo.',
    );
  });

  /*
   * WR-05: antes, `save()` mandava sempre os três campos, mesmo os não
   * editados — isso corria com uma escrita externa (ex.: auto-detect da
   * Fase 8 gravando `agenteSessionId`) e também gravava o padrão da build
   * assim que a pessoa salvasse qualquer coisa.
   */
  it('(9) salvar manda ao store só o campo editado, não os três sempre', async () => {
    const savedSessionId = '22222222-2222-2222-2222-222222222222';
    await renderScreen({ ...DEFAULT_AGENTE_CONFIG, agenteSessionId: savedSessionId });
    const { backendUrl, saveButton } = fields();

    const configStore = await import('@/shared/config/agenteConfigStore');
    const patchSpy = vi.spyOn(configStore, 'patchAgenteConfig');

    typeInto(backendUrl, 'https://novo.exemplo');

    await act(async () => {
      saveButton.click();
    });
    await flushUntil(() => patchSpy.mock.calls.length > 0);

    expect(patchSpy).toHaveBeenCalledWith({ agenteBackendUrl: 'https://novo.exemplo' });
  });

  /*
   * WR-07: antes, com a config pronta, a tela dizia "está sendo enviada"
   * mesmo com 100% dos envios falhando — o status vinha só da config salva.
   */
  const READY = {
    ...DEFAULT_AGENTE_CONFIG,
    agenteBackendUrl: 'https://agente.test',
    streamingEnabled: true,
    agenteSessionId: '11111111-1111-1111-1111-111111111111',
  };

  it('(10) pronto e nada enviado ainda: "pronto para enviar", sem prometer entrega', async () => {
    await renderScreen(READY);
    expect(statusText()).toBe('Ligado — pronto para enviar. O envio começa quando alguém falar.');
  });

  it('(11) último envio recusado com 401: a tela mostra a chave recusada', async () => {
    await renderScreen(READY, {
      [STORAGE_KEYS.agenteStatus]: { lastOutcome: 'rejected', lastHttpStatus: 401, lastAttemptAt: 1 },
    });
    await flushUntil(() => statusText().includes('401'));
    expect(statusText()).toBe(
      'Último envio recusado: a chave de autenticação não foi aceita (HTTP 401).',
    );
  });

  it('(12) o status acompanha o service worker ao vivo (storage.session onChanged)', async () => {
    const mock = await renderScreen(READY);
    await act(async () => {
      await mock.session.set({
        [STORAGE_KEYS.agenteStatus]: { lastOutcome: 'retrying', lastHttpStatus: null, lastAttemptAt: 1 },
      });
    });
    await flushUntil(() => statusText().includes('tentando de novo'));
    expect(statusText()).toBe('Falha ao enviar (sem conexão com o backend) — tentando de novo…');
  });

  /*
   * CR-01: antes, reunião nova com o mesmo session_id travava o envio em
   * silêncio e a tela dizia "Ligado". Agora avisa e oferece a confirmação.
   */
  it('(13) reunião nova esperando: a tela avisa, e confirmar grava a reunião na config', async () => {
    const mock = await renderScreen(READY, {
      [STORAGE_KEYS.agenteStatus]: {
        lastOutcome: 'sent',
        lastHttpStatus: 202,
        lastAttemptAt: 1,
        waitingMeetingId: 'm2',
      },
    });
    await flushUntil(() => statusText().includes('Reunião nova detectada'));
    expect(statusText()).toContain('nada está sendo enviado');

    const confirm = [...host.querySelectorAll('button')].find((b) =>
      /continuar enviando/i.test(b.textContent ?? ''),
    );
    expect(confirm).toBeDefined();

    await act(async () => {
      confirm!.click();
    });
    await flushUntil(
      () =>
        (mock.local.values[STORAGE_KEYS.agenteConfig] as AgenteConfig | undefined)
          ?.confirmedMeetingId === 'm2',
    );
  });

  it('(14) sem espera, o botão de confirmar não aparece', async () => {
    await renderScreen(READY);
    const confirm = [...host.querySelectorAll('button')].find((b) =>
      /continuar enviando/i.test(b.textContent ?? ''),
    );
    expect(confirm).toBeUndefined();
  });

  /*
   * IN-05 (D1): antes, a chave salva voltava em texto claro no `value` do
   * <input type="password"> — visível em qualquer inspeção do DOM. Agora o
   * campo fica vazio, um indicador diz que há chave, campo vazio ao salvar
   * mantém a chave, digitar troca, e "Remover chave" apaga.
   */
  const SAVED_KEY = 'chave-salva-super-secreta';
  const WITH_KEY = { ...DEFAULT_AGENTE_CONFIG, agenteApiKey: SAVED_KEY };

  function removeKeyButton(): HTMLButtonElement | undefined {
    return [...host.querySelectorAll('button')].find((b) =>
      /remover chave/i.test(b.textContent ?? ''),
    );
  }

  function storedKey(mock: Awaited<ReturnType<typeof renderScreen>>): string | undefined {
    return (mock.local.values[STORAGE_KEYS.agenteConfig] as AgenteConfig | undefined)?.agenteApiKey;
  }

  it('(15) com chave salva, o input fica vazio e a chave não aparece em nenhum lugar do DOM', async () => {
    await renderScreen(WITH_KEY);

    expect(fields().apiKey.value).toBe('');
    expect(host.innerHTML).not.toContain(SAVED_KEY);
    expect(host.textContent).toMatch(/chave configurada/i);
    expect(removeKeyButton()).toBeDefined();
  });

  it('(16) sem chave salva, não há indicador nem botão "Remover chave"', async () => {
    await renderScreen();

    expect(host.textContent).not.toMatch(/chave configurada/i);
    expect(removeKeyButton()).toBeUndefined();
  });

  it('(17) salvar sem mexer na chave mantém a chave salva', async () => {
    const mock = await renderScreen(WITH_KEY);
    const { backendUrl, saveButton } = fields();

    typeInto(backendUrl, 'https://novo.exemplo');
    await act(async () => {
      saveButton.click();
    });
    await flushUntil(() => (mock.local.set as ReturnType<typeof vi.fn>).mock.calls.length > 0);

    expect(storedKey(mock)).toBe(SAVED_KEY);
  });

  it('(18) tocar no campo da chave e deixá-lo vazio ao salvar mantém a chave salva', async () => {
    const mock = await renderScreen(WITH_KEY);
    const { apiKey, backendUrl, saveButton } = fields();

    typeInto(apiKey, 'x');
    typeInto(apiKey, '');
    typeInto(backendUrl, 'https://novo.exemplo');
    await act(async () => {
      saveButton.click();
    });
    await flushUntil(() => (mock.local.set as ReturnType<typeof vi.fn>).mock.calls.length > 0);

    expect(storedKey(mock)).toBe(SAVED_KEY);
  });

  it('(19) digitar uma chave nova substitui a salva e o campo volta vazio', async () => {
    const mock = await renderScreen(WITH_KEY);
    const { apiKey, saveButton } = fields();

    typeInto(apiKey, 'chave-nova');
    await act(async () => {
      saveButton.click();
    });
    await flushUntil(() => storedKey(mock) === 'chave-nova');

    await flushUntil(() => apiKey.value === '');
    expect(host.innerHTML).not.toContain('chave-nova');
  });

  it('(20) "Remover chave" apaga a chave salva e o botão some', async () => {
    const mock = await renderScreen(WITH_KEY);

    await act(async () => {
      removeKeyButton()!.click();
    });
    await flushUntil(() => storedKey(mock) === '');

    await flushUntil(() => removeKeyButton() === undefined);
    expect(host.textContent).not.toMatch(/chave configurada/i);
  });

  it('(21) uma falha ao remover a chave mostra mensagem de erro', async () => {
    const mock = await renderScreen(WITH_KEY);

    (mock.local.set as ReturnType<typeof vi.fn>).mockImplementationOnce(() =>
      Promise.reject(new Error('falhou')),
    );
    await act(async () => {
      removeKeyButton()!.click();
    });
    await flushUntil(
      () => (host.querySelector('[aria-live="assertive"]')?.textContent ?? '') !== '',
    );

    expect(host.querySelector('[aria-live="assertive"]')?.textContent).toBe(
      'Não foi possível salvar a configuração. Tente de novo.',
    );
  });

  /*
   * WR-02: com o service worker dormindo, ninguém ouvia a mudança de config e o
   * erro antigo (ex.: 401 com a chave errada) continuava na tela depois de a
   * pessoa colar a chave certa. Quem grava a config zera o status.
   */
  it('(22) salvar uma chave nova zera o último resultado de envio, sem depender do service worker', async () => {
    const mock = await renderScreen(READY, {
      [STORAGE_KEYS.agenteStatus]: { lastOutcome: 'rejected', lastHttpStatus: 401, lastAttemptAt: 1 },
    });
    await flushUntil(() => statusText().includes('401'));
    const { apiKey, saveButton } = fields();

    typeInto(apiKey, 'chave-certa');
    await act(async () => {
      saveButton.click();
    });

    await flushUntil(() => !statusText().includes('401'));
    expect(mock.session.values[STORAGE_KEYS.agenteStatus]).toMatchObject({
      lastOutcome: null,
      lastHttpStatus: null,
    });
    expect(statusText()).toBe('Ligado — pronto para enviar. O envio começa quando alguém falar.');
  });

  /*
   * IN-03: a chave só com espaços era filtrada do patch e, se fosse a única
   * edição, "Salvar" não fazia nada nem avisava — os espaços ficavam no campo e a
   * pessoa achava que tinha trocado a chave.
   */
  it('(23) salvar só com espaços no campo da chave limpa o campo e mantém a chave salva', async () => {
    const mock = await renderScreen(WITH_KEY);
    const { apiKey, saveButton } = fields();

    typeInto(apiKey, '   ');
    expect(apiKey.value).toBe('   ');
    await act(async () => {
      saveButton.click();
    });

    await flushUntil(() => apiKey.value === '');
    expect((mock.local.set as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
    expect(storedKey(mock)).toBe(SAVED_KEY);
  });
});
