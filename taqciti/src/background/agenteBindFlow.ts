/**
 * O vínculo de uma reunião com um cliente/sessão (Fase 8, TAQ-02, D-03/D-09/D-12, Pitfall 8). Roda só
 * no service worker; a UI apenas pede (`ui/agente/meeting/bind`).
 *
 * Ordem — pensada para a reunião inteira ir para o MESMO lugar, sem perder nem repetir nada:
 * (1) resolve o alvo (cria o cliente se for novo); (2) grava `link-started` (ao vivo) ou
 * `send-started` (reunião já encerrada) ANTES de criar a sessão — o segundo comando simultâneo vê o
 * estado novo e recebe `invalid-state`; (3) cria UMA sessão pela porta; (4) responde `{ ok: true }`;
 * (5) em segundo plano manda em partes tudo o que já foi falado (ou a reunião guardada) — o envio ao
 * vivo fica em espera (`linking`) até o fim, e só então a associação vira `linked` com a semente.
 */
import type { AssociationEvent, AssociationState } from '@/features/agente/association';
import { planMeetingUpload } from '@/features/agente/meetingUploader';
import type {
  AgenteSessionGateway,
  ClientDirectory,
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
import { bindFail, resolveBindTarget, type ResolvedTarget } from './agenteBindTarget';

export interface BindFlowDeps extends BindUploadDeps {
  directory: ClientDirectory;
  sessions: AgenteSessionGateway;
  getMeetingState: () => MeetingState;
  /** Reunião guardada no histórico (a do envio no fim, ou a que já saiu da tela durante o vínculo). */
  getRecord: (meetingId: string) => Promise<MeetingRecord | null>;
}

/** `live`: a reunião está acontecendo; `ended`: já acabou e a transcrição está guardada (D-09). */
type Mode = 'live' | 'ended';

const LIVE_PHASES: readonly MeetingPhase[] = ['captionsRequired', 'recording', 'paused'];
const BEFORE_LINK: readonly AssociationState[] = ['pending', 'choosing', 'deferred'];

/** A reunião `meetingId` é a que está acontecendo agora? */
function isLive(state: MeetingState, meetingId: string): boolean {
  return state.session?.meetingId === meetingId && LIVE_PHASES.includes(state.phase);
}

function modeOf(state: AssociationState, live: boolean): Mode | null {
  if (live && BEFORE_LINK.includes(state)) return 'live';
  if (!live && state === 'ended-unsent') return 'ended';
  return null;
}

function startedEvent(mode: Mode, target: ResolvedTarget): AssociationEvent {
  const base = {
    origin: target.origin,
    clientName: target.clientName,
    ...(target.sessionId !== undefined && { sessionId: target.sessionId }),
  };
  return mode === 'live'
    ? { type: 'link-started', ...base }
    : { type: 'send-started', ...base };
}

export function createBindFlow(deps: BindFlowDeps) {
  const inFlight = new Set<string>();
  const uploads = new Set<Promise<void>>();

  /** A criação da sessão falhou: volta a poder escolher; se a reunião já acabou, o cartão do fim aparece. */
  async function failCreateSession(mode: Mode, meetingId: string): Promise<void> {
    if (mode === 'ended') {
      await applyAssociationEvent(meetingId, {
        type: 'send-failed',
        error: 'create-session',
      });
      return;
    }
    await applyAssociationEvent(meetingId, {
      type: 'link-failed',
      error: 'create-session',
    });
    if (!isLive(deps.getMeetingState(), meetingId)) {
      await applyAssociationEvent(meetingId, { type: 'meeting-ended' });
    }
  }

  /** "Tudo o que já foi falado": a reunião ao vivo, ou — se já saiu da tela — o que ficou guardado. */
  async function spokenSegments(meetingId: string): Promise<LiveSegment[]> {
    const state = deps.getMeetingState();
    if (state.session?.meetingId === meetingId) return state.session.segments;
    return (await deps.getRecord(meetingId))?.segments ?? [];
  }

  async function bindOnce(
    meetingId: string,
    target: AgenteBindTarget,
  ): Promise<AgenteCommandResult> {
    const association = await getAssociation(meetingId);
    if (association === null) return bindFail('not-found');
    const meeting = deps.getMeetingState();
    const mode = modeOf(association.state, isLive(meeting, meetingId));
    if (mode === null) return bindFail('invalid-state');

    const record = mode === 'ended' ? await deps.getRecord(meetingId) : null;
    if (mode === 'ended' && record === null) return bindFail('not-found');

    const config = await deps.loadConfig();
    if (!config.streamingEnabled || !isValidAgenteBackendUrl(config.agenteBackendUrl)) {
      return bindFail('create-session');
    }

    const resolved = await resolveBindTarget(deps.directory, target);
    if ('ok' in resolved) return resolved;
    const started = await applyAssociationEvent(meetingId, startedEvent(mode, resolved));
    if (!started.applied) return bindFail('invalid-state');

    let sessionId = resolved.sessionId;
    if (sessionId === undefined) {
      try {
        const title = record?.title ?? meeting.session?.title ?? '';
        sessionId = (await deps.sessions.createSession(resolved.clientId ?? '', title))
          .sessionId;
      } catch (error) {
        logger.error('criar a sessão do Agente falhou', error);
        await failCreateSession(mode, meetingId);
        return bindFail('create-session');
      }
      await applyAssociationEvent(
        meetingId,
        mode === 'live'
          ? { type: 'session-created', sessionId }
          : { type: 'send-session-created', sessionId },
      );
    }

    const segments = record?.segments ?? (await spokenSegments(meetingId));
    const job: Promise<void> = runBindUpload(
      deps,
      meetingId,
      sessionId,
      planMeetingUpload(meetingId, segments),
    )
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
    if (inFlight.has(meetingId)) return bindFail('invalid-state');
    inFlight.add(meetingId);
    try {
      return await bindOnce(meetingId, target);
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
