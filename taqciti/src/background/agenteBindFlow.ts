/**
 * O vínculo de uma reunião com um cliente/sessão (Fase 8, TAQ-02, D-03/D-12, Pitfall 8). Roda só no
 * service worker; a UI apenas pede (`ui/agente/meeting/bind`).
 *
 * Ordem do vínculo ao vivo — pensada para a reunião inteira ir para o MESMO lugar, sem perder nem
 * repetir nada: (1) resolve o alvo (cria o cliente se for novo); (2) grava `link-started` ANTES de
 * criar a sessão — o segundo comando simultâneo vê `linking` e recebe `invalid-state`; (3) cria UMA
 * sessão pela porta; (4) responde `{ ok: true }`; (5) em segundo plano manda em partes tudo o que já
 * foi falado e só no fim grava `linked` com a semente — o envio ao vivo fica em espera (`linking`)
 * até lá.
 */
import { planMeetingUpload } from '@/features/agente/meetingUploader';
import type { AssociationEvent, AssociationState } from '@/features/agente/association';
import {
  DuplicateClientError,
  type AgenteSessionGateway,
  type ClientDirectory,
} from '@/features/agente/clientDirectory';
import {
  applyAssociationEvent,
  getAssociation,
} from '@/shared/config/agenteAssociationStore';
import { isValidAgenteBackendUrl } from '@/shared/config/agenteConfig';
import { logger } from '@/shared/services/log';
import type {
  AgenteBindTarget,
  AgenteCommandResult,
} from '@/shared/types/agenteMessages';
import type {
  LiveSegment,
  MeetingPhase,
  MeetingRecord,
  MeetingState,
} from '@/shared/types/domain';
import { runBindUpload, type BindUploadDeps } from './agenteBindUpload';

export interface BindFlowDeps extends BindUploadDeps {
  directory: ClientDirectory;
  sessions: AgenteSessionGateway;
  getMeetingState: () => MeetingState;
  /** Reunião guardada no histórico (a do envio no fim, ou a que já saiu da tela durante o vínculo). */
  getRecord: (meetingId: string) => Promise<MeetingRecord | null>;
}

const LIVE_PHASES: readonly MeetingPhase[] = ['captionsRequired', 'recording', 'paused'];
const BEFORE_LINK: readonly AssociationState[] = ['pending', 'choosing', 'deferred'];

const fail = (
  error: Extract<AgenteCommandResult, { ok: false }>['error'],
): AgenteCommandResult => ({
  ok: false,
  error,
});

/** A reunião `meetingId` é a que está acontecendo agora? */
function isLive(state: MeetingState, meetingId: string): boolean {
  return state.session?.meetingId === meetingId && LIVE_PHASES.includes(state.phase);
}

interface ResolvedTarget {
  origin: 'picker' | 'manual-id';
  clientName: string;
  /** Só no ID manual: a sessão já existe. */
  sessionId?: string;
  /** Só no cliente: dono da sessão a criar. */
  clientId?: string;
}

export function createBindFlow(deps: BindFlowDeps) {
  const inFlight = new Set<string>();
  const uploads = new Set<Promise<void>>();

  async function resolveTarget(
    target: AgenteBindTarget,
  ): Promise<ResolvedTarget | AgenteCommandResult> {
    switch (target.kind) {
      case 'manual':
        return {
          origin: 'manual-id',
          clientName: `Sessão ${target.sessionId.slice(0, 8)}`,
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
          const created = await deps.directory.create(target.name);
          return { origin: 'picker', clientId: created.id, clientName: created.client };
        } catch (error) {
          return fail(
            error instanceof DuplicateClientError ? 'duplicate' : 'create-client',
          );
        }
    }
  }

  /** A criação da sessão falhou: volta a poder escolher; se a reunião já acabou, o cartão do fim aparece. */
  async function failCreateSession(meetingId: string): Promise<void> {
    await applyAssociationEvent(meetingId, {
      type: 'link-failed',
      error: 'create-session',
    });
    if (!isLive(deps.getMeetingState(), meetingId)) {
      await applyAssociationEvent(meetingId, { type: 'meeting-ended' });
    }
  }

  /** "Tudo o que já foi falado": a reunião ao vivo, ou — se já saiu da tela — o que ficou guardado. */
  async function liveSegments(meetingId: string): Promise<LiveSegment[]> {
    const state = deps.getMeetingState();
    if (state.session?.meetingId === meetingId) return state.session.segments;
    return (await deps.getRecord(meetingId))?.segments ?? [];
  }

  async function bindLive(
    meetingId: string,
    target: AgenteBindTarget,
  ): Promise<AgenteCommandResult> {
    const association = await getAssociation(meetingId);
    if (association === null) return fail('not-found');
    const meeting = deps.getMeetingState();
    if (!BEFORE_LINK.includes(association.state) || !isLive(meeting, meetingId)) {
      return fail('invalid-state');
    }

    const config = await deps.loadConfig();
    if (!config.streamingEnabled || !isValidAgenteBackendUrl(config.agenteBackendUrl)) {
      return fail('create-session');
    }

    const resolved = await resolveTarget(target);
    if ('ok' in resolved) return resolved;

    const started: AssociationEvent = {
      type: 'link-started',
      origin: resolved.origin,
      clientName: resolved.clientName,
      ...(resolved.sessionId !== undefined && { sessionId: resolved.sessionId }),
    };
    if (!(await applyAssociationEvent(meetingId, started)).applied)
      return fail('invalid-state');

    let sessionId = resolved.sessionId;
    if (sessionId === undefined) {
      try {
        const title = meeting.session?.title ?? '';
        sessionId = (await deps.sessions.createSession(resolved.clientId ?? '', title))
          .sessionId;
      } catch (error) {
        logger.error('criar a sessão do Agente falhou', error);
        await failCreateSession(meetingId);
        return fail('create-session');
      }
      await applyAssociationEvent(meetingId, { type: 'session-created', sessionId });
    }

    const parts = planMeetingUpload(meetingId, await liveSegments(meetingId));
    const job: Promise<void> = runBindUpload(deps, meetingId, sessionId, parts)
      .catch((error: unknown) => logger.error('envio em partes do vínculo falhou', error))
      .finally(() => uploads.delete(job));
    uploads.add(job);
    return { ok: true };
  }

  async function bind(
    meetingId: string,
    target: AgenteBindTarget,
  ): Promise<AgenteCommandResult> {
    // Guarda síncrona: dois comandos para a mesma reunião nunca passam juntos da validação (T-08-18).
    if (inFlight.has(meetingId)) return fail('invalid-state');
    inFlight.add(meetingId);
    try {
      return await bindLive(meetingId, target);
    } finally {
      inFlight.delete(meetingId);
    }
  }

  /** Só para testes: espera os envios em partes que estão rodando em segundo plano. */
  async function whenIdle(): Promise<void> {
    await Promise.all([...uploads]);
  }

  return { bind, whenIdle };
}

export type BindFlow = ReturnType<typeof createBindFlow>;
