/**
 * Traduz o que o streamer do Agente vê em escritas do status de runtime que a
 * tela mostra (WR-07 e CR-01). A espera por confirmação só é gravada quando
 * muda — nunca a cada flush.
 *
 * O destino (`AgenteStatusSink`) tem duas operações porque o status mora em duas chaves, cada
 * uma com um único dono (WR-02, 3ª revisão): o resultado do envio e a espera por confirmação.
 */
import {
  NO_SEND_OUTCOME,
  type AgenteSendOutcome,
  type AgenteSendRecord,
} from '@/shared/config/agenteStatus';

export interface AgenteStatusSink {
  writeSendOutcome: (record: AgenteSendRecord) => void;
  writeWaiting: (meetingId: string | null) => void;
}

export function createStatusReporter(sink?: AgenteStatusSink) {
  /** `undefined` = ainda não gravada neste boot do service worker. */
  let reportedWaiting: string | null | undefined;

  return {
    sendOutcome(lastOutcome: AgenteSendOutcome, lastHttpStatus: number | null): void {
      sink?.writeSendOutcome({ lastOutcome, lastHttpStatus, lastAttemptAt: Date.now() });
    },
    /** O resultado do último envio era da config anterior (ex.: 401 com a chave velha). */
    resetSendOutcome(): void {
      sink?.writeSendOutcome(NO_SEND_OUTCOME);
    },
    waitingForMeeting(meetingId: string | null): void {
      if (meetingId === reportedWaiting) return;
      reportedWaiting = meetingId;
      sink?.writeWaiting(meetingId);
    },
  };
}
