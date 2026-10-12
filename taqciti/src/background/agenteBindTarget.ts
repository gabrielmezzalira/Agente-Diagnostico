/**
 * Quem é o destino do vínculo (Fase 8, TAQ-02, D-02/D-03): transforma o alvo pedido pela UI (ID
 * colado, cliente da lista ou cliente novo) em "o que a associação precisa saber". Separado de
 * `agenteBindFlow.ts` (SRP): aqui só se RESOLVE o alvo; o fluxo cuida da ordem do vínculo.
 *
 * Criar o cliente é o único efeito colateral — e só acontece depois de a validação de estado do
 * fluxo passar.
 */
import {
  DuplicateClientError,
  type ClientDirectory,
} from '@/features/agente/clientDirectory';
import type {
  AgenteBindTarget,
  AgenteCommandError,
  AgenteCommandResult,
} from '@/shared/types/agenteMessages';

export interface ResolvedTarget {
  origin: 'picker' | 'manual-id';
  clientName: string;
  /** Só no ID manual: a sessão já existe. */
  sessionId?: string;
  /** Só no cliente: dono da sessão a criar. */
  clientId?: string;
}

export const bindFail = (error: AgenteCommandError): AgenteCommandResult => ({
  ok: false,
  error,
});

/** Rótulo do vínculo manual (suposição reversível): `Sessão {8 primeiros caracteres do ID}`. */
function manualLabel(sessionId: string): string {
  return `Sessão ${sessionId.slice(0, 8)}`;
}

export async function resolveBindTarget(
  directory: ClientDirectory,
  target: AgenteBindTarget,
): Promise<ResolvedTarget | AgenteCommandResult> {
  switch (target.kind) {
    case 'manual':
      return {
        origin: 'manual-id',
        clientName: manualLabel(target.sessionId),
        sessionId: target.sessionId,
      };
    case 'client':
      return {
        origin: 'picker',
        clientId: target.clientId,
        clientName: target.clientName,
      };
    case 'new-client':
      try {
        const created = await directory.create(target.name);
        return { origin: 'picker', clientId: created.id, clientName: created.client };
      } catch (error) {
        return bindFail(
          error instanceof DuplicateClientError ? 'duplicate' : 'create-client',
        );
      }
  }
}
