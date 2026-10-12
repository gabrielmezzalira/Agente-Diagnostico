/**
 * Traduz o que o streamer do Agente vê em escritas do status de runtime que a
 * tela mostra (WR-07 e CR-01). A espera por confirmação só é gravada quando
 * muda — nunca a cada flush.
 *
 * O destino (`AgenteStatusSink`) tem duas operações porque o status mora em duas chaves, cada
 * uma com um único dono (WR-02, 3ª revisão): o resultado do envio e a espera por confirmação.
 */
import type { AgenteDelivery, AgenteDrop } from '@/shared/config/agenteDeliveryStore';
import {
  NO_SEND_OUTCOME,
  type AgenteSendOutcome,
  type AgenteSendRecord,
} from '@/shared/config/agenteStatus';

export interface AgenteStatusSink {
  writeSendOutcome: (record: AgenteSendRecord) => void;
  writeWaiting: (meetingId: string | null) => void;
  /** Fase 8 (D-18): status de entrega para o painel do Meet. Opcional — sem ele, `delivery()` é no-op. */
  writeDelivery?: (record: AgenteDelivery) => void;
  /** Fase 8 (D-18): anota falas descartadas no rastro persistente. Opcional — sem ele, `dropped()` é no-op. */
  recordDropped?: (drop: AgenteDrop) => void;
}

function sameDelivery(a: AgenteDelivery, b: AgenteDelivery): boolean {
  return (
    a.status === b.status &&
    a.queued === b.queued &&
    a.overflow === b.overflow &&
    a.httpStatus === b.httpStatus &&
    a.recoveredAt === b.recoveredAt
  );
}

export function createStatusReporter(sink?: AgenteStatusSink) {
  /** `undefined` = ainda não gravada neste boot do service worker. */
  let reportedWaiting: string | null | undefined;
  /** `undefined` = nenhum status de entrega repassado neste boot do service worker. */
  let reportedDelivery: AgenteDelivery | undefined;

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
    /** Só repassa quando algum campo muda em relação ao último repassado — nunca a cada tentativa. */
    delivery(record: AgenteDelivery): void {
      if (reportedDelivery !== undefined && sameDelivery(reportedDelivery, record)) return;
      reportedDelivery = { ...record };
      sink?.writeDelivery?.(record);
    },
    /** Toda queda conta no rastro: sem deduplicar. */
    dropped(drop: AgenteDrop): void {
      sink?.recordDropped?.(drop);
    },
  };
}
