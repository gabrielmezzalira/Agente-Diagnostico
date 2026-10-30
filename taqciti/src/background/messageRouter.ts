/**
 * Roteador das mensagens validadas (content script, painéis e histórico) para a máquina de estados, o
 * histórico local e o vínculo reunião → cliente. `registerMessageRouter` assina `runtime.onMessage` de
 * forma SÍNCRONA (exigência do MV3); o handler espera o `ready` por dentro.
 */
import { PROVIDER_GOOGLE_MEET } from '@/shared/config/constants';
import { onMessage } from '@/shared/services/messaging';
import { dispatch, getState } from './sessionController';
import { deleteRecord, patchRecord } from './history';
import { bumpMetrics } from './metrics';
import { openWideView } from './sidePanel';
import { rememberPanelTab } from './panelTabs';
import { onMeetingEndedInTab } from './meetingEndedInTab';
import {
  findOtherRoomTab,
  markTabJoinedCall,
  markTabLeftCall,
  noteTabCaptionActivity,
} from './meetingRoomTabs';
import { agenteAssociation } from './agenteAssociation';
import { releaseMeetingAssociation } from './agenteAssociationRelease';
import { shouldStartFreshMeeting } from './agenteFreshStart';

function defaultTitle(now: Date): string {
  const date = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `Reunião de ${date} às ${time}`;
}

export function registerMessageRouter(ready: Promise<void>): void {
  onMessage((message, sender) => {
    return (async () => {
      await ready;
      const now = Date.now();

      switch (message.type) {
        // ---- Content script ----
        case 'meet/detected': {
          // D-03: a aba entrou na call; a memória das abas na call só existe para a regra de "outra aba na sala".
          if (sender.tab?.id !== undefined) markTabJoinedCall(sender.tab.id, message.meetingCode);
          const givenTitle = message.title.trim();
          const startFresh = await shouldStartFreshMeeting(getState(), message.meetingCode);
          await dispatch({
            type: 'MEETING_DETECTED',
            meetingId: crypto.randomUUID(),
            meetingCode: message.meetingCode,
            provider: PROVIDER_GOOGLE_MEET,
            tabId: sender.tab?.id ?? null,
            title: givenTitle || defaultTitle(new Date(now)),
            titleAuto: givenTitle.length === 0,
            captionsEnabled: message.captionsEnabled,
            at: now,
            ...(startFresh && { startFresh: true }),
          });
          return getState();
        }
        case 'meet/ended': {
          // D-16: o aviso de uma aba que NÃO é a dona não encerra a reunião; o da dona segue a regra do D-03.
          await onMeetingEndedInTab(sender.tab?.id ?? null, {
            getState,
            dispatch,
            now: () => now,
            otherRoomTabId: findOtherRoomTab,
            markLeftCall: markTabLeftCall,
          });
          return getState();
        }
        case 'meet/captions':
          return dispatch({ type: 'CAPTIONS_STATE', enabled: message.enabled });
        case 'meet/chunk':
          // D-03: legenda só existe dentro da call — reaprende a aba como "na call" depois do reinício do worker.
          // Só aqui (nunca em meet/participants nem meet/captions, que podem vir da pré-entrada). Síncrono, sem I/O.
          noteTabCaptionActivity(sender.tab?.id, getState().session?.meetingCode);
          return dispatch({ type: 'CAPTION_CHUNK', chunk: message.chunk });
        case 'meet/participants':
          return dispatch({
            type: 'PARTICIPANTS_UPDATED',
            participants: message.participants,
          });
        case 'meet/accountContext':
          // Sem autenticação de produto nesta versão: só a conta do Meet
          // observada, nunca comparada com nenhuma conta "oficial".
          return dispatch({
            type: 'ACCOUNT_BOUNDARY_UPDATED',
            boundary: {
              meet: message.context,
              product: null,
              mismatch: false,
            },
          });
        case 'meet/speakersMerged':
          return dispatch({ type: 'SPEAKERS_MERGED', renames: message.renames });
        case 'meet/reconnect':
          return dispatch({ type: 'RECONNECT' });
        case 'meet/captureDegraded':
          await bumpMetrics({
            captureDegradedTotal: 1,
            ...(message.reason === 'parser' ? { parserFailuresTotal: 1 } : {}),
          });
          return dispatch({ type: 'CAPTURE_DEGRADED', at: now });
        case 'panel/openRequest':
          // "Abrir numa aba", clicado dentro do painel. Abre a mesma tela do
          // painel lateral numa aba, que é o caminho que não depende de um gesto
          // do usuário — ver src/background/sidePanel.ts para o porquê. O alvo
          // vem do painel porque só ele sabe de qual tela o clique partiu.
          return {
            ok: await openWideView(sender.tab, {
              history: message.view === 'history',
              recordId: message.recordId ?? null,
            }),
          };
        // ---- UIs (painel lateral / painel injetado) ----
        case 'panel/mounted': {
          // Um painel nasceu nesta aba: a partir de agora o estado ao vivo tem
          // para onde ir. Ver a nota de `panel/mounted` em types/messages.ts.
          if (sender.tab?.id !== undefined) await rememberPanelTab(sender.tab.id);
          return getState();
        }
        case 'ui/getState':
          return getState();
        case 'ui/pause':
          return dispatch({ type: 'PAUSE' });
        case 'ui/resume':
          return dispatch({ type: 'RESUME' });
        case 'ui/clearTranscript':
          return dispatch({ type: 'CLEAR_TRANSCRIPT' });
        case 'ui/finish':
          return dispatch({ type: 'MEETING_FINISHED', at: now });
        case 'ui/rename':
          await dispatch({ type: 'RENAME', title: message.title });
          return { ok: true };
        case 'ui/reset':
          return dispatch({ type: 'RESET' });
        case 'ui/dismissLanguageWarning':
          return dispatch({ type: 'LANGUAGE_WARNING_DISMISSED' });

        // ---- Histórico ----
        case 'ui/history/delete': {
          const current = getState();
          if (current.session?.meetingId === message.id && current.phase === 'ended') {
            await dispatch({ type: 'RESET' });
          }
          await deleteRecord(message.id);
          await releaseMeetingAssociation(message.id);
          return { ok: true };
        }
        case 'ui/history/rename': {
          await patchRecord(message.id, { title: message.title });
          if (getState().session?.meetingId === message.id) {
            await dispatch({ type: 'RENAME', title: message.title });
          }
          return { ok: true };
        }
        // ---- Vínculo reunião → cliente (Fase 8): toda a lógica mora em agenteAssociation ----
        case 'ui/agente/clients/list':
          return agenteAssociation.listClients();
        case 'ui/agente/meeting/open':
          return agenteAssociation.open(message.meetingId);
        case 'ui/agente/meeting/defer':
          return agenteAssociation.defer(message.meetingId);
        case 'ui/agente/meeting/bind':
          return agenteAssociation.bind(message.meetingId, message.target);
        case 'ui/agente/meeting/discard':
          return agenteAssociation.discard(message.meetingId);
        case 'ui/agente/meeting/resume-send':
          return agenteAssociation.resumeSend(message.meetingId);
        case 'state/updated':
          return undefined;
      }
    })();
  });
}
