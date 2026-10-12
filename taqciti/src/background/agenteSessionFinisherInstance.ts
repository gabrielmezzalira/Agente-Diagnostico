/**
 * O agendador do encerramento da sessão do Agente (Fase 8, decisão B4-b, plano 08-27). Para cada reunião
 * decide: encerrar agora (fila de envio vazia, depois de esperar a última fala), esperar a fila ou o prazo
 * de 5 minutos (envio parado), repetir com espera crescente quando o backend falha e desistir com limite —
 * nunca com a reunião ao vivo, nunca no plano B (`isEligibleForClose`) e nunca de novo depois de desistir.
 * Só portas injetadas (sem `chrome`): a composição de produção mora em `agenteSessionFinisher.ts` e quem
 * liga o agendador ao fim da reunião, ao boot e aos alarmes é o plano 08-25.
 */
import type { AssociationEvent, MeetingAssociation } from '@/features/agente/association';
import { canRestartFinishRound, isEligibleForClose } from '@/features/agente/associationClose';
import {
  AGENTE_FINISH_ALARM_PREFIX,
  AGENTE_FINISH_DRAIN_CHECK_MS,
  AGENTE_FINISH_DRAIN_GRACE_MS,
  AGENTE_STALLED_SEND_CLOSE_MS,
  AgenteFinishError,
  backoffAfterFailure,
  nextCheckAt,
  type SessionFinisherPort,
} from '@/features/agente/finishPolicy';
import type { ApplyResult, AssociationMap } from '@/shared/config/agenteAssociationStore';
import { logger } from '@/shared/services/log';
import { waitForQueueDrain } from './agenteSessionFinisherDrain';

export interface AgenteFinisherAlarms {
  create: (name: string, when: number) => Promise<void> | void;
  clear: (name: string) => Promise<void> | void;
}

export interface AgenteSessionFinisherDeps {
  finisher: SessionFinisherPort;
  alarms: AgenteFinisherAlarms;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  /** A reunião está ao vivo agora? Síncrona de propósito: é conferida logo antes de chamar o backend. */
  isMeetingLive: (meetingId: string) => boolean;
  /** Quantas falas da sessão ainda esperam entrega na fila durável. */
  countQueued: (sessionId: string) => Promise<number>;
  /** Espera as falas finais irem para a fila (não espera a resposta de rede). */
  whenStreamerIdle: () => Promise<void>;
  /** Pede ao envio uma nova tentativa de entrega da fila. */
  nudgeDelivery: () => Promise<void>;
  getAssociation: (meetingId: string) => Promise<MeetingAssociation | null>;
  loadAssociations: () => Promise<AssociationMap>;
  applyEvent: (meetingId: string, event: AssociationEvent) => Promise<ApplyResult>;
}

