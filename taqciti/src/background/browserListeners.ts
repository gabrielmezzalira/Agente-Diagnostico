/**
 * Listeners dos eventos do navegador: instalação, clique no ícone, abas fechadas ou navegadas, abertura
 * do navegador e alarmes. `registerBrowserListeners` registra TODOS de forma síncrona (exigência do MV3:
 * o evento acorda o service worker e só os handlers já registrados no topo o recebem); os handlers cuja
 * regra depende do estado hidratado esperam o `ready` por dentro.
 */
import { logger } from '@/shared/services/log';
import { dispatch, getState } from './sessionController';
import { backfillOpenTabs, canInject, ensurePanelInTab } from './injectPanel';
import { openWideView } from './sidePanel';
import { forgetPanelTab } from './panelTabs';
import { onMeetingTabRemoved } from './meetingTabClosed';
import { onMeetingTabNavigated } from './meetingTabNavigated';
import { findOtherRoomTab, markTabLeftCall, noteTabUrlChanged } from './meetingRoomTabs';
import { agenteSessionFinisher } from './agenteSessionFinisher';
import { patchPanelPrefs } from '@/features/panel/prefsStore';

export function registerBrowserListeners(ready: Promise<void>): void {
  /**
   * Primeira execução depois de instalar (ou atualizar).
   *
   * A única coisa que o background faz pela presença do painel. Dali em diante
   * quem o põe em toda página é o Chrome, pelo `content_scripts` do manifesto —
   * o que sobra aqui é alcançar as abas que já estavam abertas no instante da
   * instalação, porque content script declarado só entra em documento que nasce
   * depois dele.
   *
   * O `await ready` não é decoração: garante que migrações e estado padrão
   * existam ANTES de qualquer painel pedir estado. Sem isso a primeira execução
   * seria uma corrida entre a inicialização e a primeira mensagem.
   */
  chrome.runtime.onInstalled.addListener(() => {
    void (async () => {
      await ready;
      const reached = await backfillOpenTabs();
      logger.info('primeira execução: abas alcançadas', { attempts: reached });
    })();
  });

  /*
   * O clique no ícone: o TaqCITi VOLTA.
   *
   * É uma gravação no storage, e nada mais. O painel já está montado em toda
   * página aberta, assinando essa chave — então `presence: 'open'` chega até ele
   * pelo mesmo caminho por onde chegam as mudanças feitas em qualquer outra aba.
   * Não há injeção, nem mensagem endereçada, nem "clicar duas vezes porque a
   * primeira não pegou": este é o gesto que desfaz o X.
   *
   * Páginas internas do Chrome (chrome://, a Web Store, a aba nova) não aceitam
   * extensão nenhuma: não há onde desenhar o painel. Ali a saída é o TaqCITi
   * inteiro numa aba — a mesma tela larga do botão "Abrir numa aba", e não uma
   * superfície diferente só porque o ponto de partida era diferente.
   */
  chrome.action.onClicked.addListener((tab) => {
    if (!canInject(tab.url)) {
      void openWideView(tab);
      return;
    }
    // A gravação primeiro: se a rede de segurança abaixo precisar mesmo montar um
    // painel, ele já nasce lendo `open` em vez de aparecer recolhido.
    void patchPanelPrefs({ presence: 'open' }).then(() => ensurePanelInTab(tab));
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    // A aba levou o painel injetado junto — não adianta mais endereçar broadcast
    // pra ela. Fora do `ready` de propósito: podar a lista não depende do estado.
    void forgetPanelTab(tabId);

    // A aba saiu da call: tira da memória das abas na call e bloqueia legenda atrasada dela (D-03). Síncrono e
    // fora do `ready` de propósito — precisa valer ANTES de a consulta da regra abaixo terminar.
    markTabLeftCall(tabId);

    // A aba da reunião fechou: a regra (e o porquê) mora em meetingTabClosed.ts. Com outra aba na mesma call, a
    // reunião passa para ela em vez de encerrar (D-03).
    void ready.then(() =>
      onMeetingTabRemoved(tabId, { getState, dispatch, now: Date.now, otherRoomTabId: findOtherRoomTab }),
    );
  });

  // A aba da reunião foi para outro lugar sem fechar (DA-4): a regra mora em meetingTabNavigated.ts. Com outra aba
  // na mesma call, a reunião passa para ela em vez de encerrar (D-03).
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url === undefined) return;
    const url = changeInfo.url;
    // A aba que deixou a sala sai da memória das abas na call (D-03). Síncrono e fora do `ready`, como o
    // `forgetPanelTab`: podar a memória não depende do estado, e precisa valer antes da consulta da regra.
    noteTabUrlChanged(tabId, url);
    void ready.then(() =>
      onMeetingTabNavigated(tabId, url, { getState, dispatch, now: Date.now, otherRoomTabId: findOtherRoomTab }),
    );
  });

  // Abertura do navegador (DA-5): quem desistiu de encerrar a sessão ganha UMA rodada nova por abertura. Fora do
  // boot do worker de propósito — o worker acorda a todo momento e isso viraria chamadas sem limite.
  chrome.runtime.onStartup.addListener(() => {
    void ready
      .then(() => agenteSessionFinisher.restartGaveUpRounds())
      .catch((error: unknown) => logger.error('nova rodada de encerramento falhou', error));
  });

  // Síncrono no topo (MV3): o alarme acorda o service worker; o handler espera a hidratação por dentro.
  chrome.alarms.onAlarm.addListener((alarm) => {
    void ready.then(() => agenteSessionFinisher.handleAlarm(alarm.name));
  });
}
