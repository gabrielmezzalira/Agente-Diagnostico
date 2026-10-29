/**
 * O que a aba da reunião fechada significa para o estado da reunião (Fase 8, TAQ-02, plano 08-26).
 *
 * Quem chama é o `chrome.tabs.onRemoved` do `index.ts`, DEPOIS do `ready` (o estado já foi hidratado). Aqui
 * mora só a regra, com `getState`, `dispatch` e o relógio injetados para ela ser testável sem o Chrome.
 *
 * - Reunião AO VIVO (`captionsRequired`, `recording` ou `paused`) e a aba da reunião: conta como o FIM dela
 *   (decisão DA-3 = fechar-aba-encerra) — A MENOS QUE outra aba já tenha entrado na mesma call (D-03, Fase 10):
 *   aí a reunião só passa para ela (`MEETING_TAB_CHANGED`, ver `handOffMeetingOrFinish`) e continua ao vivo.
 *   Sem outra aba (ou com a consulta falhando, D-17), dispara o MESMO `MEETING_FINISHED` do `meet/ended`, então
 *   o registro final, as métricas e o ciclo de vida da associação (e, com o encerramento da sessão do Agente,
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
  /**
   * D-03: outra aba da MESMA call (id), diferente da que está saindo, ou `null` se não há. Opcional: ausente
   * (ou rejeitada, D-17) equivale a "sem outra aba" — a reunião encerra, como antes.
   */
  otherRoomTabId?: (meetingCode: string, excludeTabId: number) => Promise<number | null>;
}

/**
 * A aba dona saiu da sala (fechou ou navegou). Se outra aba ainda está na mesma call, a reunião passa para ela
 * (`MEETING_TAB_CHANGED`); senão encerra (`MEETING_FINISHED`, o mesmo evento do `meet/ended`). Consulta
 * ausente ou que rejeita = "sem outra aba" (D-17: na dúvida, falha segura = encerra, como sempre foi).
 * Compartilhada pelas regras DA-3 (aba fechada) e DA-4 (aba navegou).
 */
export async function handOffMeetingOrFinish(
  deps: Pick<MeetingTabClosedDeps, 'dispatch' | 'now' | 'otherRoomTabId'>,
  meetingCode: string,
  leavingTabId: number,
): Promise<void> {
  let otherTabId: number | null = null;
  try {
    otherTabId = (await deps.otherRoomTabId?.(meetingCode, leavingTabId)) ?? null;
  } catch {
    otherTabId = null;
  }

  if (otherTabId !== null) {
    await deps.dispatch({ type: 'MEETING_TAB_CHANGED', tabId: otherTabId });
    return;
  }
  await deps.dispatch({ type: 'MEETING_FINISHED', at: (deps.now ?? Date.now)() });
}

export async function onMeetingTabRemoved(tabId: number, deps: MeetingTabClosedDeps): Promise<void> {
  const current = deps.getState();
  const session = current.session;
  if (session?.tabId !== tabId) return;

  switch (current.phase) {
    case 'captionsRequired':
    case 'recording':
    case 'paused':
      await handOffMeetingOrFinish(deps, session.meetingCode, tabId);
      return;
    case 'ended':
      await deps.dispatch({ type: 'RESET' });
      return;
    case 'idle':
      return;
  }
}
