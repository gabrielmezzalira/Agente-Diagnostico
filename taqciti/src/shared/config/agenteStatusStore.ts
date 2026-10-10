/**
 * Leitura e escrita do status de runtime do envio ao Agente (WR-07) em
 * `chrome.storage.session` — some ao fechar o navegador, sobrevive ao
 * reinício do service worker. Mesmo padrão de `agenteConfigStore.ts`: fila de
 * escrita serializada (dois escritores no service worker — a fila de envio e
 * o streamer — nunca apagam o campo um do outro) + `onChanged`, sem polling.
 */
import type { Unsubscribe } from '@/shared/types/domain';
import { readSession, writeSession } from '@/shared/services/storage';
import { STORAGE_KEYS } from './constants';
import {
  EMPTY_AGENTE_STATUS,
  normalizeAgenteStatus,
  type AgenteStreamingStatus,
} from './agenteStatus';

let queue: Promise<unknown> = Promise.resolve();

export async function loadAgenteStatus(): Promise<AgenteStreamingStatus> {
  return normalizeAgenteStatus(
    await readSession<Partial<AgenteStreamingStatus>>(STORAGE_KEYS.agenteStatus),
  );
}

/** Aplica um patch serializado; uma falha não envenena as escritas seguintes. */
export function patchAgenteStatus(
  patch: Partial<AgenteStreamingStatus>,
): Promise<AgenteStreamingStatus> {
  const run = queue
    .catch(() => undefined)
    .then(async () => {
      const next = normalizeAgenteStatus({ ...(await loadAgenteStatus()), ...patch });
      await writeSession(STORAGE_KEYS.agenteStatus, next);
      return next;
    });
  queue = run;
  return run;
}

/**
 * WR-04: no boot do service worker, um "tentando de novo…" gravado antes do reinício é falso — a
 * fila de reenvio era só memória e se perdeu. Troca por `interrupted`, preservando o resto. Só
 * mexe em `retrying`; qualquer outro resultado já é definitivo. Roda na mesma fila das demais
 * escritas, então não apaga o campo de ninguém.
 */
export function markInterruptedSend(): Promise<void> {
  const run = queue
    .catch(() => undefined)
    .then(async () => {
      const current = await loadAgenteStatus();
      if (current.lastOutcome !== 'retrying') return;
      await writeSession(STORAGE_KEYS.agenteStatus, { ...current, lastOutcome: 'interrupted' });
    });
  queue = run;
  return run;
}

/** Valor atual logo de cara e depois a cada mudança. */
export function subscribeAgenteStatus(
  onStatus: (status: AgenteStreamingStatus) => void,
): Unsubscribe {
  let live = true;
  let gotChange = false;

  void loadAgenteStatus()
    .then((status) => {
      // Uma mudança que chegou antes da leitura inicial é mais nova que ela (IN-02).
      if (live && !gotChange) onStatus(status);
    })
    .catch(() => {
      if (live && !gotChange) onStatus(EMPTY_AGENTE_STATUS);
    });

  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (!live || area !== 'session' || !(STORAGE_KEYS.agenteStatus in changes)) return;
    gotChange = true;
    onStatus(
      normalizeAgenteStatus(
        changes[STORAGE_KEYS.agenteStatus]?.newValue as Partial<AgenteStreamingStatus> | undefined,
      ),
    );
  };

  chrome.storage.onChanged.addListener(listener);
  return () => {
    live = false;
    chrome.storage.onChanged.removeListener(listener);
  };
}
