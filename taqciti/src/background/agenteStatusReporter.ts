/**
 * Traduz o que o streamer do Agente vê em patches do status de runtime que a
 * tela mostra (WR-07 e CR-01). A espera por confirmação só é gravada quando
 * muda — nunca a cada flush.
 */
import {
  NO_SEND_OUTCOME,
  type AgenteSendOutcome,
  type AgenteStreamingStatus,
} from '@/shared/config/agenteStatus';

export function createStatusReporter(report?: (patch: Partial<AgenteStreamingStatus>) => void) {
  /** `undefined` = ainda não gravada neste boot do service worker. */
  let reportedWaiting: string | null | undefined;

  return {
    sendOutcome(lastOutcome: AgenteSendOutcome, lastHttpStatus: number | null): void {
      report?.({ lastOutcome, lastHttpStatus, lastAttemptAt: Date.now() });
    },
    /** O resultado do último envio era da config anterior (ex.: 401 com a chave velha). */
    resetSendOutcome(): void {
      report?.(NO_SEND_OUTCOME);
    },
    waitingForMeeting(meetingId: string | null): void {
      if (meetingId === reportedWaiting) return;
      reportedWaiting = meetingId;
      report?.({ waitingMeetingId: meetingId });
    },
  };
}
