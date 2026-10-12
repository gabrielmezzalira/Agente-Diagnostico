/**
 * Política do encerramento da sessão que a Taqciti criou no Agente (Fase 8, decisão B4-b, 2026-10-12).
 *
 * O time decidiu: encerrar na hora em que a call acaba (fila de envio vazia) e, com o envio parado,
 * depois de 5 minutos — o laço de IA de uma sessão aberta gasta dinheiro à toa. Este módulo só FIXA os
 * números e a tabela de espera; quem decide, por reunião, encerrar agora, esperar ou desistir é o
 * agendador (plano 08-27). Puro: sem `chrome`, `fetch` nem relógio — o "agora" entra por parâmetro.
 * Para mudar qualquer tempo, é preciso decisão do time: o teste `finishPolicy.test.ts` fixa cada valor.
 */

/**
 * B4-b: prazo de segurança com o envio parado (fila não esvazia): 5 minutos contados do PRIMEIRO
 * momento em que a Taqciti vê o envio parado. Passado isso, encerra mesmo assim (custo de IA ocioso).
 */
export const AGENTE_STALLED_SEND_CLOSE_MS = 5 * 60_000;

/** Reconferência: enquanto espera o prazo, a Taqciti olha a fila de novo a cada 30 s. */
export const AGENTE_FINISH_POLL_MS = 30_000;

/** Espera pela última fala que ainda estava em voo quando a fila ficou vazia, antes de encerrar. */
export const AGENTE_FINISH_DRAIN_GRACE_MS = 10_000;

/** De quanto em quanto tempo a espera pela última fala em voo reconfere (dentro dos 10 s). */
export const AGENTE_FINISH_DRAIN_CHECK_MS = 1_000;

/**
 * Teto de tentativas de encerrar: a 11ª falha desiste (`finishGaveUp`). Sem isto um backend ou uma
 * chave que nunca aceitam gerariam chamadas para sempre (T-08-49).
 */
export const AGENTE_FINISH_MAX_TRIES = 11;

/** Prefixo dos alarmes (`chrome.alarms`) do encerramento; o sufixo é o id da reunião (plano 08-27). */
export const AGENTE_FINISH_ALARM_PREFIX = 'agente-finish:';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/**
 * Espera depois da N-ésima falha (índice = N - 1). Duas pistas: a rápida (30 s a 8 min) cobre um
 * soluço do backend; a lenta (30 min a 8 h) cobre um Agente que volta algumas horas depois e ainda
 * encontra a sessão para encerrar. Total ≈ 16 h; a 11ª falha desiste.
 */
const FINISH_BACKOFF_MS: readonly number[] = [
  30_000,
  MINUTE_MS,
  2 * MINUTE_MS,
  4 * MINUTE_MS,
  8 * MINUTE_MS,
  30 * MINUTE_MS,
  HOUR_MS,
  2 * HOUR_MS,
  4 * HOUR_MS,
  8 * HOUR_MS,
];

/** Quanto esperar antes de tentar de novo depois da falha `tries` (1 = a primeira); `null` = desiste. */
export function backoffAfterFailure(tries: number): number | null {
  if (tries >= AGENTE_FINISH_MAX_TRIES) return null;
  const index = Math.max(1, Math.floor(tries)) - 1;
  return FINISH_BACKOFF_MS[index] ?? null;
}

/** Quando olhar de novo: o que vier primeiro entre o prazo (`finishBy`) e a próxima reconferência. */
export function nextCheckAt(now: number, finishBy: number): number {
  return Math.min(finishBy, now + AGENTE_FINISH_POLL_MS);
}

/** Resultado de pedir o encerramento: `gone` = não há mais nada a encerrar (sessão apagada ou de outra origem). */
export type FinishOutcome = 'finished' | 'gone';

/** Porta para o backend encerrar a sessão (implementação HTTP em `background/httpSessionGateway.ts`). */
export interface SessionFinisherPort {
  /** Rejeita com `AgenteFinishError` quando falha; `retryable` diz se vale tentar de novo. */
  finishSession(sessionId: string): Promise<FinishOutcome>;
}

export interface AgenteFinishErrorInit {
  /** Rede, timeout, 408/429/5xx e corpo inválido repetem; 401/403 e demais 4xx não. */
  retryable: boolean;
  /** Status HTTP da resposta; `null` quando não houve resposta (rede, URL ou id inválidos). */
  httpStatus?: number | null;
}

/** Falha de encerrar a sessão. Nunca carrega corpo de resposta nem chave — só o status. */
export class AgenteFinishError extends Error {
  readonly retryable: boolean;
  readonly httpStatus: number | null;

  constructor(message: string, init: AgenteFinishErrorInit) {
    super(message);
    this.name = 'AgenteFinishError';
    this.retryable = init.retryable;
    this.httpStatus = init.httpStatus ?? null;
  }
}
