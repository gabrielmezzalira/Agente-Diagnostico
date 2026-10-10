/**
 * Raiz de composição do streaming ao vivo para o backend do Agente Diagnóstico
 * (Fase 7, TAQ-01). Plugado em `flushState()` (sessionController.ts, D-06 —
 * ponto de plugagem intacto). A lógica da instância (cursor, janela por fala,
 * fila serializada) mora em `agenteStreamerInstance.ts`; aqui ficam só as
 * deps de produção e a instância ativa.
 */
import type { MeetingState } from '@/shared/types/domain';
import { AGENTE_REQUEST_TIMEOUT_MS, type ExtensionChunkRequest } from '@/shared/config/agenteConfig';
import {
  createAgenteConfigReader,
  onAgenteConfigChange,
  patchAgenteConfig,
} from '@/shared/config/agenteConfigStore';
import type { AgenteStreamingStatus } from '@/shared/config/agenteStatus';
import { markInterruptedSend, patchAgenteStatus } from '@/shared/config/agenteStatusStore';
import { logger } from '@/shared/services/log';
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
function reportStatus(patch: Partial<AgenteStreamingStatus>): void {
  patchAgenteStatus(patch).catch((error: unknown) => {
    logger.error('gravar o status do Agente falhou', error);
  });
}

/** Grava só o id da reunião vinculada à sessão (CR-01) — nunca texto de transcrição. */
async function bindMeeting(meetingId: string): Promise<void> {
  await patchAgenteConfig({ boundMeetingId: meetingId });
}

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
  bindMeeting,
  settleStatusAfterRestart: markInterruptedSend,
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

/** Só para testes (WR-10) — ver `whenIdle` em agenteStreamerInstance.ts. */
export function whenAgenteStreamerIdle(): Promise<void> {
  return activeStreamer.whenIdle();
}
