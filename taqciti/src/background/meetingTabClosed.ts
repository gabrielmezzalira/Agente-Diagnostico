/**
 * O que a aba da reunião fechada significa para o estado da reunião (Fase 8, TAQ-02, plano 08-26).
 *
 * Quem chama é o `chrome.tabs.onRemoved` do `index.ts`, DEPOIS do `ready` (o estado já foi hidratado). Aqui
 * mora só a regra, com `getState` e `dispatch` injetados para ela ser testável sem o Chrome.
 *
 * Fase `ended` e a aba da reunião: o resumo já está salvo no histórico, então o estado global volta ao
 * ocioso sozinho (RESET) — sem tela presa para a próxima reunião. Qualquer outra aba, aba nula ou fase
 * ociosa: nada.
 */
import type { MeetingEvent } from '@/features/meeting/machine';
import type { MeetingState } from '@/shared/types/domain';

export interface MeetingTabClosedDeps {
  getState: () => MeetingState;
  dispatch: (event: MeetingEvent) => Promise<unknown>;
}

export async function onMeetingTabRemoved(tabId: number, deps: MeetingTabClosedDeps): Promise<void> {
  const current = deps.getState();
  // `tabId` nulo nunca casa com um número: reunião sem aba conhecida não é tocada.
  if (current.session?.tabId !== tabId) return;

  if (current.phase === 'ended') {
    await deps.dispatch({ type: 'RESET' });
  }
}
