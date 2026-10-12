/**
 * `AgenteSessionGateway` de produção: abre a sessão de uma reunião pela rota
 * POST /webhook/extension/sessions do backend (decisão B1); e a porta que a ENCERRA pela rota
 * POST /webhook/extension/sessions/{id}/finish (decisão B4-b, plano 08-15).
 *
 * Esta porta é a fronteira que conhece o contrato: o nome da sessão sai cortado no limite do backend
 * e, vazio, nem é enviado (o backend usa "Reunião pela Taqciti"). O fluxo do vínculo (08-10) segue
 * passando o título inteiro da reunião.
 */
import { z } from 'zod';
import type { AgenteSessionGateway } from '@/features/agente/clientDirectory';
import {
  AgenteFinishError,
  type FinishOutcome,
  type SessionFinisherPort,
} from '@/features/agente/finishPolicy';
import { isValidAgenteSessionId } from '@/shared/config/agenteConfig';
import { AGENTE_SESSIONS_PATH } from '@/shared/config/agenteRoutes';
import {
  AgenteInvalidUrlError,
  requestAgenteJson,
  type AgenteJsonResponse,
  type HttpAgenteDeps,
} from './httpAgenteJson';

/**
 * Mesmo limite de `ExtensionSessionCreate.name` no backend (08-07). O título da reunião no Meet
 * aceita até 300 caracteres; sem este corte, um título longo viraria 422 e o vínculo falharia.
 */
export const AGENTE_SESSION_NAME_MAX = 200;

const sessionSchema = z.object({ id: z.string().uuid() });

export function createHttpSessionGateway(deps: HttpAgenteDeps): AgenteSessionGateway {
  return {
    async createSession(clientId: string, name: string): Promise<{ sessionId: string }> {
      const trimmed = name.trim().slice(0, AGENTE_SESSION_NAME_MAX);
      const body: { project_id: string; name?: string } = { project_id: clientId };
      if (trimmed.length > 0) body.name = trimmed;

      const { status, json } = await requestAgenteJson(deps, AGENTE_SESSIONS_PATH, {
        method: 'POST',
        body,
      });
      const parsed = sessionSchema.safeParse(json);
      if (status !== 201 || !parsed.success) {
        throw new Error(`Não foi possível criar a sessão (HTTP ${status}).`);
      }
      return { sessionId: parsed.data.id };
    },
  };
}

const finishSchema = z.object({ id: z.string().uuid(), status: z.literal('finished') });

/** Passageiro (vale tentar de novo): tempo esgotado, limite de taxa e erro do servidor. Demais 4xx não. */
function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function finishFailure(message: string, retryable: boolean, httpStatus: number | null): AgenteFinishError {
  return new AgenteFinishError(message, { retryable, httpStatus });
}

/** Rede, timeout e fetch que lança repetem; URL inválida (nada foi enviado) não. Mensagem sem corpo nem chave. */
function transportFailure(error: unknown): AgenteFinishError {
  if (error instanceof AgenteInvalidUrlError) {
    return finishFailure('A URL do Agente não é válida; o encerramento não foi enviado.', false, null);
  }
  return finishFailure('Não foi possível falar com o Agente para encerrar a sessão.', true, null);
}

/** 200 válido = encerrada; 404/409 = nada a encerrar; o resto vira erro tipado com `retryable`. */
function interpretFinish(response: AgenteJsonResponse): FinishOutcome {
  const { status, json } = response;
  if (status === 200) {
    if (finishSchema.safeParse(json).success) return 'finished';
    throw finishFailure('O Agente respondeu ao encerramento num formato inesperado (HTTP 200).', true, status);
  }
  if (status === 404 || status === 409) return 'gone';
  throw finishFailure(`O Agente recusou o encerramento da sessão (HTTP ${status}).`, isRetryableStatus(status), status);
}

/**
 * Porta de produção do encerramento. O id é validado como UUID ANTES de montar a URL (T-08-48): um id
 * adulterado nunca vira caminho. Só o id e o status HTTP aparecem em mensagens — nunca corpo nem chave.
 */
export function createHttpSessionFinisher(deps: HttpAgenteDeps): SessionFinisherPort {
  return {
    async finishSession(sessionId: string): Promise<FinishOutcome> {
      if (!isValidAgenteSessionId(sessionId)) {
        throw finishFailure('O id da sessão não é um UUID válido; o encerramento não foi enviado.', false, null);
      }
      const response = await requestAgenteJson(deps, `${AGENTE_SESSIONS_PATH}/${sessionId}/finish`, {
        method: 'POST',
      }).catch((error: unknown) => {
        throw transportFailure(error);
      });
      return interpretFinish(response);
    },
  };
}
