/**
 * Raiz de composição dos comandos do vínculo (Fase 8, TAQ-02): monta o serviço de associação com as
 * dependências de produção e expõe `agenteAssociation` para o `index.ts` — cada `case ui/agente/*`
 * lá é só uma linha que chama um método daqui. Mesmo padrão de `agenteStreamer.ts`.
 *
 * As portas de clientes e de sessão de produção falam com as rotas /webhook/extension/* do backend
 * (decisão B1, plano 08-12). Com as rotas fora do ar (ou um backend antigo sem elas), a lista
 * responde `unavailable` e o seletor cai no plano B (ID manual, D-02), que transmite de ponta a ponta.
 */
import {
  AGENTE_REQUEST_TIMEOUT_MS,
  type ExtensionChunkRequest,
} from '@/shared/config/agenteConfig';
import { createAgenteConfigReader } from '@/shared/config/agenteConfigStore';
import type { AgenteBindTarget } from '@/shared/types/agenteMessages';
import {
  createAgenteAssociationService,
  type AgenteAssociationServiceDeps,
} from './agenteAssociationService';
import { agenteSessionFinisher } from './agenteSessionFinisher';
import { reevaluateAgenteStreamer } from './agenteStreamer';
import { deleteRecord, getRecord } from './history';
import { createHttpClientDirectory } from './httpClientDirectory';
import { createHttpSessionGateway } from './httpSessionGateway';
import { dispatch, getState } from './sessionController';

function defaultSend(request: ExtensionChunkRequest): Promise<Response> {
  return fetch(request.url, {
    ...request.init,
    signal: AbortSignal.timeout(AGENTE_REQUEST_TIMEOUT_MS),
  });
}

/** Descartar a reunião que ainda está em `ended` na máquina: devolve o painel ao ocioso (como o "Apagar"). */
async function resetEndedMeeting(meetingId: string): Promise<void> {
  const current = getState();
  if (current.session?.meetingId === meetingId && current.phase === 'ended') {
    await dispatch({ type: 'RESET' });
  }
}

/**
 * `createAgenteConfigReader()` é preguiçoso: só toca o storage na primeira chamada, então importar
 * este módulo continua sem efeito colateral.
 */
const loadConfig = createAgenteConfigReader();
let activeDeps: AgenteAssociationServiceDeps = {
  // B1: lista/criar cliente e criar sessão pelas rotas da extensão (leitor de config compartilhado).
  directory: createHttpClientDirectory({ loadConfig }),
  sessions: createHttpSessionGateway({ loadConfig }),
  getMeetingState: getState,
  getRecord,
  deleteRecord,
  resetEndedMeeting,
  loadConfig,
  send: defaultSend,
  // Logo depois do vínculo, o que foi dito depois da semente sai uma vez (08-01).
  onLinked: () => reevaluateAgenteStreamer(),
  // Fim do envio em partes (concluído ou parado): o agendador decide se encerra a sessão (B4-b).
  onSettled: (meetingId) => agenteSessionFinisher.evaluate(meetingId),
};
let activeService = createAgenteAssociationService(activeDeps);

/** Seam de composição/teste: mescla portas parciais nas atuais e recria o serviço. */
export function configureAgenteAssociation(
  partial: Partial<AgenteAssociationServiceDeps>,
): void {
  activeDeps = { ...activeDeps, ...partial };
  activeService = createAgenteAssociationService(activeDeps);
}

/** O que o `index.ts` chama — delegação pura para o serviço ativo. */
export const agenteAssociation = {
  listClients: () => activeService.listClients(),
  open: (meetingId: string) => activeService.open(meetingId),
  defer: (meetingId: string) => activeService.defer(meetingId),
  bind: (meetingId: string, target: AgenteBindTarget) =>
    activeService.bind(meetingId, target),
  discard: (meetingId: string) => activeService.discard(meetingId),
  resumeSend: (meetingId: string) => activeService.resumeSend(meetingId),
};
