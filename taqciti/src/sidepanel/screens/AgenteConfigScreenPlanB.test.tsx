/**
 * Tela "Agente Diagnóstico" como plano B do vínculo por reunião (Fase 8, plano 08-18, decisões D-02 e
 * B5 = `vincular-ao-vivo`): o campo de ID só aparece quando a lista de clientes falha; salvar um ID
 * válido vincula a reunião AO VIVO ainda sem cliente (comando manual) e nunca vira destino de
 * reuniões futuras (critério 3). Mesmo padrão de montagem de AgenteConfigScreen.test.tsx
 * (createRoot + act, storage simulado), com uma plataforma falsa que registra os comandos.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssociationState } from '@/features/agente/association';
import { DEFAULT_AGENTE_CONFIG } from '@/shared/config/agenteConfig';
import { STORAGE_KEYS } from '@/shared/config/constants';
import type { Platform } from '@/shared/platform/types';
import type { MeetingState } from '@/shared/types/domain';
import type { UiCommand } from '@/shared/types/messages';
import { installChromeStorageMock } from '@/test/chromeStorageMock';

const RUNTIME_STUB = { getURL: (path: string) => `chrome-extension://taqciti/${path}` };
const SUPPORT_TEXT = 'A associação é feita a cada reunião, pelo ícone “!” no painel do Meet.';
const UUID = '33333333-3333-3333-3333-333333333333';
const LIVE_MEETING = { phase: 'recording', session: { meetingId: 'm1' } } as unknown as MeetingState;
const IDLE_MEETING = { phase: 'idle', session: null } as MeetingState;

type ListBehavior = 'loading' | 'ready' | 'error';

function typeInto(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

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

describe('AgenteConfigScreen / plano B do ID (B5 vincular-ao-vivo, D-02)', () => {
  let host: HTMLDivElement;
  let root: Root;
  let sent: UiCommand[];

  beforeEach(() => {
    vi.resetModules();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    sent = [];
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  function statusText(): string {
    return host.querySelector('[aria-live="polite"]')?.textContent ?? '';
  }

  const sessionIdField = () => host.querySelector<HTMLInputElement>('#agente-session-id');
  const bindCommands = () => sent.filter((command) => command.type === 'ui/agente/meeting/bind');

  function makePlatform(list: ListBehavior, meeting: MeetingState): Platform {
    return {
      kind: 'extension',
      send: <R,>(command: UiCommand): Promise<R | null> => {
        sent.push(command);
        if (command.type === 'ui/agente/clients/list') {
          if (list === 'loading') return new Promise<R | null>(() => {});
          const result = list === 'ready' ? { ok: true, clients: [] } : { ok: false, error: 'unavailable' };
          return Promise.resolve(result as R);
        }
        return Promise.resolve({ ok: true } as R);
      },
      subscribeMeeting: (onState) => {
        onState(meeting);
        return () => {};
      },
      subscribeHistory: () => () => {},
    };
  }

  async function renderScreen(options: {
    list: ListBehavior;
    meeting?: MeetingState;
    association?: AssociationState;
    config?: Partial<typeof DEFAULT_AGENTE_CONFIG>;
  }) {
    installChromeStorageMock({
      local: {
        [STORAGE_KEYS.agenteConfig]: { ...DEFAULT_AGENTE_CONFIG, ...options.config },
        ...(options.association !== undefined && {
          [STORAGE_KEYS.agenteAssociations]: { m1: { meetingId: 'm1', state: options.association } },
        }),
      },
      session: {},
      extra: { runtime: RUNTIME_STUB },
    });
    // O provider vem do mesmo registro de módulos da tela (vi.resetModules): um import estático
    // criaria outro contexto React e o usePlatform() da tela continuaria lançando.
    const { PlatformProvider } = await import('@/shared/platform/context');
    const { AgenteConfigScreen } = await import('./AgenteConfigScreen');
    const platform = makePlatform(options.list, options.meeting ?? IDLE_MEETING);
    await act(async () => {
      root.render(
        <PlatformProvider platform={platform}>
          <AgenteConfigScreen />
        </PlatformProvider>,
      );
    });
    await flushUntil(() => statusText() !== '');
    // Dá tempo de a associação chegar do storage e da lista responder.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  }

  async function saveWithId(id: string): Promise<void> {
    const field = sessionIdField()!;
    const saveButton = [...host.querySelectorAll('button')].find((b) => /salv/i.test(b.textContent ?? ''))!;
    typeInto(field, id);
    await act(async () => {
      saveButton.click();
    });
    await flushUntil(() => /salvo/i.test(saveButton.textContent ?? ''));
  }

  it('lista carregando: o campo de ID não é mostrado nem o texto de apoio', async () => {
    await renderScreen({ list: 'loading' });
    expect(sessionIdField()).toBeNull();
    expect(host.textContent).not.toContain(SUPPORT_TEXT);
  });

  it('lista carregada: sem campo, só o texto de apoio novo', async () => {
    await renderScreen({ list: 'ready' });
    expect(sessionIdField()).toBeNull();
    expect(host.textContent).toContain(SUPPORT_TEXT);
  });

  it('lista falhou (plano B): o campo aparece com o rótulo e o placeholder de hoje', async () => {
    await renderScreen({ list: 'error' });
    const field = sessionIdField();
    expect(field).not.toBeNull();
    expect(field!.placeholder).toBe('cole aqui o ID (UUID) da sessão ativa');
    expect(host.querySelector('label[for="agente-session-id"]')?.textContent).toBe('ID da sessão do Agente');
    expect(host.textContent).toContain('se houver uma reunião em andamento sem cliente');
  });

  it('prontidão não exige o ID: ligado + URL válida + ID vazio mostra "pronto para enviar"', async () => {
    await renderScreen({
      list: 'ready',
      config: { streamingEnabled: true, agenteBackendUrl: 'https://agente.test' },
    });
    expect(statusText()).toBe('Ligado — pronto para enviar. O envio começa quando alguém falar.');
  });

  it('URL inválida continua mostrando o texto de URL inválida', async () => {
    await renderScreen({
      list: 'ready',
      config: { streamingEnabled: true, agenteBackendUrl: 'http://agente.empresa.com' },
    });
    expect(statusText()).toBe('A URL do backend não é válida — nada é enviado.');
  });

  it('salvar um UUID com reunião ao vivo deferred manda UM comando de vínculo manual', async () => {
    await renderScreen({ list: 'error', meeting: LIVE_MEETING, association: 'deferred' });
    await saveWithId(UUID);

    expect(bindCommands()).toEqual([
      {
        type: 'ui/agente/meeting/bind',
        meetingId: 'm1',
        target: { kind: 'manual', sessionId: UUID },
      },
    ]);
  });

  it('(T-08-36) sem reunião ao vivo, salvar só guarda: nenhum comando de vínculo', async () => {
    await renderScreen({ list: 'error', meeting: IDLE_MEETING });
    await saveWithId(UUID);
    expect(bindCommands()).toHaveLength(0);
  });

  it('(T-08-36) reunião ao vivo já linked: salvar não manda comando', async () => {
    await renderScreen({ list: 'error', meeting: LIVE_MEETING, association: 'linked' });
    await saveWithId(UUID);
    expect(bindCommands()).toHaveLength(0);
  });

  it('(T-08-36) ID que não é UUID: salvar não manda comando', async () => {
    await renderScreen({ list: 'error', meeting: LIVE_MEETING, association: 'deferred' });
    await saveWithId('nao-e-um-uuid');
    expect(bindCommands()).toHaveLength(0);
  });

  it('(T-08-36) salvar só a URL não revincula a reunião ao ID já guardado', async () => {
    await renderScreen({
      list: 'error',
      meeting: LIVE_MEETING,
      association: 'deferred',
      config: { agenteSessionId: UUID },
    });
    const url = host.querySelector<HTMLInputElement>('#agente-backend-url')!;
    const saveButton = [...host.querySelectorAll('button')].find((b) => /salv/i.test(b.textContent ?? ''))!;
    typeInto(url, 'https://novo.exemplo');
    await act(async () => {
      saveButton.click();
    });
    await flushUntil(() => /salvo/i.test(saveButton.textContent ?? ''));
    expect(bindCommands()).toHaveLength(0);
  });
});
