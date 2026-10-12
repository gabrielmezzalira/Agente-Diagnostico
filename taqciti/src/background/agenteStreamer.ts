/**
 * Raiz de composição do streaming ao vivo para o backend do Agente Diagnóstico
 * (Fase 7, TAQ-01). Plugado em `flushState()` (sessionController.ts, D-06 —
 * ponto de plugagem intacto). A lógica da instância (cursor, janela por fala,
 * fila serializada) mora em `agenteStreamerInstance.ts`; aqui ficam só as
 * deps de produção e a instância ativa.
 */
import type { MeetingState } from '@/shared/types/domain';
import { AGENTE_REQUEST_TIMEOUT_MS, type ExtensionChunkRequest } from '@/shared/config/agenteConfig';
import { clearSeed, getAssociation } from '@/shared/config/agenteAssociationStore';
import { loadAgenteBinding, writeAgenteBinding } from '@/shared/config/agenteBindingStore';
import { createAgenteConfigReader, onAgenteConfigChange } from '@/shared/config/agenteConfigStore';
import { recordDroppedUtterances, writeDelivery } from '@/shared/config/agenteDeliveryStore';
import {
  appendToOutbox,
  clearOutbox,
  loadOutbox,
  removeOutboxItem,
} from '@/shared/config/agenteOutboxStore';
import {
  markInterruptedSend,
  writeSendOutcome,
  writeWaitingMeeting,
} from '@/shared/config/agenteStatusStore';
import { logger } from '@/shared/services/log';
import type { AgenteStatusSink } from './agenteStatusReporter';
import { configDestination, createAssociationDestination } from './agenteStreamDestination';
import { createAgenteStreamer, type AgenteStreamerDeps } from './agenteStreamerInstance';
import { sessionSnapshotStore } from './agenteStreamerSnapshot';

export { createAgenteStreamer, type AgenteStreamerDeps } from './agenteStreamerInstance';

function defaultSend(request: ExtensionChunkRequest): Promise<Response> {
  return fetch(request.url, {
    ...request.init,
    signal: AbortSignal.timeout(AGENTE_REQUEST_TIMEOUT_MS),
  });
}

/** Grava o status de runtime sem nunca travar o streamer (WR-07). */
function logStatusWriteFailure(write: Promise<void>): void {
  write.catch((error: unknown) => {
    logger.error('gravar o status do Agente falhou', error);
  });
}

/** Cada chave do status tem um dono (WR-02, 3ª revisão): aqui o service worker escreve as duas. */
const reportStatus: AgenteStatusSink = {
  writeSendOutcome: (record) => logStatusWriteFailure(writeSendOutcome(record)),
  writeWaiting: (meetingId) => logStatusWriteFailure(writeWaitingMeeting(meetingId)),
  // Fase 8 (D-18): status de entrega para o painel do Meet e rastro das falas que a Taqciti desistiu de entregar.
  writeDelivery: (record) => logStatusWriteFailure(writeDelivery(record)),
  recordDropped: (drop) => logStatusWriteFailure(recordDroppedUtterances(drop)),
};

/**
 * Padrão de produção (Fase 7, plano 02, D-08): lê a config salva em
 * `chrome.storage.local` (`agenteConfigStore.ts`), com cache — não o valor
 * fixo `DEFAULT_AGENTE_CONFIG` do plano 01, que mantinha o streaming sempre
 * desligado até este plano ligar a leitura em runtime. `createAgenteConfigReader()`
 * é preguiçoso: só toca o storage na primeira chamada de `loadConfig`, então
 * importar este módulo continua sem efeito colateral.
 */
let activeDeps: AgenteStreamerDeps = {
  loadConfig: createAgenteConfigReader(),
  send: defaultSend,
  onConfigChange: onAgenteConfigChange,
  snapshot: sessionSnapshotStore,
  reportStatus,
  // CR-01/WR-01: só ids, em chave própria de storage.local — nunca texto, nunca a config da tela.
  loadBinding: loadAgenteBinding,
  bindMeeting: writeAgenteBinding,
  settleStatusAfterRestart: markInterruptedSend,
  // Fase 8 (D-01): o destino é a associação da reunião, não o ID salvo na config — sem `linked`, nada sai.
  destination: createAssociationDestination({ getAssociation, clearSeed }),
  // Fase 8 (D-18): falas ainda não entregues ficam em chrome.storage.local e sobrevivem ao reinício.
  outbox: {
    load: loadOutbox,
    append: (items) => appendToOutbox(items),
    remove: removeOutboxItem,
    clear: clearOutbox,
  },
};
let activeStreamer = createAgenteStreamer(activeDeps);

/**
 * Seam de composição/teste: mescla deps parciais nas atuais e recria a
 * instância ativa (cursor novo, fila nova, buffer/timer novos) — descarta a
 * instância anterior antes. `dispose()` é terminal (WR-13): um passo já
 * enfileirado na instância antiga vira no-op em vez de rearmar timer ou
 * enviar com o `deps` descartado.
 */
export function configureAgenteStreamer(partial: Partial<AgenteStreamerDeps>): void {
  activeDeps = { ...activeDeps, ...partial };
  activeStreamer.dispose();
  activeStreamer = createAgenteStreamer(activeDeps);
}

/** Delegação para a instância ativa — é isto que `sessionController.ts` chama. */
export function onSessionFlushed(state: MeetingState): Promise<void> {
  return activeStreamer.onSessionFlushed(state);
}

/** Boot do service worker: restaura cursor e falas pendentes (WR-02). */
export function resumeAgenteStreamer(): Promise<void> {
  return activeStreamer.resume();
}

/**
 * Roda um passo do streamer com o último estado visto (Fase 8): o fluxo de vínculo chama logo depois de
 * `link-completed`, para o que foi dito depois da semente sair mesmo sem um flush novo.
 */
export function reevaluateAgenteStreamer(): Promise<void> {
  return activeStreamer.reevaluate();
}

/**
 * Espera a fila do streamer e o sender despacharem (guardar + 1º envio) — ver `whenIdle` em
 * agenteStreamerInstance.ts. Além dos testes (WR-10), o agendador do encerramento da sessão (B4-b, plano
 * 08-27) usa para esperar as falas finais irem para a fila durável; não espera a resposta de rede.
 */
export function whenAgenteStreamerIdle(): Promise<void> {
  return activeStreamer.whenIdle();
}

/**
 * Nova tentativa de entrega da fila durável em QUALQUER estado da reunião (B4-b, plano 08-27): o agendador
 * do encerramento pede isto a cada reconferência, para a fila parada de uma reunião que já acabou (ou de
 * outra, com a atual ao vivo e sem destino) voltar a andar sem esperar fala nova. Não passa pelo
 * `reevaluate` (que pararia antes do kick sem destino) nem pelo `resume` (que mexe no status de reinício e
 * limpa a fila se o envio estiver desligado); o portão é o MESMO `canDrain` da política ativa (D-09) — envio
 * desligado ou URL inválida não empurra nada. Não toca em cursor, janela nem status.
 */
export async function kickAgenteSender(): Promise<void> {
  const config = await activeDeps.loadConfig();
  const policy = activeDeps.destination ?? configDestination;
  if (!policy.canDrain(config)) return;
  activeStreamer.kick();
}
