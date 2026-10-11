/**
 * Leitura e escrita do status de runtime do envio ao Agente (WR-07) em
 * `chrome.storage.session` — some ao fechar o navegador, sobrevive ao
 * reinício do service worker. `onChanged`, sem polling.
 *
 * Duas chaves, cada uma com UM dono (WR-02, 3ª revisão). Antes era um objeto só, e tela e service
 * worker faziam read-modify-write dele sem coordenação entre contextos: o reset da tela podia
 * ressuscitar o aviso "Reunião nova detectada" (e o 401 antigo podia voltar do outro lado).
 * - resultado do envio (`taq:agenteSendOutcome`): escrito pelo envio, zerado pela tela;
 * - espera por confirmação (`taq:agenteWaiting`): escrita SÓ pelo service worker.
 * Toda escrita é do valor inteiro da chave, sem ler antes — não há campo alheio para apagar.
 * A tela recebe as duas chaves juntas (`subscribeAgenteStatus`).
 */
import type { Unsubscribe } from '@/shared/types/domain';
import { readSession, writeSession } from '@/shared/services/storage';
import { STORAGE_KEYS } from './constants';
import {
  EMPTY_AGENTE_STATUS,
  NO_SEND_OUTCOME,
  normalizeAgenteStatus,
  type AgenteSendRecord,
  type AgenteStreamingStatus,
  type AgenteWaitingRecord,
} from './agenteStatus';

type RawStatusPart = Partial<AgenteStreamingStatus> | null;

/**
 * Só ordena as escritas DESTE contexto (o resultado 'retrying' tem de chegar antes do 'sent'
 * que o segue). Nada aqui lê para depois gravar, então a ordem entre contextos não importa.
 */
let writes: Promise<void> = Promise.resolve();

function enqueueWrite(run: () => Promise<void>): Promise<void> {
  const next = writes.catch(() => undefined).then(run);
  writes = next;
  return next;
}

function mergeParts(outcome: RawStatusPart, waiting: RawStatusPart): AgenteStreamingStatus {
  return normalizeAgenteStatus({ ...outcome, ...waiting });
}

export async function loadAgenteStatus(): Promise<AgenteStreamingStatus> {
  const [outcome, waiting] = await Promise.all([
    readSession<RawStatusPart>(STORAGE_KEYS.agenteSendOutcome),
    readSession<RawStatusPart>(STORAGE_KEYS.agenteWaiting),
  ]);
  return mergeParts(outcome, waiting);
}

/** Resultado do último envio (o envio escreve). Valor inteiro da chave, sem leitura antes. */
export function writeSendOutcome(record: AgenteSendRecord): Promise<void> {
  return enqueueWrite(() => writeSession(STORAGE_KEYS.agenteSendOutcome, record));
}

/** A tela zera o resultado quando a config muda — escrita direta, sem ler antes: nada a perder. */
export function resetSendOutcome(): Promise<void> {
  return writeSendOutcome(NO_SEND_OUTCOME);
}

/** Reunião nova esperando confirmação, ou `null` (só o service worker escreve). */
export function writeWaitingMeeting(waitingMeetingId: string | null): Promise<void> {
  const record: AgenteWaitingRecord = { waitingMeetingId };
  return enqueueWrite(() => writeSession(STORAGE_KEYS.agenteWaiting, record));
}

/**
 * WR-04: no boot do service worker, um "tentando de novo…" gravado antes do reinício é falso — a
 * fila de reenvio era só memória e se perdeu. Troca por `interrupted`, preservando o resto. Só
 * mexe em `retrying` e SÓ na chave do resultado do envio; qualquer outro resultado já é definitivo.
 */
export function markInterruptedSend(): Promise<void> {
  return enqueueWrite(async () => {
    const current = normalizeAgenteStatus(
      await readSession<RawStatusPart>(STORAGE_KEYS.agenteSendOutcome),
    );
    if (current.lastOutcome !== 'retrying') return;
    const record: AgenteSendRecord = {
      lastOutcome: 'interrupted',
      lastHttpStatus: current.lastHttpStatus,
      lastAttemptAt: current.lastAttemptAt,
    };
    await writeSession(STORAGE_KEYS.agenteSendOutcome, record);
  });
}

/** Valor atual logo de cara e depois a cada mudança de qualquer uma das duas chaves. */
export function subscribeAgenteStatus(
  onStatus: (status: AgenteStreamingStatus) => void,
): Unsubscribe {
  let live = true;
  let outcome: RawStatusPart = null;
  let waiting: RawStatusPart = null;
  /** Uma mudança que chegou antes da leitura inicial é mais nova que ela (IN-02) — por chave. */
  let outcomeChanged = false;
  let waitingChanged = false;

  void Promise.all([
    readSession<RawStatusPart>(STORAGE_KEYS.agenteSendOutcome),
    readSession<RawStatusPart>(STORAGE_KEYS.agenteWaiting),
  ])
    .then(([initialOutcome, initialWaiting]) => {
      if (!live) return;
      if (!outcomeChanged) outcome = initialOutcome;
      if (!waitingChanged) waiting = initialWaiting;
      if (!(outcomeChanged && waitingChanged)) onStatus(mergeParts(outcome, waiting));
    })
    .catch(() => {
      if (live && !outcomeChanged && !waitingChanged) onStatus(EMPTY_AGENTE_STATUS);
    });

  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (!live || area !== 'session') return;
    const outcomeChange = changes[STORAGE_KEYS.agenteSendOutcome];
    const waitingChange = changes[STORAGE_KEYS.agenteWaiting];
    if (!outcomeChange && !waitingChange) return;
    if (outcomeChange) {
      outcomeChanged = true;
      outcome = (outcomeChange.newValue as RawStatusPart | undefined) ?? null;
    }
    if (waitingChange) {
      waitingChanged = true;
      waiting = (waitingChange.newValue as RawStatusPart | undefined) ?? null;
    }
    onStatus(mergeParts(outcome, waiting));
  };

  chrome.storage.onChanged.addListener(listener);
  return () => {
    live = false;
    chrome.storage.onChanged.removeListener(listener);
  };
}
