/**
 * O que um `meet/ended` significa quando a mesma reunião está aberta em duas abas (Fase 10, TAQ-05, D-16, D-17).
 *
 * Por que existe: o `index.ts` tratava `meet/ended` sem olhar de qual aba ele veio. Quem estava na call em duas
 * abas e saía só da segunda encerrava a reunião da primeira. Aqui mora só a regra, com `getState`, `dispatch`, o
 * relógio e as consultas de abas injetados, para ela ser testável sem o Chrome.
 *
 * A regra, nesta ordem:
 * 1. A aba que mandou o aviso deixou de estar "na call" (`markLeftCall`): uma aba parada na tela "Você saiu da
 *    reunião" não pode segurar a reunião ao vivo e o gasto de IA (T-10-12).
 * 2. Sem reunião ao vivo (`idle`/`ended`) ou sem sessão: despacha `MEETING_FINISHED`, como sempre foi (a máquina
 *    ignora fora de fase ao vivo).
 * 3. Aba que mandou o aviso e aba dona são conhecidas e diferentes: NÃO encerra (D-16). A reunião é da outra aba.
 * 4. Aba dona e aba que mandou são a mesma: mesma regra do D-03 (`handOffMeetingOrFinish`) — se outra aba ainda
 *    está na call da mesma sala, a reunião passa para ela; senão encerra. Consulta que falha = encerra (D-17).
 * 5. Aba desconhecida (sem `sender.tab`, ou sessão sem aba dona): encerra, como hoje.
 */
import type { MeetingEvent } from '@/features/meeting/machine';
import type { MeetingState } from '@/shared/types/domain';
import { handOffMeetingOrFinish } from './meetingTabClosed';

export interface MeetingEndedInTabDeps {
  getState: () => MeetingState;
  dispatch: (event: MeetingEvent) => Promise<unknown>;
  /** Relógio injetado; o padrão é `Date.now`. */
  now?: () => number;
  /** D-03: outra aba da MESMA call, diferente da excluída, ou `null`. Ausente ou rejeitada = encerra (D-17). */
  otherRoomTabId?: (meetingCode: string, excludeTabId: number) => Promise<number | null>;
  /** Marca a aba como "fora da call" na memória em RAM do 10-02 (`markTabLeftCall`). */
  markLeftCall?: (tabId: number) => void;
}

/** Fases em que a reunião está ao vivo e um `meet/ended` pode mesmo encerrá-la. */
function isLivePhase(phase: MeetingState['phase']): boolean {
  return phase === 'captionsRequired' || phase === 'recording' || phase === 'paused';
}

export async function onMeetingEndedInTab(
  senderTabId: number | null,
  deps: MeetingEndedInTabDeps,
): Promise<void> {
  if (senderTabId !== null) deps.markLeftCall?.(senderTabId);

  const current = deps.getState();
  const session = current.session;
  const finish = () => deps.dispatch({ type: 'MEETING_FINISHED', at: (deps.now ?? Date.now)() });

  if (!isLivePhase(current.phase) || session === null || session === undefined) {
    await finish();
    return;
  }

  if (senderTabId === null || session.tabId === null || session.tabId === undefined) {
    await finish();
    return;
  }

  // D-16: o aviso veio de uma aba que não é a dona — a reunião acompanhada é de outra aba, então não encerra.
  if (senderTabId !== session.tabId) return;

  await handOffMeetingOrFinish(deps, session.meetingCode, senderTabId);
}
