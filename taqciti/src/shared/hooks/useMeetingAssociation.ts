/**
 * O vínculo de UMA reunião com o Agente, do ponto de vista do painel (Fase 8, TAQ-02, D-04/D-06/D-12/D-18).
 *
 * LÊ só de `chrome.storage.local` — a associação e o status de entrega que o service worker escreve —
 * e nunca de `storage.session`, que o content script do Meet não enxerga (Pitfall 3). AGE só por
 * comando (`platform.send`), com a resposta validada por zod: o painel nunca fala com o backend
 * (CORS do Meet, camadas do CLAUDE.md). Ações deste hook: `open`, `defer`, `bind` e `discard`
 * (descartar a reunião encerrada e não enviada, D-11 — o comando do 08-13).
 */
import { useCallback, useEffect, useState } from 'react';
import type { MeetingAssociation } from '@/features/agente/association';
import { subscribeAssociations } from '@/shared/config/agenteAssociationStore';
import {
  EMPTY_DELIVERY,
  subscribeDelivery,
  type AgenteDelivery,
} from '@/shared/config/agenteDeliveryStore';
import { usePlatform } from '@/shared/platform/context';
import type { Platform } from '@/shared/platform/types';
import {
  agenteCommandResultSchema,
  type AgenteBindTarget,
  type AgenteCommandResult,
} from '@/shared/types/agenteMessages';
import type { UiCommand } from '@/shared/types/messages';

const UNAVAILABLE: AgenteCommandResult = { ok: false, error: 'unavailable' };

/**
 * Manda um comando `ui/agente/*` e devolve o resultado tipado. Sem destinatário (`null`), resposta
 * fora do contrato ou falha da ponte -> `{ ok: false, error: 'unavailable' }`: a tela cai no texto de
 * "tente de novo" em vez de quebrar. O 08-17 e o 08-20 reaproveitam esta função.
 */
export async function sendAgenteCommand(
  platform: Platform,
  command: UiCommand,
): Promise<AgenteCommandResult> {
  try {
    const parsed = agenteCommandResultSchema.safeParse(await platform.send(command));
    return parsed.success ? parsed.data : UNAVAILABLE;
  } catch {
    return UNAVAILABLE;
  }
}

export interface MeetingAssociationApi {
  /** `null` = a reunião não tem associação (envio desligado, ou reunião de antes da Fase 8). */
  association: MeetingAssociation | null;
  delivery: AgenteDelivery;
  open: () => Promise<AgenteCommandResult>;
  defer: () => Promise<AgenteCommandResult>;
  bind: (target: AgenteBindTarget) => Promise<AgenteCommandResult>;
  /** Descarta de vez a cópia local de uma reunião encerrada e não enviada. Quem chama já confirmou. */
  discard: () => Promise<AgenteCommandResult>;
  /** "Continuar envio" (08-20): retoma o envio em partes parado, da última parte confirmada. */
  resumeSend: () => Promise<AgenteCommandResult>;
}

export function useMeetingAssociation(meetingId: string | null): MeetingAssociationApi {
  const platform = usePlatform();
  const [association, setAssociation] = useState<MeetingAssociation | null>(null);
  const [delivery, setDelivery] = useState<AgenteDelivery>(EMPTY_DELIVERY);

  useEffect(() => {
    if (meetingId === null) {
      setAssociation(null);
      return;
    }
    return subscribeAssociations((map) => setAssociation(map[meetingId] ?? null));
  }, [meetingId]);

  useEffect(() => subscribeDelivery(setDelivery), []);

  const open = useCallback(
    () =>
      meetingId === null
        ? Promise.resolve(UNAVAILABLE)
        : sendAgenteCommand(platform, { type: 'ui/agente/meeting/open', meetingId }),
    [platform, meetingId],
  );
  const defer = useCallback(
    () =>
      meetingId === null
        ? Promise.resolve(UNAVAILABLE)
        : sendAgenteCommand(platform, { type: 'ui/agente/meeting/defer', meetingId }),
    [platform, meetingId],
  );
  const bind = useCallback(
    (target: AgenteBindTarget) =>
      meetingId === null
        ? Promise.resolve(UNAVAILABLE)
        : sendAgenteCommand(platform, { type: 'ui/agente/meeting/bind', meetingId, target }),
    [platform, meetingId],
  );

  const discard = useCallback(
    () =>
      meetingId === null
        ? Promise.resolve(UNAVAILABLE)
        : sendAgenteCommand(platform, { type: 'ui/agente/meeting/discard', meetingId }),
    [platform, meetingId],
  );

  const resumeSend = useCallback(
    () =>
      meetingId === null
        ? Promise.resolve(UNAVAILABLE)
        : sendAgenteCommand(platform, { type: 'ui/agente/meeting/resume-send', meetingId }),
    [platform, meetingId],
  );

  return { association, delivery, open, defer, bind, discard, resumeSend };
}
