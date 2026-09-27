/**
 * Status de runtime do envio ao Agente (Fase 7, WR-07, decisão do time em
 * 2026-09-27): o service worker grava o resultado do último envio em
 * `chrome.storage.session` e a tela mostra a verdade — antes, "Ligado — está
 * sendo enviada" aparecia mesmo com 100% dos envios falhando (chave errada,
 * sessão inválida, backend fora). Só metadados: nenhum texto de reunião,
 * session_id ou chave passa por aqui.
 *
 * Este arquivo é puro (tipos + normalização + texto da tela); quem lê e grava
 * é `agenteStatusStore.ts`.
 */
import type { StreamingReadiness } from './agenteConfig';

export type AgenteSendOutcome = 'sent' | 'retrying' | 'failed' | 'rejected';

export interface AgenteStreamingStatus {
  lastOutcome: AgenteSendOutcome | null;
  /** HTTP da última tentativa; `null` = erro de rede (ou nenhum envio ainda). */
  lastHttpStatus: number | null;
  /** epoch ms da última tentativa. */
  lastAttemptAt: number | null;
}

export const EMPTY_AGENTE_STATUS: AgenteStreamingStatus = {
  lastOutcome: null,
  lastHttpStatus: null,
  lastAttemptAt: null,
};

const OUTCOMES: readonly AgenteSendOutcome[] = ['sent', 'retrying', 'failed', 'rejected'];

export function normalizeAgenteStatus(
  raw: Partial<AgenteStreamingStatus> | null | undefined,
): AgenteStreamingStatus {
  const source = raw ?? {};
  const numberOrNull = (value: unknown) => (typeof value === 'number' ? value : null);
  return {
    lastOutcome: OUTCOMES.includes(source.lastOutcome as AgenteSendOutcome)
      ? (source.lastOutcome as AgenteSendOutcome)
      : null,
    lastHttpStatus: numberOrNull(source.lastHttpStatus),
    lastAttemptAt: numberOrNull(source.lastAttemptAt),
  };
}

export type StreamingStatusTone = 'muted' | 'warning' | 'danger';

export interface StreamingStatusView {
  tone: StreamingStatusTone;
  text: string;
}

const READINESS_LABELS: Record<Exclude<StreamingReadiness, 'ready'>, string> = {
  disabled: 'Desligado — nada é enviado ao Agente.',
  'invalid-url': 'A URL do backend não é válida — nada é enviado.',
  'missing-session': 'Falta o ID da sessão do Agente — nada é enviado.',
  'invalid-session': 'O ID da sessão não parece válido (esperado um UUID) — nada é enviado.',
};

function failureReason(httpStatus: number | null): string {
  return httpStatus === null ? 'sem conexão com o backend' : `HTTP ${httpStatus}`;
}

function rejectionText(httpStatus: number | null): string {
  if (httpStatus === 401 || httpStatus === 403) {
    return `Último envio recusado: a chave de autenticação não foi aceita (HTTP ${httpStatus}).`;
  }
  if (httpStatus === 404 || httpStatus === 422) {
    return `Último envio recusado pelo Agente (HTTP ${httpStatus}) — confira o ID da sessão.`;
  }
  return `Último envio recusado pelo Agente (${failureReason(httpStatus)}).`;
}

/** O que a tela mostra, a partir da config salva e do status de runtime. */
export function describeAgenteStreaming(
  readiness: StreamingReadiness,
  status: AgenteStreamingStatus,
  formatTime: (epochMs: number) => string,
): StreamingStatusView {
  if (readiness !== 'ready') return { tone: 'muted', text: READINESS_LABELS[readiness] };

  switch (status.lastOutcome) {
    case 'sent':
      return {
        tone: 'muted',
        text:
          status.lastAttemptAt === null
            ? 'Ligado — último envio chegou ao Agente.'
            : `Ligado — último envio às ${formatTime(status.lastAttemptAt)}.`,
      };
    case 'retrying':
      return {
        tone: 'warning',
        text: `Falha ao enviar (${failureReason(status.lastHttpStatus)}) — tentando de novo…`,
      };
    case 'failed':
      return {
        tone: 'danger',
        text: `Último envio falhou mesmo depois das novas tentativas (${failureReason(status.lastHttpStatus)}) — o trecho não chegou ao Agente.`,
      };
    case 'rejected':
      return { tone: 'danger', text: rejectionText(status.lastHttpStatus) };
    default:
      return { tone: 'muted', text: 'Ligado — pronto para enviar. O envio começa quando alguém falar.' };
  }
}
