/**
 * O que a tela "Agente Diagnóstico" mostra como status (WR-07): junta a
 * prontidão da config salva com o resultado real do último envio, que o
 * service worker grava em `chrome.storage.session`.
 */
import { useEffect, useState } from 'react';
import type { StreamingReadiness } from '@/shared/config/agenteConfig';
import {
  describeAgenteStreaming,
  EMPTY_AGENTE_STATUS,
  type AgenteStreamingStatus,
  type StreamingStatusView,
} from '@/shared/config/agenteStatus';
import { subscribeAgenteStatus } from '@/shared/config/agenteStatusStore';

function formatClockTime(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString('pt-BR');
}

export function useAgenteStreamingStatus(
  readiness: StreamingReadiness | null,
): StreamingStatusView | null {
  const [status, setStatus] = useState<AgenteStreamingStatus>(EMPTY_AGENTE_STATUS);

  useEffect(() => subscribeAgenteStatus(setStatus), []);

  return readiness ? describeAgenteStreaming(readiness, status, formatClockTime) : null;
}
