/**
 * O que o service worker faz quando a UI pede algo sobre o vínculo reunião → cliente (Fase 8,
 * TAQ-02): listar clientes, abrir o cartão e adiar. Cada comando devolve um resultado tipado
 * (`AgenteCommandResult`); a UI escolhe a cópia pelo `error`. Só fala com o store de associações
 * (escritor único) e com as portas injetadas — nenhum `chrome` direto, nenhuma regra de transição
 * aqui (quem decide é o reducer de `features/agente/association.ts`).
 */
import type { AssociationEvent, AssociationState } from '@/features/agente/association';
import { sortClients } from '@/features/agente/clientSearch';
import {
  applyAssociationEvent,
  getAssociation,
  removeAssociation,
} from '@/shared/config/agenteAssociationStore';
import type { MeetingPhase, MeetingState } from '@/shared/types/domain';
import type {
  AgenteBindTarget,
  AgenteCommandResult,
} from '@/shared/types/agenteMessages';
import { createBindFlow, type BindFlowDeps } from './agenteBindFlow';

/** Tudo o que o serviço usa; o vínculo (`bind`) delega ao fluxo, que leva as mesmas portas. */
export interface AgenteAssociationServiceDeps extends BindFlowDeps {
  /** Apaga o registro da reunião do histórico local (nunca toca o backend). */
  deleteRecord: (meetingId: string) => Promise<void>;
  /** A reunião está em `ended` na máquina: volta ao ocioso para o painel não ficar preso nela. */
  resetEndedMeeting: (meetingId: string) => Promise<void>;
}

const LIVE_PHASES: readonly MeetingPhase[] = ['captionsRequired', 'recording', 'paused'];

function isMeetingLive(state: MeetingState, meetingId: string): boolean {
  return state.session?.meetingId === meetingId && LIVE_PHASES.includes(state.phase);
}

export function createAgenteAssociationService(deps: AgenteAssociationServiceDeps) {
  const bindFlow = createBindFlow(deps);

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

  /**
   * Descartar (D-11, T7): porta sem volta, por isso a regra de estado é checada AQUI, não na UI —
   * só `ended-unsent` e fora do ar. Apaga o registro local e a associação; nada é apagado no backend.
   */
  async function discard(meetingId: string): Promise<AgenteCommandResult> {
    const association = await getAssociation(meetingId);
    if (association === null) return { ok: false, error: 'not-found' };
    const meeting = deps.getMeetingState();
    if (association.state !== 'ended-unsent' || isMeetingLive(meeting, meetingId)) {
      return { ok: false, error: 'invalid-state' };
    }
    if (meeting.session?.meetingId === meetingId && meeting.phase === 'ended') {
      await deps.resetEndedMeeting(meetingId);
    }
    await deps.deleteRecord(meetingId);
    await removeAssociation(meetingId);
    return { ok: true };
  }

  return {
    listClients,
    open: (meetingId: string) => transition(meetingId, { type: 'opened' }, 'choosing'),
    defer: (meetingId: string) => transition(meetingId, { type: 'deferred' }, 'deferred'),
    bind: (meetingId: string, target: AgenteBindTarget) =>
      bindFlow.bind(meetingId, target),
    discard,
    /** Só para testes: espera o envio em partes que roda em segundo plano. */
    whenIdle: () => bindFlow.whenIdle(),
  };
}

export type AgenteAssociationService = ReturnType<typeof createAgenteAssociationService>;
