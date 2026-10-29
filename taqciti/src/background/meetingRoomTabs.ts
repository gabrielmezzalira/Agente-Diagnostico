/**
 * Adaptador do Chrome para a regra "a mesma reunião em duas abas" (Fase 10, TAQ-05, decisão D-03).
 *
 * Quando a aba dona da reunião fecha (DA-3) ou sai da sala (DA-4), as regras `meetingTabClosed.ts` e
 * `meetingTabNavigated.ts` perguntam aqui se existe OUTRA aba na mesma call. Se existir, a reunião passa para
 * ela (`MEETING_TAB_CHANGED`) em vez de encerrar. A decisão fica nas regras; este módulo só responde "qual aba".
 *
 * Por que uma memória das abas que entraram na call: a URL sozinha não distingue "dentro da call" de "parada na
 * tela de pré-entrada". Sem esta memória, uma aba aberta e nunca usada seguraria a reunião ao vivo (e o custo de
 * IA). A memória só guarda `id da aba -> código da sala`, em RAM do service worker:
 * - não é persistida e some quando o worker reinicia (nesse caso, sem outro sinal, a regra cai no encerramento
 *   seguro de sempre — a mesma direção do D-17);
 * - volta a ser aprendida pela legenda (`noteTabCaptionActivity`): legenda só existe dentro da call, então um
 *   `meet/chunk` prova que a aba está na call. `meet/participants` e `meet/captions` NÃO servem (podem vir da tela
 *   de pré-entrada) e ficam de fora de propósito;
 * - a marca "saiu da call" (`markTabLeftCall`) impede que uma legenda atrasada devolva à memória a aba que acabou
 *   de sair; só um novo `meet/detected` (`markTabJoinedCall`) a limpa.
 *
 * LGPD: este módulo lê `tab.url` só para comparar em memória com a sala. Nunca importa o logger nem o storage e
 * nunca guarda a URL — por isso não há nenhum import de `@/shared/services/*` aqui.
 */
import { isStillInMeetingRoom } from './meetingTabNavigated';

/** Padrão de URL das abas do Meet para `chrome.tabs.query` (precisa da permissão de host já declarada). */
const MEET_TABS_URL_PATTERN = '*://meet.google.com/*';

/** Abas que entraram na call e ainda não saíram: id da aba -> código da sala. Só RAM. */
const tabsInCall = new Map<number, string>();

/** Abas que saíram da call: uma legenda atrasada delas não pode devolvê-las à memória. Só RAM. */
const tabsLeftCall = new Set<number>();

/** A aba mandou `meet/detected`: entrou na call. Limpa a marca "saiu da call", se houver. */
export function markTabJoinedCall(tabId: number, meetingCode: string): void {
  tabsInCall.set(tabId, meetingCode);
  tabsLeftCall.delete(tabId);
}

/** A aba saiu (fechou ou deixou a sala): sai da memória e ganha a marca que bloqueia legenda atrasada. */
export function markTabLeftCall(tabId: number): void {
  tabsInCall.delete(tabId);
  tabsLeftCall.add(tabId);
}

/**
 * Chegou uma legenda (`meet/chunk`) desta aba: legenda só existe dentro da call, então a aba conta como "na
 * call" na sala da sessão atual. É assim que a memória se refaz depois que o worker reinicia. Síncrona e sem
 * I/O (só lê e grava a memória), para não atrasar o caminho mais frequente do worker. Sem aba, sem sessão ou com
 * a marca "saiu da call", não faz nada.
 */
export function noteTabCaptionActivity(tabId: number | undefined, meetingCode: string | undefined): void {
  if (tabId === undefined || meetingCode === undefined) return;
  if (tabsLeftCall.has(tabId)) return;
  tabsInCall.set(tabId, meetingCode);
}

/**
 * Outra aba da MESMA call, para onde a reunião pode passar (D-03). Devolve o id da primeira aba, na ordem em
 * que `chrome.tabs.query` devolve, que cumpre as três condições: (i) está na memória de "entrou na call" com o
 * mesmo código de sala (sem diferenciar maiúsculas), (ii) não é a aba excluída e (iii) a URL dela ainda é a
 * sala. Nenhuma aba assim = `null`. A rejeição da consulta propaga: quem trata (e encerra, D-17) é a regra.
 *
 * A memória é lida DEPOIS do `await` da consulta, de propósito: uma aba que fechou enquanto a consulta
 * corria já saiu da memória (`markTabLeftCall` roda síncrono no `tabs.onRemoved`) e não é escolhida.
 */
export async function findOtherRoomTab(meetingCode: string, excludeTabId: number): Promise<number | null> {
  const tabs = await chrome.tabs.query({ url: MEET_TABS_URL_PATTERN });
  const wantedCode = meetingCode.toLowerCase();
  for (const tab of tabs) {
    if (tab.id === undefined || tab.url === undefined) continue;
    if (tab.id === excludeTabId) continue;
    const registeredCode = tabsInCall.get(tab.id);
    if (registeredCode === undefined || registeredCode.toLowerCase() !== wantedCode) continue;
    if (!isStillInMeetingRoom(tab.url, meetingCode)) continue;
    return tab.id;
  }
  return null;
}
