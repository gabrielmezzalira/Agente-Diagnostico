/**
 * O envio em partes do vínculo (Fase 8, TAQ-02, D-10/D-12): pega as partes planejadas, manda uma a uma
 * para a sessão escolhida pela esteira serial do 08-05 e conta o andamento na associação da reunião.
 * Separado de `agenteBindFlow.ts` (SRP): o fluxo decide QUEM e PARA ONDE; aqui é só o ENVIO.
 *
 * A chave `x-agente-key` só existe na hora de montar cada request (config atual) — nenhum estado
 * persistido guarda cabeçalho (lista branca do store, T-08-02).
 */
import type { AssociationEvent, SeedSent } from '@/features/agente/association';
import { AGENTE_SEND_CHUNK_ID } from '@/features/agente/outbox';
import { runMeetingUpload } from '@/features/agente/meetingUploadRunner';
import { seedFromParts, type UploadPart } from '@/features/agente/meetingUploader';
import type { SendAttemptResult } from '@/features/agente/sendRetryPolicy';
import { applyAssociationEvent } from '@/shared/config/agenteAssociationStore';
import {
  buildExtensionChunkRequest,
  type AgenteConfig,
  type ExtensionChunkRequest,
} from '@/shared/config/agenteConfig';
import { logger } from '@/shared/services/log';

