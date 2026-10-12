/**
 * O que a aba da reunião fechada significa para o estado da reunião (Fase 8, TAQ-02, plano 08-26).
 *
 * Quem chama é o `chrome.tabs.onRemoved` do `index.ts`, DEPOIS do `ready` (o estado já foi hidratado). Aqui
 * mora só a regra, com `getState`, `dispatch` e o relógio injetados para ela ser testável sem o Chrome.
 *
 * - Reunião AO VIVO (`captionsRequired`, `recording` ou `paused`) e a aba da reunião: conta como o FIM dela
 *   (decisão DA-3 = fechar-aba-encerra). Dispara o MESMO `MEETING_FINISHED` do `meet/ended`, então o
 *   registro final, as métricas e o ciclo de vida da associação (e, com o encerramento da sessão do Agente,
 *   a sessão) seguem o caminho de sempre. Sem RESET: o estado fica em `ended`, como depois de um
 *   `meet/ended`, porque a regra de reentrada na mesma sala só vale com a fase `ended`.
 * - Fase `ended` e a aba da reunião: o resumo já está salvo no histórico, então o estado global volta ao
 *   ocioso sozinho (RESET) — sem tela presa para a próxima reunião.
 * - Qualquer outra aba, aba nula ou fase ociosa: nada (`tabId` nulo nunca casa com um número).
 */
import type { MeetingEvent } from '@/features/meeting/machine';
import type { MeetingState } from '@/shared/types/domain';

export interface MeetingTabClosedDeps {
  getState: () => MeetingState;
  dispatch: (event: MeetingEvent) => Promise<unknown>;
  /** Relógio injetado; o padrão é `Date.now`. */
  now?: () => number;
}

export async function onMeetingTabRemoved(tabId: number, deps: MeetingTabClosedDeps): Promise<void> {
  const current = deps.getState();
  if (current.session?.tabId !== tabId) return;

  switch (current.phase) {
    case 'captionsRequired':
    case 'recording':
    case 'paused':
      await deps.dispatch({ type: 'MEETING_FINISHED', at: (deps.now ?? Date.now)() });
      return;
    case 'ended':
      await deps.dispatch({ type: 'RESET' });
      return;
    case 'idle':
      return;
  }
}
