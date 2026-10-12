/**
 * O que a tela "Agente Diagnóstico" mostra como status (WR-07): junta a
 * prontidão da config salva com o resultado real do último envio, que o
 * service worker grava em `chrome.storage.session`. Também é daqui que sai a
 * confirmação de reunião nova do CR-01 e a nota do rastro de falas descartadas (Fase 8), que vem
 * da própria chave em `storage.local` e por isso não some quando o status muda.
 */
import { useEffect, useState } from 'react';
import type { StreamingReadiness } from '@/shared/config/agenteConfig';
import { patchAgenteConfig } from '@/shared/config/agenteConfigStore';
import { EMPTY_DROP_TRACE, subscribeDropTrace, type AgenteDropTrace } from '@/shared/config/agenteDeliveryStore';
import {
  describeAgenteStreaming,
  describeDropTrace,
  EMPTY_AGENTE_STATUS,
  type AgenteStreamingStatus,
  type StreamingStatusView,
} from '@/shared/config/agenteStatus';
import { subscribeAgenteStatus } from '@/shared/config/agenteStatusStore';
import { logger } from '@/shared/services/log';

const CONFIRM_ERROR_MESSAGE = 'Não foi possível confirmar a reunião. Tente de novo.';

function formatClockTime(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString('pt-BR');
}

function formatDateTime(epochMs: number): string {
  return new Date(epochMs).toLocaleString('pt-BR');
}

interface UseAgenteStreamingStatus {
  view: StreamingStatusView | null;
  confirmError: string | null;
  /** CR-01: a reunião nova continua a mesma sessão do Agente — libera o envio. */
  confirmNewMeeting: () => void;
}

export function useAgenteStreamingStatus(
  readiness: StreamingReadiness | null,
): UseAgenteStreamingStatus {
  const [status, setStatus] = useState<AgenteStreamingStatus>(EMPTY_AGENTE_STATUS);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [dropTrace, setDropTrace] = useState<AgenteDropTrace>(EMPTY_DROP_TRACE);

  useEffect(() => subscribeAgenteStatus(setStatus), []);
  useEffect(() => subscribeDropTrace(setDropTrace), []);

  const baseView = readiness ? describeAgenteStreaming(readiness, status, formatClockTime) : null;
  const dropNote = describeDropTrace(dropTrace, formatDateTime);
  const view = baseView && dropNote !== null ? { ...baseView, text: `${baseView.text} ${dropNote}` } : baseView;

  function confirmNewMeeting(): void {
    const meetingId = view?.confirmableMeetingId;
    if (!meetingId) return;
    setConfirmError(null);
    patchAgenteConfig({ confirmedMeetingId: meetingId }).catch((error: unknown) => {
      setConfirmError(CONFIRM_ERROR_MESSAGE);
      logger.error('confirmar reunião nova do Agente falhou', error);
    });
  }

  return { view, confirmError, confirmNewMeeting };
}
