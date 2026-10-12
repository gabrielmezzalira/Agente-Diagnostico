/**
 * O envio em partes do vínculo (Fase 8, TAQ-02, D-10/D-12): pega as partes planejadas, manda uma a uma
 * para a sessão escolhida pela esteira serial do 08-05 e conta o andamento na associação da reunião.
 * Separado de `agenteBindFlow.ts` (SRP): o fluxo decide QUEM e PARA ONDE; aqui é só o ENVIO.
 *
 * A chave `x-agente-key` só existe na hora de montar cada request (config atual) — nenhum estado
 * persistido guarda cabeçalho (lista branca do store, T-08-02).
 */
import type { AssociationEvent } from '@/features/agente/association';
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

export async function runBindUpload(
  deps: BindUploadDeps,
  meetingId: string,
  sessionId: string,
  parts: readonly UploadPart[],
): Promise<void> {
  // O progresso é aplicado em cadeia: a conclusão só vem depois do último progresso gravado.
  let progress: Promise<void> = Promise.resolve();
  const outcome = await runMeetingUpload({
    parts,
    sleep: deps.sleep ?? defaultSleep,
    send: async (part): Promise<SendAttemptResult> => {
      const config = await deps.loadConfig();
      const request = buildExtensionChunkRequest(
        { ...config, agenteSessionId: sessionId },
        { text: part.text, speaker: part.speaker },
        AGENTE_SEND_CHUNK_ID ? part.chunkId : undefined,
      );
      const response = await deps.send(request);
      return { kind: 'response', ok: response.ok, status: response.status };
    },
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
    await applyForCurrentState(meetingId, [
      { type: 'link-failed', error: 'send' },
      { type: 'send-failed', error: 'send' },
    ]);
    return;
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
