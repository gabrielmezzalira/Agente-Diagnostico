/**
 * A regra "para onde vai a fala" do streamer do Agente. A mecânica de janela, fila e retry mora em
 * `agenteStreamerInstance.ts` e não sabe de onde vem o destino: ela só pergunta a uma política
 * (`StreamDestinationPolicy`) o que fazer a cada passo. Assim a Fase 8 troca a regra (de "o ID salvo
 * na config" para "a associação da reunião") sem mexer na mecânica da Fase 7.
 */
import { isStreamingReady, type AgenteConfig } from '@/shared/config/agenteConfig';

/** O que a política decidiu para o passo atual do streamer. */
export type StreamTarget =
  /** Desligado ou inválido: descarta tudo e esquece o cursor (D-09 da Fase 7). */
  | { kind: 'disabled' }
  /** Ligado, mas esta reunião não tem destino: zera o cursor dela, sem tocar nas falas já endereçadas. */
  | { kind: 'idle' }
  /** Vínculo em andamento: segura o envio sem perder o cursor. */
  | { kind: 'hold' }
  /** Pode enviar com esta config; `seed` = palavras que já saíram por outro caminho (`null` = sem semente). */
  | { kind: 'send'; config: AgenteConfig; seed: Readonly<Record<string, number>> | null };

export interface StreamDestinationPolicy {
  /** Decide o alvo para a reunião atual (`null` = nenhuma reunião vista ainda). */
  resolve(config: AgenteConfig, meetingId: string | null): Promise<StreamTarget>;
  /** Mudou a chave = a fila de envio é do destino antigo e precisa ser cancelada (WR-01). */
  queueKey(config: AgenteConfig): string;
  /** O timer da janela pode soltar as falas pendentes com esta config? */
  canDrain(config: AgenteConfig): boolean;
  /** A semente já foi adotada pelo cursor: a política pode apagá-la. */
  consumeSeed(meetingId: string): Promise<void>;
  /** O vínculo CR-01 da Fase 7 (`taq:agenteBinding`) vale para esta política? */
  usesMeetingBinding: boolean;
}

/**
 * A regra da Fase 7: pronto = envia com a config (URL, sessão e chave salvas); senão, desligado.
 * A fila de envio é invalidada quando muda URL, sessão ou chave.
 */
export const configDestination: StreamDestinationPolicy = {
  resolve: (config) =>
    Promise.resolve<StreamTarget>(
      isStreamingReady(config) ? { kind: 'send', config, seed: null } : { kind: 'disabled' },
    ),
  queueKey: (config) =>
    `${config.agenteBackendUrl}\n${config.agenteSessionId}\n${config.agenteApiKey}`,
  canDrain: isStreamingReady,
  consumeSeed: () => Promise.resolve(),
  usesMeetingBinding: true,
};
