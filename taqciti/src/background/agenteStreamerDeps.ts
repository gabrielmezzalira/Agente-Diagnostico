/**
 * Tudo que o streamer do Agente usa do mundo de fora, injetado (Fase 7,
 * TAQ-01). A raiz de composição (`agenteStreamer.ts`) monta a versão de
 * produção; os testes trocam só o que precisam.
 */
import type { AgenteConfig, ExtensionChunkRequest } from '@/shared/config/agenteConfig';
import type { AgenteBinding } from '@/shared/config/agenteBindingStore';
import type { AgenteStatusSink } from './agenteStatusReporter';
import type { SendQueuePort } from './agenteSendQueue';
import type { StreamDestinationPolicy } from './agenteStreamDestination';
import type { AgenteStreamerSnapshotStore } from './agenteStreamerSnapshot';

export interface AgenteStreamerDeps {
  loadConfig: () => Promise<AgenteConfig>;
  send: (request: ExtensionChunkRequest) => Promise<Response>;
  /** Mudanças de config, para reagir na hora ao toggle (WR-11). */
  onConfigChange?: (listener: (config: AgenteConfig) => void) => () => void;
  /** Onde cursor e falas pendentes sobrevivem ao reinício do service worker (WR-02). */
  snapshot?: AgenteStreamerSnapshotStore;
  /** Status de runtime para a tela (WR-07): resultado do último envio e espera por confirmação (CR-01). */
  reportStatus?: AgenteStatusSink;
  /**
   * Lê o vínculo "sessão → última reunião enviada" de `storage.local` (CR-01). Sobrevive ao
   * fechamento do navegador, ao contrário do snapshot do cursor. Sem isto, nada é vinculado.
   */
  loadBinding?: () => Promise<AgenteBinding | null>;
  /**
   * Grava o vínculo na chave própria dele (WR-01): escrita direta do par (sessão, reunião),
   * sem tocar na config da tela.
   */
  bindMeeting?: (sessionId: string, meetingId: string) => Promise<void>;
  /** No boot, troca um status "tentando de novo" herdado do service worker anterior por "interrompido" (WR-04). */
  settleStatusAfterRestart?: () => Promise<void>;
  /**
   * Regra "para onde vai a fala" (Fase 8, D-01). Ausente = `configDestination`, a regra da Fase 7
   * (o ID salvo na config). A composição de produção passa a política da associação da reunião.
   */
  destination?: StreamDestinationPolicy;
  /**
   * Fila das falas ainda não entregues (Fase 8, D-18). Produção: a fila durável de `taq:agenteOutbox`, que
   * sobrevive ao reinício do service worker. Ausente = fila em memória (a mecânica da Fase 7).
   */
  outbox?: SendQueuePort;
  /** Liga o reenvio depois de queda (D-18). Ausente = `AGENTE_OUTBOX_RESEND_ENABLED`, desligado até a B3. */
  outboxResendEnabled?: boolean;
}
