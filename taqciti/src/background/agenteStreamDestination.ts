/**
 * A regra "para onde vai a fala" do streamer do Agente. A mecânica de janela, fila e retry mora em
 * `agenteStreamerInstance.ts` e não sabe de onde vem o destino: ela só pergunta a uma política
 * (`StreamDestinationPolicy`) o que fazer a cada passo. Assim a Fase 8 troca a regra (de "o ID salvo
 * na config" para "a associação da reunião") sem mexer na mecânica da Fase 7.
 */
import {
  isStreamingReady,
  isValidAgenteBackendUrl,
  isValidAgenteSessionId,
  type AgenteConfig,
} from '@/shared/config/agenteConfig';
import type { MeetingAssociation } from '@/features/agente/association';
import type { StreamCursor } from '@/features/agente/wordDelta';

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

export interface AssociationDestinationDeps {
  getAssociation: (meetingId: string) => Promise<MeetingAssociation | null>;
  clearSeed: (meetingId: string) => Promise<void>;
}

/**
 * A regra da Fase 8 (D-01, D-04, D-12): o destino da fala é a associação da REUNIÃO atual, nunca o ID
 * salvo na config. Só `linked` envia, sempre para `association.sessionId`; `linking` segura sem perder o
 * cursor; qualquer outro caso (sem associação, `pending`, `deferred`...) é `idle` — a reunião fica só
 * guardada na Taqciti (modelo B), sem mexer nas falas já endereçadas a outra reunião.
 *
 * `usesMeetingBinding = false`: a associação já é o vínculo explícito da reunião, então o CR-01 da Fase 7
 * (`taq:agenteBinding`) nem é consultado nem regravado — consultá-lo faria uma sessão colada que o CR-01
 * ligava a outra reunião esperar para sempre por uma confirmação que não existe mais na tela.
 */
export function createAssociationDestination(deps: AssociationDestinationDeps): StreamDestinationPolicy {
  const canUse = (config: AgenteConfig): boolean =>
    config.streamingEnabled && isValidAgenteBackendUrl(config.agenteBackendUrl);

  return {
    async resolve(config, meetingId) {
      if (!canUse(config)) return { kind: 'disabled' };
      if (meetingId === null) return { kind: 'idle' };
      const association = await deps.getAssociation(meetingId);
      if (association === null) return { kind: 'idle' };
      if (association.state === 'linking') return { kind: 'hold' };
      const sessionId = association.sessionId;
      if (association.state !== 'linked' || sessionId === undefined || !isValidAgenteSessionId(sessionId)) {
        return { kind: 'idle' };
      }
      return {
        kind: 'send',
        config: { ...config, agenteSessionId: sessionId, confirmedMeetingId: '' },
        seed: association.seedSent ?? null,
      };
    },
    // Sem a sessão: cada fala já carrega o seu destino (IN-11); trocar de reunião não cancela a fila.
    queueKey: (config) => `${config.agenteBackendUrl}\n${config.agenteApiKey}`,
    canDrain: canUse,
    consumeSeed: deps.clearSeed,
    usesMeetingBinding: false,
  };
}

/**
 * Cursor inicial a partir da semente do vínculo: `seed !== null` conta como semente, inclusive `{}`
 * ("o vínculo foi feito com 0 segmentos; nada foi enviado ainda, mande tudo desde o início"); só `null`
 * é "sem semente" — aí vale o prime da Fase 7. Só vale quando ainda não há cursor para esta
 * reunião e sessão; senão devolve `null` e o cursor atual continua.
 */
export function cursorFromSeed(
  prev: StreamCursor | null,
  meetingId: string,
  sessionId: string,
  seed: Readonly<Record<string, number>> | null,
): StreamCursor | null {
  if (seed === null) return null;
  const sameTarget = prev !== null && prev.meetingId === meetingId && prev.sessionId === sessionId;
  return sameTarget ? null : { meetingId, sessionId, sent: { ...seed } };
}
