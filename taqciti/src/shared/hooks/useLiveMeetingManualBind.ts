/**
 * Vínculo manual da reunião AO VIVO a partir da tela "Agente Diagnóstico" (Fase 8, plano 08-18, decisão
 * B5 = `vincular-ao-vivo`): o ID salvo na config só serve de destino para a reunião que está acontecendo
 * agora e ainda não tem cliente (pending/choosing/deferred) — e só pelo comando `ui/agente/meeting/bind`,
 * que o service worker valida de novo (UUID e estado). Nunca vira destino de reuniões futuras: sem
 * reunião ao vivo, ou com a associação já adiante, nenhum comando é mandado (critério 3, T-08-36).
 */
import { useCallback, useEffect, useRef } from 'react';
import { isValidAgenteSessionId } from '@/shared/config/agenteConfig';
import { useMeetingAssociation } from '@/shared/hooks/useMeetingAssociation';
import { useMeetingState } from '@/shared/hooks/useMeetingState';
import type { AgenteCommandResult } from '@/shared/types/agenteMessages';
import type { MeetingPhase } from '@/shared/types/domain';

const LIVE_PHASES: readonly MeetingPhase[] = ['captionsRequired', 'recording', 'paused'];
const BINDABLE_STATES: readonly string[] = ['pending', 'choosing', 'deferred'];

interface UseLiveMeetingManualBind {
  /** Manda o vínculo manual se couber; `null` = não coube e nada foi mandado. */
  bindLiveMeeting: (sessionId: string) => Promise<AgenteCommandResult | null>;
}

export function useLiveMeetingManualBind(): UseLiveMeetingManualBind {
  const meeting = useMeetingState();
  const liveMeetingId = LIVE_PHASES.includes(meeting.phase) ? (meeting.session?.meetingId ?? null) : null;
  const { association, bind } = useMeetingAssociation(liveMeetingId);

  // O vínculo roda depois de um `await` (o salvar): lê o estado mais recente, não o do render do clique.
  const latest = useRef({ liveMeetingId, state: association?.state, bind });
  useEffect(() => {
    latest.current = { liveMeetingId, state: association?.state, bind };
  });

  const bindLiveMeeting = useCallback(async (sessionId: string) => {
    const { liveMeetingId: current, state, bind: latestBind } = latest.current;
    if (current === null || state === undefined || !BINDABLE_STATES.includes(state)) return null;
    if (!isValidAgenteSessionId(sessionId)) return null;
    return latestBind({ kind: 'manual', sessionId });
  }, []);

  return { bindLiveMeeting };
}