export function createAgenteSessionFinisher(deps: AgenteSessionFinisherDeps) {
  const inFlight = new Map<string, Promise<void>>();
  const closing = new Set<string>();
  const alarmName = (meetingId: string) => `${AGENTE_FINISH_ALARM_PREFIX}${meetingId}`;
  const clearAlarm = async (meetingId: string) => void (await deps.alarms.clear(alarmName(meetingId)));
  const eligibleOrNull = (a: MeetingAssociation | null) => (a !== null && isEligibleForClose(a) ? a : null);

  /** Passo 6: confere a reunião de novo, de forma síncrona, e só então chama o backend. */
  async function closeSession(meetingId: string, sessionId: string): Promise<void> {
    if (deps.isMeetingLive(meetingId)) return clearAlarm(meetingId);
    closing.add(meetingId);
    try {
      await deps.finisher.finishSession(sessionId); // 'finished' e 'gone' (nada a encerrar) fecham a conta igual
    } catch (error) {
      return recordFailure(meetingId, error);
    } finally {
      closing.delete(meetingId);
    }
    await deps.applyEvent(meetingId, { type: 'session-finished' });
    await clearAlarm(meetingId);
    // Defesa da reentrada (plano 08-24): a mesma sala voltou ao vivo enquanto o finish estava em voo.
    if (deps.isMeetingLive(meetingId)) await deps.applyEvent(meetingId, { type: 'meeting-resumed' });
  }

  async function recordFailure(meetingId: string, error: unknown): Promise<void> {
    const definitive = error instanceof AgenteFinishError && !error.retryable;
    await deps.applyEvent(meetingId, { type: 'finish-failed', ...(definitive && { definitive }) });
    const after = await deps.getAssociation(meetingId);
    const tries = after?.finishTries ?? 0;
    const wait = backoffAfterFailure(tries);
    if (after === null || after.finishGaveUp === true || wait === null) {
      logger.warn('desistiu de encerrar a sessão do Agente', { meetingId, attempts: tries });
      return clearAlarm(meetingId);
    }
    await deps.alarms.create(alarmName(meetingId), deps.now() + wait);
  }

  /** Passo 5: fila ainda cheia (ou envio parado) — grava o primeiro prazo e agenda a reconferência. */
  async function waitForDeadline(meetingId: string, sessionId: string, resends: boolean): Promise<void> {
    // A espera pela fila pode ter durado 10 s: se a sala voltou ao vivo, não arma prazo nenhum.
    if (deps.isMeetingLive(meetingId)) return clearAlarm(meetingId);
    await deps.applyEvent(meetingId, { type: 'finish-armed', by: deps.now() + AGENTE_STALLED_SEND_CLOSE_MS });
    const finishBy = (await deps.getAssociation(meetingId))?.finishBy;
    if (finishBy === undefined) return;
    if (deps.now() >= finishBy) return closeSession(meetingId, sessionId);
    if (resends) await deps.nudgeDelivery();
    await deps.alarms.create(alarmName(meetingId), nextCheckAt(deps.now(), finishBy));
  }

  async function run(meetingId: string): Promise<void> {
    const association = eligibleOrNull(await deps.getAssociation(meetingId));
    const sessionId = association?.sessionId;
    if (association === null || sessionId === undefined) return clearAlarm(meetingId);
    if (deps.isMeetingLive(meetingId)) return clearAlarm(meetingId);
    const decided = (association.finishTries ?? 0) > 0;
    if (decided || (association.finishBy !== undefined && deps.now() >= association.finishBy)) {
      return closeSession(meetingId, sessionId);
    }
    const resends = association.state !== 'send-failed';
    if (resends) {
      await deps.whenStreamerIdle();
      const drained = await waitForQueueDrain({
        count: () => deps.countQueued(sessionId),
        sleep: deps.sleep,
        graceMs: AGENTE_FINISH_DRAIN_GRACE_MS,
        checkMs: AGENTE_FINISH_DRAIN_CHECK_MS,
      });
      if (drained) return closeSession(meetingId, sessionId);
    }
    return waitForDeadline(meetingId, sessionId, resends);
  }

  /** Uma avaliação por reunião por vez: chamadas simultâneas do mesmo id compartilham a mesma promessa. */
  function evaluate(meetingId: string): Promise<void> {
    const running = inFlight.get(meetingId);
    if (running !== undefined) return running;
    const started = run(meetingId).finally(() => inFlight.delete(meetingId));
    inFlight.set(meetingId, started);
    return started;
  }

  async function handleAlarm(name: string): Promise<void> {
    if (!name.startsWith(AGENTE_FINISH_ALARM_PREFIX)) return;
    const meetingId = name.slice(AGENTE_FINISH_ALARM_PREFIX.length);
    await evaluate(meetingId).catch((error: unknown) => {
      logger.error('avaliar o encerramento da sessão do Agente falhou', error);
    });
  }

  /** Boot do service worker: avalia as associações elegíveis uma de cada vez (nunca em rajada); uma falha não impede as outras. */
  async function rescheduleAfterRestart(): Promise<void> {
    const map = await deps.loadAssociations();
    for (const association of Object.values(map)) {
      if (!isEligibleForClose(association)) continue;
      await evaluate(association.meetingId).catch((error: unknown) => {
        logger.error('retomar o encerramento da sessão do Agente falhou', error);
      });
    }
  }

  /**
   * DA-5 (nova-rodada-no-boot): quem desistiu de encerrar ganha uma rodada nova, UMA vez por abertura do navegador.
   * Quem chama é o `chrome.runtime.onStartup` — NUNCA o boot do service worker, que no MV3 dorme e acorda a todo
   * momento e faria uma rodada por acordada (sem limite, T-08-49).
   */
  async function restartGaveUpRounds(): Promise<void> {
    const map = await deps.loadAssociations();
    for (const association of Object.values(map)) {
      if (!canRestartFinishRound(association)) continue;
      try {
        await deps.applyEvent(association.meetingId, { type: 'finish-round-restarted' });
        await evaluate(association.meetingId);
      } catch (error: unknown) {
        logger.error('nova rodada de encerramento da sessão do Agente falhou', error);
      }
    }
  }

  return { evaluate, handleAlarm, rescheduleAfterRestart, restartGaveUpRounds, isClosing: (id: string) => closing.has(id) };
}
