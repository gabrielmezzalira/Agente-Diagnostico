/**
 * Harness dos testes de componente que dependem do vínculo com o Agente (Fase 8, plano 08-14):
 * uma plataforma falsa (`send` registra os comandos e responde o que o teste programou) e o
 * `chrome.storage.local` simulado, de onde os hooks leem a associação e a entrega — o mesmo caminho
 * de produção, só que sem service worker. Padrão createRoot + act (sem testing-library).
 */
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { MeetingAssociation } from '@/features/agente/association';
import { STORAGE_KEYS } from '@/shared/config/constants';
import type { AgenteDelivery } from '@/shared/config/agenteDeliveryStore';
import { PlatformProvider } from '@/shared/platform/context';
import type { Platform } from '@/shared/platform/types';
import type { UiCommand } from '@/shared/types/messages';
import { installChromeStorageMock } from './chromeStorageMock';

type Responder = (command: UiCommand) => unknown;

export function createAgenteHarness() {
  const sent: UiCommand[] = [];
  let responder: Responder = () => ({ ok: true });
  let mock: ReturnType<typeof installChromeStorageMock>;
  let host: HTMLDivElement;
  let root: Root;

  const platform: Platform = {
    kind: 'extension',
    send: <R,>(command: UiCommand): Promise<R | null> => {
      sent.push(command);
      return Promise.resolve(responder(command) as R | null);
    },
    subscribeMeeting: () => () => {},
    subscribeHistory: () => () => {},
  };

  return {
    sent,
    get host() {
      return host;
    },
    /** Comandos mandados desde o início, filtrados pelo `type`. */
    commandsOf: (type: UiCommand['type']) => sent.filter((command) => command.type === type),
    respondWith(next: Responder) {
      responder = next;
    },
    start(association: MeetingAssociation | null, delivery?: AgenteDelivery) {
      (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
      mock = installChromeStorageMock({
        local: {
          ...(association !== null && { [STORAGE_KEYS.agenteAssociations]: { [association.meetingId]: association } }),
          ...(delivery !== undefined && { [STORAGE_KEYS.agenteDelivery]: delivery }),
        },
      });
      host = document.createElement('div');
      document.body.append(host);
      root = createRoot(host);
    },
    async render(node: ReactElement) {
      await act(async () => {
        root.render(<PlatformProvider platform={platform}>{node}</PlatformProvider>);
      });
    },
    /** Simula o service worker gravando a associação (dispara o `onChanged` dos painéis). */
    async writeAssociation(association: MeetingAssociation | null) {
      await act(async () => {
        await mock.local.set({
          [STORAGE_KEYS.agenteAssociations]:
            association === null ? {} : { [association.meetingId]: association },
        });
      });
    },
    async writeDelivery(delivery: AgenteDelivery) {
      await act(async () => {
        await mock.local.set({ [STORAGE_KEYS.agenteDelivery]: delivery });
      });
    },
    async click(target: Element | null | undefined) {
      await act(async () => {
        (target as HTMLElement).click();
      });
    },
    buttonByText: (text: string) =>
      Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim() === text),
    async stop() {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}
