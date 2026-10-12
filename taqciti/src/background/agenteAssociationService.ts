/**
 * O que o service worker faz quando a UI pede algo sobre o vínculo reunião → cliente (Fase 8,
 * TAQ-02): listar clientes, abrir o cartão e adiar. Cada comando devolve um resultado tipado
 * (`AgenteCommandResult`); a UI escolhe a cópia pelo `error`. Só fala com o store de associações
 * (escritor único) e com as portas injetadas — nenhum `chrome` direto, nenhuma regra de transição
 * aqui (quem decide é o reducer de `features/agente/association.ts`).
 */
import type { AssociationEvent, AssociationState } from '@/features/agente/association';
import type {
  AgenteSessionGateway,
  ClientDirectory,
} from '@/features/agente/clientDirectory';
import { sortClients } from '@/features/agente/clientSearch';
import { applyAssociationEvent } from '@/shared/config/agenteAssociationStore';
import type { AgenteCommandResult } from '@/shared/types/agenteMessages';

export interface AgenteAssociationServiceDeps {
  directory: ClientDirectory;
  sessions: AgenteSessionGateway;
}

export function createAgenteAssociationService(deps: AgenteAssociationServiceDeps) {
  /**
   * Aplica um evento simples. Repetir o comando que já está valendo (abrir um cartão já aberto,
   * adiar um já adiado) é sucesso, não erro: a UI pode reenviar sem medo.
   */
  async function transition(
    meetingId: string,
    event: AssociationEvent,
    alreadyThere: AssociationState,
  ): Promise<AgenteCommandResult> {
    const { applied, association } = await applyAssociationEvent(meetingId, event);
    if (association === null) return { ok: false, error: 'not-found' };
    if (applied || association.state === alreadyThere) return { ok: true };
    return { ok: false, error: 'invalid-state' };
  }

  async function listClients(): Promise<AgenteCommandResult> {
    try {
      return { ok: true, clients: sortClients(await deps.directory.list()) };
    } catch {
      // Sem as rotas da decisão B1 (ou fora do ar): o seletor cai no plano B do ID manual (D-02).
      return { ok: false, error: 'unavailable' };
    }
  }

  return {
    listClients,
    open: (meetingId: string) => transition(meetingId, { type: 'opened' }, 'choosing'),
    defer: (meetingId: string) => transition(meetingId, { type: 'deferred' }, 'deferred'),
  };
}

export type AgenteAssociationService = ReturnType<typeof createAgenteAssociationService>;
