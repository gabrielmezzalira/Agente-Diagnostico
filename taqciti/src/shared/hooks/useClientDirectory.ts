/**
 * A lista de clientes do seletor, sob demanda (Fase 8, D-08, D-02). Só busca quando `enabled` (o
 * seletor está aberto) e só por comando `ui/agente/clients/list` — quem fala com o backend é o service
 * worker. `error` (lista indisponível ou fora do contrato) é o que liga o plano B do ID manual.
 */
import { useCallback, useEffect, useState } from 'react';
import type { ClientSummary } from '@/features/agente/clientDirectory';
import { usePlatform } from '@/shared/platform/context';
import { sendAgenteCommand } from './useMeetingAssociation';

export type ClientDirectoryStatus = 'loading' | 'ready' | 'error';

export interface ClientDirectoryApi {
  status: ClientDirectoryStatus;
  clients: readonly ClientSummary[];
  retry: () => void;
}

export function useClientDirectory(enabled: boolean): ClientDirectoryApi {
  const platform = usePlatform();
  const [status, setStatus] = useState<ClientDirectoryStatus>('loading');
  const [clients, setClients] = useState<readonly ClientSummary[]>([]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let current = true;
    setStatus('loading');
    void sendAgenteCommand(platform, { type: 'ui/agente/clients/list' }).then((result) => {
      if (!current) return;
      if (result.ok && result.clients !== undefined) {
        setClients(result.clients);
        setStatus('ready');
      } else {
        setStatus('error');
      }
    });
    return () => {
      current = false;
    };
  }, [enabled, platform, attempt]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  return { status, clients, retry };
}
