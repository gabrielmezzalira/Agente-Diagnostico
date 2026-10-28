/**
 * A composição de produção do feed do painel AGP (Fase 10, TAQ-05): liga o `createAgpQuestionsFeed` ao
 * WebSocket do navegador, ao storage e à reunião de agora. Sem tocar no `sessionController`: o feed reage às
 * mudanças do `chrome.storage` (associações, config e estado da reunião) e ao boot do service worker.
 *
 * O listener é registrado de forma síncrona no topo do módulo (exigência do MV3); a avaliação espera o `ready`
 * (estado hidratado) por dentro, e sempre por trás de um `await`, para o leitor de config e o store de
 * associações já terem processado a mesma mudança antes de o alvo ser recalculado.
 */
import { selectAgpTarget } from '@/features/agente/agpTarget';
import { loadAssociations } from '@/shared/config/agenteAssociationStore';
import { createAgenteConfigReader } from '@/shared/config/agenteConfigStore';
import { buildAgpSocketUrl } from '@/shared/config/agenteRoutes';
import { writeAgpFeed } from '@/shared/config/agpQuestionsStore';
import { STORAGE_KEYS } from '@/shared/config/constants';
import { logger } from '@/shared/services/log';
import { isLivePhase } from './agenteAssociationLifecycle';
import { openBrowserSocket } from './agpBrowserSocket';
import { createAgpQuestionsFeed, type AgpFeedTarget } from './agpQuestionsFeed';
import { getState } from './sessionController';

const readConfig = createAgenteConfigReader();

async function selectTarget(): Promise<AgpFeedTarget | null> {
  const state = getState();
  const liveMeetingId = isLivePhase(state) ? (state.session?.meetingId ?? null) : null;
  const target = selectAgpTarget(await loadAssociations(), liveMeetingId);
  if (target === null) return null;
  const url = buildAgpSocketUrl((await readConfig()).agenteBackendUrl, target.sessionId);
  return url === null ? null : { sessionId: target.sessionId, url };
}

export const agpQuestionsFeed = createAgpQuestionsFeed({
  selectTarget,
  openSocket: openBrowserSocket,
  write: writeAgpFeed,
  setTimer: (callback, ms) => setTimeout(callback, ms),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  onError: (message, error) => logger.error(message, error),
});

/** O que muda o alvo: o vínculo da reunião, a URL do backend e a fase da reunião (flush do `taq:state`). */
function changesTarget(changes: Record<string, unknown>, area: string): boolean {
  if (area === 'local') return STORAGE_KEYS.agenteAssociations in changes || STORAGE_KEYS.agenteConfig in changes;
  return area === 'session' && STORAGE_KEYS.state in changes;
}

export function registerAgpQuestionsFeed(ready: Promise<void>): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (changesTarget(changes, area)) void ready.then(() => agpQuestionsFeed.reconcile());
  });
  void ready.then(() => agpQuestionsFeed.reconcile());
}
