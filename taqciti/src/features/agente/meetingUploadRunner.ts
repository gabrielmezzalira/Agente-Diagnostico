/**
 * Executor serial do envio em partes (D-10) — sem `chrome`, `fetch` nem timers: `send` e `sleep`
 * chegam por injeção (DIP), então o motor roda igual no service worker e nos testes.
 *
 * Regras (o backend nunca recebeu rajada — D-20, T-08-08):
 * - UMA parte por vez, na ordem do plano (a ordem da transcrição é a ordem de inserção).
 * - Em falha retryable, até `AGENTE_SEND_MAX_RETRIES` novas tentativas com a espera crescente da
 *   `sendRetryPolicy` (a mesma política do envio ao vivo). Esgotadas, o envio PARA — nada é pulado.
 * - Recusa definitiva (4xx) para na hora, sem novas tentativas.
 * - Depois de cada `blockSize` partes entregues, pausa de `pauseMs` — nunca depois da última.
 * - `done` é a posição da próxima parte a enviar (posição + 1 a cada entrega), então devolvê-lo
 *   como `startAt` retoma exatamente do ponto onde parou.
 */
import {
  AGENTE_UPLOAD_BLOCK_SIZE,
  AGENTE_UPLOAD_PAUSE_MS,
  type UploadPart,
} from './meetingUploader';
import {
  AGENTE_SEND_MAX_RETRIES,
  classifySendAttempt,
  retryDelayMs,
  type SendAttemptResult,
} from './sendRetryPolicy';

export type UploadOutcome =
  | { status: 'completed' }
  | { status: 'failed'; done: number; verdict: 'rejected' | 'retryable' }
  | { status: 'cancelled'; done: number };

export interface MeetingUploadOptions {
  parts: readonly UploadPart[];
  /** Posição (na lista de partes) da primeira parte a enviar — retomada do "Continuar envio". */
  startAt?: number;
  send: (part: UploadPart) => Promise<SendAttemptResult>;
  sleep: (ms: number) => Promise<void>;
  /** Chamado a cada parte confirmada: `done` partes de `total`. */
  onProgress?: (done: number, total: number) => void;
  blockSize?: number;
  pauseMs?: number;
  isCancelled?: () => boolean;
}

type PartResult = { delivered: true } | { delivered: false; verdict: 'rejected' | 'retryable' };

export async function runMeetingUpload(options: MeetingUploadOptions): Promise<UploadOutcome> {
  const { parts, send, sleep, onProgress, isCancelled } = options;
  const blockSize = Math.max(1, options.blockSize ?? AGENTE_UPLOAD_BLOCK_SIZE);
  const pauseMs = options.pauseMs ?? AGENTE_UPLOAD_PAUSE_MS;
  const startAt = Math.max(0, options.startAt ?? 0);

  let sentInRun = 0;
  for (let position = startAt; position < parts.length; position += 1) {
    if (isCancelled?.()) return { status: 'cancelled', done: position };

    const result = await deliverPart(parts[position]!, send, sleep);
    if (!result.delivered) {
      return { status: 'failed', done: position, verdict: result.verdict };
    }

    onProgress?.(position + 1, parts.length);
    sentInRun += 1;
    const hasMore = position + 1 < parts.length;
    if (hasMore && sentInRun % blockSize === 0) {
      await sleep(pauseMs);
    }
  }

  return { status: 'completed' };
}

async function deliverPart(
  part: UploadPart,
  send: MeetingUploadOptions['send'],
  sleep: MeetingUploadOptions['sleep'],
): Promise<PartResult> {
  for (let retry = 0; ; retry += 1) {
    const verdict = classifySendAttempt(await attempt(part, send));
    if (verdict === 'delivered') return { delivered: true };
    if (verdict === 'rejected') return { delivered: false, verdict };
    if (retry >= AGENTE_SEND_MAX_RETRIES) return { delivered: false, verdict };
    await sleep(retryDelayMs(retry));
  }
}

async function attempt(
  part: UploadPart,
  send: MeetingUploadOptions['send'],
): Promise<SendAttemptResult> {
  try {
    // `await` dentro do try: um `send` que lança vira erro de rede em vez de derrubar o envio (IN-10).
    return await send(part);
  } catch {
    return { kind: 'network-error' };
  }
}
