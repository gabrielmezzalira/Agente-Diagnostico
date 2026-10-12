/**
 * Raiz de composição do agendador do encerramento da sessão (Fase 8, B4-b, plano 08-27): monta o agendador
 * com as portas de produção — relógio, `chrome.alarms`, stores de associação e de fila, a porta HTTP do
 * finish (08-16), a espera pelas falas finais e o kick do envio (Task 1). Mesmo padrão de `agenteStreamer.ts`
 * e `agenteAssociation.ts`. A lógica mora em `agenteSessionFinisherInstance.ts`.
 *
 * FALHA SEGURA: até o `index.ts` informar quais reuniões estão ao vivo (plano 08-25), `isMeetingLive`
 * responde "ao vivo" — sem o estado da reunião ninguém é encerrado. Importar este módulo não executa nada
 * nem toca `chrome.alarms` (só a permissão do plano 08-25 libera isso em runtime).
 */
import { applyAssociationEvent, getAssociation, loadAssociations } from '@/shared/config/agenteAssociationStore';
import { createAgenteConfigReader } from '@/shared/config/agenteConfigStore';
import { countOutboxItemsForSession } from '@/shared/config/agenteOutboxStore';
import { kickAgenteSender, whenAgenteStreamerIdle } from './agenteStreamer';
import {
  createAgenteSessionFinisher,
  type AgenteFinisherAlarms,
  type AgenteSessionFinisherDeps,
} from './agenteSessionFinisherInstance';
import { createHttpSessionFinisher } from './httpSessionGateway';

export { createAgenteSessionFinisher, type AgenteSessionFinisherDeps };

/** `chrome.alarms` só é tocado quando o agendador pede um alarme (nunca ao importar o módulo). */
const chromeAlarms: AgenteFinisherAlarms = {
  create: async (name, when) => {
    await chrome.alarms.create(name, { when });
  },
  clear: async (name) => {
    await chrome.alarms.clear(name);
  },
};

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** `createAgenteConfigReader()` é preguiçoso: só toca o storage na primeira chamada. */
const loadConfig = createAgenteConfigReader();
let activeDeps: AgenteSessionFinisherDeps = {
  finisher: createHttpSessionFinisher({ loadConfig }),
  alarms: chromeAlarms,
  now: Date.now,
  sleep: defaultSleep,
  isMeetingLive: () => true, // falha segura até o index.ts configurar (08-25)
  countQueued: countOutboxItemsForSession,
  whenStreamerIdle: whenAgenteStreamerIdle,
  nudgeDelivery: kickAgenteSender,
  getAssociation,
  loadAssociations,
  applyEvent: applyAssociationEvent,
};
let activeFinisher = createAgenteSessionFinisher(activeDeps);

/** Seam de composição/teste: mescla portas parciais nas atuais e recria o agendador. */
export function configureAgenteSessionFinisher(partial: Partial<AgenteSessionFinisherDeps>): void {
  activeDeps = { ...activeDeps, ...partial };
  activeFinisher = createAgenteSessionFinisher(activeDeps);
}

/** O que o `index.ts` chamará (08-25) — delegação pura para a instância ativa. */
export const agenteSessionFinisher = {
  evaluate: (meetingId: string) => activeFinisher.evaluate(meetingId),
  handleAlarm: (name: string) => activeFinisher.handleAlarm(name),
  rescheduleAfterRestart: () => activeFinisher.rescheduleAfterRestart(),
  restartGaveUpRounds: () => activeFinisher.restartGaveUpRounds(),
  isClosing: (meetingId: string) => activeFinisher.isClosing(meetingId),
};
