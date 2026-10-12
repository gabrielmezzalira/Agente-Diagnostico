/**
 * Raiz de composição dos comandos do vínculo (Fase 8, TAQ-02): monta o serviço de associação com as
 * dependências de produção e expõe `agenteAssociation` para o `index.ts` — cada `case ui/agente/*`
 * lá é só uma linha que chama um método daqui. Mesmo padrão de `agenteStreamer.ts`.
 *
 * Enquanto as rotas da decisão B1 não estão ligadas (plano 08-12), as portas de clientes e de
 * sessão são as "indisponível": a lista responde `unavailable` e o seletor cai no plano B (ID
 * manual, D-02), que já transmite de ponta a ponta.
 */
import {
  unavailableClientDirectory,
  unavailableSessionGateway,
} from '@/features/agente/clientDirectory';
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
import { reevaluateAgenteStreamer } from './agenteStreamer';
import { getRecord } from './history';
import { getState } from './sessionController';

function defaultSend(request: ExtensionChunkRequest): Promise<Response> {
  return fetch(request.url, {
    ...request.init,
    signal: AbortSignal.timeout(AGENTE_REQUEST_TIMEOUT_MS),
  });
}

/**
 * `createAgenteConfigReader()` é preguiçoso: só toca o storage na primeira chamada, então importar
 * este módulo continua sem efeito colateral.
 */
let activeDeps: AgenteAssociationServiceDeps = {
  directory: unavailableClientDirectory,
  sessions: unavailableSessionGateway,
  getMeetingState: getState,
  getRecord,
  loadConfig: createAgenteConfigReader(),
  send: defaultSend,
  // Logo depois do vínculo, o que foi dito depois da semente sai uma vez (08-01).
  onLinked: () => reevaluateAgenteStreamer(),
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
};
