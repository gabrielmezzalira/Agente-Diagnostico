/**
 * Tudo que o streamer do Agente usa do mundo de fora, injetado (Fase 7,
 * TAQ-01). A raiz de composição (`agenteStreamer.ts`) monta a versão de
 * produção; os testes trocam só o que precisam.
 */
import type { AgenteConfig, ExtensionChunkRequest } from '@/shared/config/agenteConfig';
import type { AgenteStreamingStatus } from '@/shared/config/agenteStatus';
import type { AgenteStreamerSnapshotStore } from './agenteStreamerSnapshot';

export interface AgenteStreamerDeps {
  loadConfig: () => Promise<AgenteConfig>;
  send: (request: ExtensionChunkRequest) => Promise<Response>;
  /** Mudanças de config, para reagir na hora ao toggle (WR-11). */
  onConfigChange?: (listener: (config: AgenteConfig) => void) => () => void;
  /** Onde cursor e falas pendentes sobrevivem ao reinício do service worker (WR-02). */
  snapshot?: AgenteStreamerSnapshotStore;
  /** Status de runtime para a tela (WR-07): resultado do último envio. */
  reportStatus?: (patch: Partial<AgenteStreamingStatus>) => void;
  /**
   * Grava em `storage.local` a reunião a que a sessão do Agente está vinculada (CR-01).
   * Sobrevive ao fechamento do navegador, ao contrário do snapshot do cursor.
   */
  bindMeeting?: (meetingId: string) => Promise<void>;
}
