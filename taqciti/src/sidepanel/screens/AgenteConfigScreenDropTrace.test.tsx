/**
 * Tela "Agente Diagnóstico" com o rastro de falas descartadas (Fase 8, plano 08-11, Task 3, decisão
 * B3-b): a nota aparece junto do status mesmo depois de um envio bem-sucedido, e sem rastro o texto
 * da Fase 7 fica exatamente como era. Arquivo próprio porque o 08-18 mexe no AgenteConfigScreen.test.tsx.
 *
 * A config gravada tem envio ligado, URL https válida e ID de sessão UUID válido — o "Ligado — …" é o
 * mesmo antes e depois de o 08-18 tirar o ID da prontidão. Mesmo padrão de montagem do teste da tela
 * (createRoot + act + storage simulado com `onChanged` de verdade).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AGENTE_CONFIG } from '@/shared/config/agenteConfig';
import { STORAGE_KEYS } from '@/shared/config/constants';
import { installChromeStorageMock } from '@/test/chromeStorageMock';
import type { Platform } from '@/shared/platform/types';

const RUNTIME_STUB = { getURL: (path: string) => `chrome-extension://taqciti/${path}` };

/**
 * Plataforma falsa (08-18): a tela passou a usar `useClientDirectory`, e `usePlatform()` lança fora de
 * `<PlatformProvider>`. A lista de clientes fica indisponível — com ela, o campo de ID aparece (D-02,
 * plano B), como na Fase 7 —, e as assinaturas não emitem nada.
 */
const UNAVAILABLE_PLATFORM: Platform = {
  kind: 'extension',
  send: <R,>() => Promise.resolve({ ok: false, error: 'unavailable' } as R),
  subscribeMeeting: () => () => {},
  subscribeHistory: () => () => {},
};
const READY = {
  ...DEFAULT_AGENTE_CONFIG,
  agenteBackendUrl: 'https://agente.test',
  streamingEnabled: true,
  agenteSessionId: '11111111-1111-1111-1111-111111111111',
};
const SENT = { lastOutcome: 'sent', lastHttpStatus: 202, lastAttemptAt: 1 };
const PHASE7_READY_TEXT = 'Ligado — pronto para enviar. O envio começa quando alguém falar.';
const TRACE = {
  sessionId: '1a2b3c4d-1111-1111-1111-111111111111',
  count: 2,
  lastAt: Date.UTC(2026, 9, 11, 17, 20),
  lastReason: 'rejected',
  lastHttpStatus: 500,
};

/** `act()` só comita no fim do callback: o polling é feito fora dele (ver AgenteConfigScreen.test.tsx). */
async function flushUntil(predicate: () => boolean, timeoutMs = 1_000, stepMs = 20): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, stepMs));
    });
    if (predicate()) return;
  }
  throw new Error('flushUntil: predicado não ficou verdadeiro a tempo');
}

describe('AgenteConfigScreen / rastro de falas descartadas', () => {
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

  async function renderScreen(local: Record<string, unknown>, session: Record<string, unknown>) {
    const mock = installChromeStorageMock({
      local: { [STORAGE_KEYS.agenteConfig]: READY, ...local },
      session,
      extra: { runtime: RUNTIME_STUB },
    });
    const { PlatformProvider } = await import('@/shared/platform/context');
    const { AgenteConfigScreen } = await import('./AgenteConfigScreen');
    await act(async () => {
      root.render(
        <PlatformProvider platform={UNAVAILABLE_PLATFORM}>
          <AgenteConfigScreen />
        </PlatformProvider>,
      );
    });
    await flushUntil(() => /^Ligado/.test(statusText()));
    return mock;
  }

  it('sem rastro: o parágrafo de status mostra exatamente o texto da Fase 7', async () => {
    await renderScreen({}, {});
    expect(statusText()).toBe(PHASE7_READY_TEXT);
  });

  it('com rastro e último envio ok: mostra "Ligado — último envio às …" seguido da nota', async () => {
    await renderScreen({ [STORAGE_KEYS.agenteDropTrace]: TRACE }, { [STORAGE_KEYS.agenteSendOutcome]: SENT });
    await flushUntil(() => statusText().includes('não chegaram ao Agente'));

    const when = new Date(TRACE.lastAt).toLocaleString('pt-BR');
    const text = statusText();
    expect(text.startsWith('Ligado — último envio às ')).toBe(true);
    expect(text).toContain(
      `2 falas da sessão 1a2b3c4d… não chegaram ao Agente — a última em ${when} (recusada pelo Agente, HTTP 500).`,
    );
  });

  it('a nota acompanha o service worker ao vivo e não some quando o status muda para "ok"', async () => {
    const mock = await renderScreen({}, {});
    expect(statusText()).toBe(PHASE7_READY_TEXT);

    await act(async () => {
      await mock.local.set({ [STORAGE_KEYS.agenteDropTrace]: { ...TRACE, count: 1 } });
    });
    await flushUntil(() => statusText().includes('1 fala da sessão 1a2b3c4d… não chegou ao Agente'));

    await act(async () => {
      await mock.session.set({ [STORAGE_KEYS.agenteSendOutcome]: SENT });
    });
    await flushUntil(() => statusText().includes('último envio às'));
    expect(statusText()).toContain('1 fala da sessão 1a2b3c4d… não chegou ao Agente');
  });

  it('rastro sem nenhum envio ainda: a nota vem depois do "pronto para enviar"', async () => {
    await renderScreen({ [STORAGE_KEYS.agenteDropTrace]: TRACE }, {});
    await flushUntil(() => statusText().includes('não chegaram ao Agente'));
    expect(statusText().startsWith('Ligado — pronto para enviar.')).toBe(true);
  });
});
