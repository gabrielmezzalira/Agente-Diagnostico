/**
 * A aba da reunião navegou para outro lugar no meio da call, sem fechar (Fase 8, TAQ-02, decisão DA-4 =
 * navegar-encerra, opção recomendada do guia RETOMAR-AQUI — a confirmar com o time).
 *
 * Por quê: o content script morre com a navegação e nunca manda `meet/ended`. Sem esta regra a reunião ficava
 * "ao vivo" no estado, o encerramento da sessão do Agente nunca era agendado e o backend seguia chamando o
 * Gemini a cada 15/30 s à toa — o mesmo custo que o DA-3 (aba fechada) já resolve.
 *
 * Quem chama é o `chrome.tabs.onUpdated` do `index.ts`, DEPOIS do `ready`. Só importa a mudança de URL:
 * - Reunião AO VIVO na aba e a URL já não é a sala dela: dispara o MESMO `MEETING_FINISHED` do `meet/ended`
 *   (sem RESET — a reentrada na mesma sala, plano 08-24, só vale com a fase `ended`) — A MENOS QUE outra aba já
 *   tenha entrado na mesma call (D-03, Fase 10): aí a reunião só passa para ela (`MEETING_TAB_CHANGED`) e
 *   continua ao vivo. A consulta de outras abas só roda depois de provado que a aba dona saiu da sala; sem outra
 *   aba (ou com a consulta falhando, D-17) encerra como sempre. A regra é a mesma do DA-3 (`meetingTabClosed.ts`).
 * - Mesma sala (recarregar, mudar `?query` ou `#hash`), nos dois formatos do endereço (`/<código>` e
 *   `/meet/<código>`, CR-02): nada.
 * - Qualquer outra aba, aba nula, fase `ended` ou ociosa: nada.
 */
import type { MeetingEvent } from '@/features/meeting/machine';
import { meetingCodeFromPath } from '@/features/meeting/meetingCode';
import type { MeetingState } from '@/shared/types/domain';
import { handOffMeetingOrFinish } from './meetingTabClosed';

export interface MeetingTabNavigatedDeps {
  getState: () => MeetingState;
  dispatch: (event: MeetingEvent) => Promise<unknown>;
  /** Relógio injetado; o padrão é `Date.now`. */
  now?: () => number;
  /**
   * D-03: outra aba da MESMA call (id), diferente da que saiu da sala, ou `null` se não há. Opcional: ausente
   * (ou rejeitada, D-17) equivale a "sem outra aba" — a reunião encerra, como antes.
   */
  otherRoomTabId?: (meetingCode: string, excludeTabId: number) => Promise<number | null>;
}

const MEET_HOST = 'meet.google.com';

/** A URL ainda é a sala `meetingCode` do Meet? URL ilegível conta como "saiu" (não dá para provar o contrário). */
export function isStillInMeetingRoom(url: string, meetingCode: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.hostname !== MEET_HOST) return false;
  const roomCode = meetingCodeFromPath(parsed.pathname, { allowSubpath: true });
  return roomCode !== null && roomCode.toLowerCase() === meetingCode.toLowerCase();
}

export async function onMeetingTabNavigated(
  tabId: number,
  url: string,
  deps: MeetingTabNavigatedDeps,
): Promise<void> {
  const current = deps.getState();
  const session = current.session;
  if (session === null || session.tabId !== tabId) return;
  if (current.phase !== 'captionsRequired' && current.phase !== 'recording' && current.phase !== 'paused') return;
  if (isStillInMeetingRoom(url, session.meetingCode)) return;
  await handOffMeetingOrFinish(deps, session.meetingCode, tabId);
}