export interface BindUploadDeps {
  /** Config atual: relida a cada parte, para a chave e a URL valerem na hora do envio. */
  loadConfig: () => Promise<AgenteConfig>;
  send: (request: ExtensionChunkRequest) => Promise<Response>;
  /** Pausa entre blocos e esperas de nova tentativa; padrão `setTimeout`. Injetável só para teste. */
  sleep?: (ms: number) => Promise<void>;
  /** Chamado depois de o vínculo ao vivo concluir (produção: reavaliar o streamer, 08-01). */
  onLinked?: (meetingId: string) => Promise<void>;
  /**
   * Chamado ao FINAL do envio em partes em qualquer desfecho (concluído, parado ou vínculo ao vivo pronto),
   * depois de a associação refletir o resultado (produção: avisar o agendador do encerramento, B4-b).
   * Nunca é esperado e um erro dele só vai para o log: o encerramento não atrasa nem derruba o envio.
   */
  onSettled?: (meetingId: string) => Promise<void>;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Aplica o primeiro evento que o estado ATUAL da associação aceita. O envio em partes serve a duas
 * famílias de estado: `linking` (vínculo ao vivo -> `link-*`) e `sending` (reunião encerrada ->
 * `send-*`) — e a mesma sala pode ser retomada no meio do envio (`sending` vira `linking`, 08-22).
 * Tentar na ordem pela fila serializada do store decide sem corrida: o reducer recusa (applied =
 * false) o evento da família errada.
 */
async function applyForCurrentState(
  meetingId: string,
  events: readonly AssociationEvent[],
): Promise<AssociationEvent | null> {
  for (const event of events) {
    if ((await applyAssociationEvent(meetingId, event)).applied) return event;
  }
  return null;
}

/** Avisa o fim do envio sem esperar: falha (síncrona ou assíncrona) só vai para o log. */
function notifySettled(deps: BindUploadDeps, meetingId: string): void {
  if (deps.onSettled === undefined) return;
  const logFailure = (error: unknown) =>
    logger.error('avisar o fim do envio em partes ao encerramento falhou', error);
  try {
    void deps.onSettled(meetingId).catch(logFailure);
  } catch (error) {
    logFailure(error);
  }
}

/** O que a retomada ("Continuar envio") traz a mais que o envio do começo (WR-04). */
export interface ResumeExtras {
  /** Partes de reposição: o que falta dos segmentos que cresceram depois de parte deles ter sido entregue. */
  catchUp?: readonly UploadPart[];
  /** Palavras por segmento que o envio parado já tinha entregue (`MeetingAssociation.sentWords`). */
  sentBefore?: SeedSent;
}

export async function runBindUpload(
  deps: BindUploadDeps,
  meetingId: string,
  sessionId: string,
  parts: readonly UploadPart[],
  startAt = 0,
  extras: ResumeExtras = {},
): Promise<void> {
  try {
    await uploadParts(deps, meetingId, sessionId, parts, startAt, extras);
  } finally {
    notifySettled(deps, meetingId);
  }
}

/** Uma parte -> um POST para a sessão; a chave só entra na hora de montar o request. */
function sendPartTo(deps: BindUploadDeps, sessionId: string) {
  return async (part: UploadPart): Promise<SendAttemptResult> => {
    const config = await deps.loadConfig();
    const request = buildExtensionChunkRequest(
      { ...config, agenteSessionId: sessionId },
      { text: part.text, speaker: part.speaker },
      AGENTE_SEND_CHUNK_ID ? part.chunkId : undefined,
    );
    const response = await deps.send(request);
    return { kind: 'response', ok: response.ok, status: response.status };
  };
}

/** O envio parou: a associação vai a `send-failed` levando o que já foi entregue de cada segmento (WR-04). */
async function failUpload(meetingId: string, sentWords: SeedSent): Promise<void> {
  await applyForCurrentState(meetingId, [
    { type: 'link-failed', error: 'send', sentWords },
    { type: 'send-failed', error: 'send', sentWords },
  ]);
}

async function uploadParts(
  deps: BindUploadDeps,
  meetingId: string,
  sessionId: string,
  parts: readonly UploadPart[],
  startAt: number,
  extras: ResumeExtras,
): Promise<void> {
  const sleep = deps.sleep ?? defaultSleep;
  const send = sendPartTo(deps, sessionId);
  let delivered: SeedSent = { ...extras.sentBefore };

  // Reposição primeiro (WR-04): são as palavras que faltam dos segmentos já cobertos por `startAt`. Sem progresso
  // próprio — o `done`/`total` da associação continua contando as partes do plano completo.
  const catchUp = extras.catchUp ?? [];
  if (catchUp.length > 0) {
    const caughtUp = await runMeetingUpload({ parts: catchUp, sleep, send });
    const deliveredCount = caughtUp.status === 'completed' ? catchUp.length : caughtUp.done;
    delivered = { ...delivered, ...seedFromParts(catchUp.slice(0, deliveredCount)) };
    if (caughtUp.status !== 'completed') return failUpload(meetingId, delivered);
  }

  // O progresso é aplicado em cadeia: a conclusão só vem depois do último progresso gravado.
  let progress: Promise<void> = Promise.resolve();
  const outcome = await runMeetingUpload({
    parts,
    startAt,
    sleep,
    send,
    onProgress: (done, total) => {
      progress = progress
        .then(() =>
          applyForCurrentState(meetingId, [
            { type: 'link-progress', done, total },
            { type: 'send-progress', done, total },
          ]),
        )
        .then(() => undefined)
        .catch((error: unknown) =>
          logger.error('gravar o progresso do envio falhou', error),
        );
    },
  });
  await progress;

  if (outcome.status !== 'completed') {
    // As partes antes da que falhou foram entregues; o que a retomada já sabia (`delivered`) prevalece, porque o
    // texto dessas partes pode ter crescido desde então.
    return failUpload(meetingId, { ...seedFromParts(parts.slice(0, outcome.done)), ...delivered });
  }
  const seedSent = seedFromParts(parts);
  const completed = await applyForCurrentState(meetingId, [
    { type: 'link-completed', seedSent },
    { type: 'send-completed', seedSent },
  ]);
  // Só o vínculo ao vivo libera o streamer; a reunião encerrada vira `sent` e nada mais sai.
  if (completed?.type !== 'link-completed') return;
  try {
    await deps.onLinked?.(meetingId);
  } catch (error) {
    logger.error('reavaliar o streamer depois do vínculo falhou', error);
  }
}
