/**
 * Fakes das portas `ClientDirectory` e `AgenteSessionGateway` para os testes do seletor e dos
 * fluxos que o usam. Em memória, sem rede, com contadores de chamadas.
 */
import {
  DuplicateClientError,
  type AgenteSessionGateway,
  type ClientDirectory,
  type ClientSummary,
} from '@/features/agente/clientDirectory';
import { foldText, isDuplicateClientName } from '@/features/agente/clientSearch';

export interface FakeClientDirectory extends ClientDirectory {
  readonly listCalls: number;
  readonly createCalls: number;
}

export function createFakeClientDirectory(
  initial: readonly ClientSummary[],
): FakeClientDirectory {
  const clients: ClientSummary[] = [...initial];
  let listCalls = 0;
  let createCalls = 0;
  return {
    get listCalls() {
      return listCalls;
    },
    get createCalls() {
      return createCalls;
    },
    list: () => {
      listCalls += 1;
      return Promise.resolve([...clients]);
    },
    create: (name) => {
      createCalls += 1;
      if (isDuplicateClientName(name, clients))
        return Promise.reject(new DuplicateClientError());
      const trimmed = name.trim();
      const created: ClientSummary = {
        id: `fake-client-${clients.length + 1}-${foldText(trimmed).replace(/\s+/g, '-')}`,
        client: trimmed,
        name: trimmed,
      };
      clients.push(created);
      return Promise.resolve(created);
    },
  };
}

export interface FakeSessionGateway extends AgenteSessionGateway {
  readonly calls: ReadonlyArray<{ clientId: string; name: string }>;
}

/** UUIDs fixos e sequenciais ("00000000-0000-4000-8000-00000000000N"); `failWith` faz falhar. */
export function createFakeSessionGateway(
  options: { failWith?: Error } = {},
): FakeSessionGateway {
  const calls: Array<{ clientId: string; name: string }> = [];
  return {
    calls,
    createSession: (clientId, name) => {
      calls.push({ clientId, name });
      if (options.failWith) return Promise.reject(options.failWith);
      const suffix = String(calls.length).padStart(12, '0');
      return Promise.resolve({ sessionId: `00000000-0000-4000-8000-${suffix}` });
    },
  };
}
