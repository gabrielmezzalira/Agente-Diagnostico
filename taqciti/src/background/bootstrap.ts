/**
 * Inicialização do service worker: a cadeia `ready`, que prepara o estado ANTES de a primeira mensagem
 * ou evento do navegador ser atendido. Os listeners do navegador moram em `browserListeners.ts` e o
 * roteador de mensagens em `messageRouter.ts`; os dois recebem este `ready` e esperam por ele por dentro.
 */
import { logger } from '@/shared/services/log';
import { getState, hydrate, recoverInterruptedMeetings } from './sessionController';
import { migrateLocalStorage } from './storageMigrations';
import { agenteAssociation } from './agenteAssociation';
import { resumeAgenteStreamer } from './agenteStreamer';
import { isMeetingLive, recoverAssociationsAfterRestart } from './agenteAssociationLifecycle';
import { agenteSessionFinisher, configureAgenteSessionFinisher } from './agenteSessionFinisher';
import { ensurePanelPrefs } from '@/features/panel/prefsStore';

/**
 * A inicialização, e o que ela garante ANTES de a primeira mensagem chegar.
 *
 * `ensurePanelPrefs` está aqui, e não só no `onInstalled`, de propósito: o
 * service worker do MV3 morre e renasce o tempo todo, e o `onInstalled` dispara
 * uma única vez na vida da instalação. Garantir o estado inicial a cada boot faz
 * "a chave existe" deixar de depender de um evento que já passou.
 *
 * A rejeição é capturada porque `ready` é aguardado por TODO handler de
 * mensagem: deixá-la propagar transformaria uma falha de migração em painéis
 * que nunca respondem. O erro fica visível no log, e o estado padrão — que
 * `ensurePanelPrefs` e `getState` garantem — continua de pé.
 */
// B4-b: o agendador do encerramento precisa saber se a reunião está ao vivo; sem isto ninguém é encerrado.
configureAgenteSessionFinisher({ isMeetingLive: (meetingId) => isMeetingLive(getState(), meetingId) });

/** WR-05: o envio em partes interrompido pelo reinício do service worker volta a andar; falha só vai para o log. */
function relaunchLiveLinks(): Promise<void> {
  return agenteAssociation
    .resumeLiveLinksAfterRestart()
    .catch((error: unknown) => logger.error('relançar o vínculo ao vivo interrompido falhou', error));
}

export const ready: Promise<void> = migrateLocalStorage()
  .then(() => hydrate())
  // Sem await: o streamer do Agente nunca atrasa os handlers de mensagem (WR-02).
  .then(() => void resumeAgenteStreamer())
  .then(() => recoverInterruptedMeetings())
  .then(() => recoverAssociationsAfterRestart(getState()))
  // Sem await: o envio relançado do vínculo ao vivo (WR-05) nunca atrasa os handlers de mensagem.
  .then(() => void relaunchLiveLinks())
  // Sem await: a varredura do encerramento nunca atrasa os handlers de mensagem.
  .then(
    () =>
      void agenteSessionFinisher
        .rescheduleAfterRestart()
        .catch((error: unknown) => logger.error('varredura do encerramento no boot falhou', error)),
  )
  .then(() => ensurePanelPrefs())
  .then(() => undefined)
  .catch((error) => logger.error('falha na inicialização', error));
