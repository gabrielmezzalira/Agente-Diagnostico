/**
 * Status de runtime do envio ao Agente (Fase 7, WR-07, decisão do time em
 * 2026-09-27): o service worker grava o resultado do último envio em
 * `chrome.storage.session` e a tela mostra a verdade — antes, "Ligado — está
 * sendo enviada" aparecia mesmo com 100% dos envios falhando (chave errada,
 * sessão inválida, backend fora). Só metadados: nenhum texto de reunião,
 * session_id ou chave passa por aqui.
 *
 * Este arquivo é puro (tipos + normalização + texto da tela); quem lê e grava
 * é `agenteStatusStore.ts`. No storage o status vive em DUAS chaves, cada uma com um único
 * dono (WR-02, 3ª revisão): o resultado do envio (`AgenteSendRecord`) e a espera por
 * confirmação (`AgenteWaitingRecord`). A tela recebe os dois já juntos, como `AgenteStreamingStatus`.
 */
import type { StreamingReadiness } from './agenteConfig';
import type { AgenteDropTrace } from './agenteDeliveryStore';

/**
 * `interrupted` (WR-04): o service worker reiniciou enquanto um trecho esperava nova tentativa.
 * A fila de reenvio vive só na memória, então o trecho se perdeu e nenhuma tentativa está rodando.
 * Não é `failed` — as tentativas não se esgotaram, foram cortadas — e por isso tem texto próprio.
 */
export type AgenteSendOutcome = 'sent' | 'retrying' | 'failed' | 'rejected' | 'interrupted';

export interface AgenteStreamingStatus {
  lastOutcome: AgenteSendOutcome | null;
  /** HTTP da última tentativa; `null` = erro de rede (ou nenhum envio ainda). */
  lastHttpStatus: number | null;
  /** epoch ms da última tentativa. */
  lastAttemptAt: number | null;
  /** CR-01: reunião nova com o mesmo session_id, parada até a pessoa confirmar. */
  waitingMeetingId: string | null;
}

/** O que fica na chave do resultado do envio (escrita pelo envio, zerada pela tela). */
export type AgenteSendRecord = Pick<
  AgenteStreamingStatus,
  'lastOutcome' | 'lastHttpStatus' | 'lastAttemptAt'
>;

/** O que fica na chave da espera por confirmação (escrita só pelo service worker). */
export type AgenteWaitingRecord = Pick<AgenteStreamingStatus, 'waitingMeetingId'>;

/** Zera só o resultado do último envio — a espera do CR-01 é do streamer, não da config. */
export const NO_SEND_OUTCOME = {
  lastOutcome: null,
  lastHttpStatus: null,
  lastAttemptAt: null,
} as const satisfies AgenteSendRecord;

export const EMPTY_AGENTE_STATUS: AgenteStreamingStatus = {
  ...NO_SEND_OUTCOME,
  waitingMeetingId: null,
};

const OUTCOMES: readonly AgenteSendOutcome[] = [
  'sent',
  'retrying',
  'failed',
  'rejected',
  'interrupted',
];

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
    waitingMeetingId: typeof source.waitingMeetingId === 'string' ? source.waitingMeetingId : null,
  };
}

export type StreamingStatusTone = 'muted' | 'warning' | 'danger';

export interface StreamingStatusView {
  tone: StreamingStatusTone;
  text: string;
  /** CR-01: a reunião que a pessoa pode confirmar como continuação da sessão. */
  confirmableMeetingId?: string;
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
  if (status.waitingMeetingId !== null) {
    return {
      tone: 'warning',
      text: 'Reunião nova detectada — nada está sendo enviado. Se ela continua a mesma sessão do Agente, confirme abaixo; se for outra sessão, cole o ID novo e salve.',
      confirmableMeetingId: status.waitingMeetingId,
    };
  }

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
    case 'interrupted':
      return {
        tone: 'danger',
        text: 'O envio foi interrompido quando a extensão reiniciou — o último trecho pode não ter chegado ao Agente.',
      };
    case 'rejected':
      return { tone: 'danger', text: rejectionText(status.lastHttpStatus) };
    default:
      return { tone: 'muted', text: 'Ligado — pronto para enviar. O envio começa quando alguém falar.' };
  }
}

const SESSION_PREFIX_LENGTH = 8;

function dropReasonText(trace: AgenteDropTrace): string | null {
  switch (trace.lastReason) {
    case 'failed':
      return failureReason(trace.lastHttpStatus);
    case 'rejected':
      return `recusada pelo Agente, HTTP ${trace.lastHttpStatus ?? '—'}`;
    case 'overflow':
      return 'fila cheia';
    default:
      return null;
  }
}

/**
 * Nota do rastro de falas que a Taqciti desistiu de entregar (Fase 8, decisão B3-b): vive numa chave
 * própria que nenhum status apaga, então continua na tela mesmo depois de um envio bem-sucedido.
 * `null` quando não há rastro — a tela mostra só o texto da Fase 7.
 */
export function describeDropTrace(
  trace: AgenteDropTrace,
  formatDateTime: (epochMs: number) => string,
): string | null {
  if (trace.count <= 0 || trace.sessionId === null) return null;
  const subject =
    trace.count === 1
      ? '1 fala da sessão'
      : `${trace.count} falas da sessão`;
  const verb = trace.count === 1 ? 'não chegou' : 'não chegaram';
  const session = `${trace.sessionId.slice(0, SESSION_PREFIX_LENGTH)}…`;
  const when = trace.lastAt === null ? '' : ` — a última em ${formatDateTime(trace.lastAt)}`;
  const reason = dropReasonText(trace);
  return `${subject} ${session} ${verb} ao Agente${when}${reason === null ? '' : ` (${reason})`}.`;
}
