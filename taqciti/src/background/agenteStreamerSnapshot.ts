/**
 * Persistência do streamer do Agente em `chrome.storage.session` (Fase 7,
 * WR-02): o cursor (palavras já contadas por segmento) e as falas pendentes
 * da janela. O service worker do MV3 morre e renasce o tempo todo; sem isto,
 * uma fala na janela (até 5 s de texto) sumia no reinício, e o cursor zerado
 * fazia o primeiro flush depois dele pular palavras.
 *
 * `storage.session` é o mesmo lugar do `taq:state` (que já guarda a
 * transcrição inteira): só contextos da extensão leem, e some ao fechar o
 * navegador.
 */
import type { StreamCursor } from '@/features/agente/wordDelta';
import { EMPTY_PHRASE_BUFFER, type PhraseBuffer } from '@/features/agente/phraseBatcher';
import { STORAGE_KEYS } from '@/shared/config/constants';
import { readSession, removeSession, writeSession } from '@/shared/services/storage';
import { logger } from '@/shared/services/log';

export interface AgenteStreamerSnapshot {
  cursor: StreamCursor | null;
  pending: PhraseBuffer;
}

export interface AgenteStreamerSnapshotStore {
  load: () => Promise<AgenteStreamerSnapshot | null>;
  save: (snapshot: AgenteStreamerSnapshot) => Promise<void>;
  clear: () => Promise<void>;
}

export const sessionSnapshotStore: AgenteStreamerSnapshotStore = {
  load: () => readSession<AgenteStreamerSnapshot>(STORAGE_KEYS.agenteStreamer),
  save: (snapshot) => writeSession(STORAGE_KEYS.agenteStreamer, snapshot),
  clear: () => removeSession(STORAGE_KEYS.agenteStreamer),
};

/**
 * Envolve o store com a regra de custo do D-09: com o streaming desligado
 * (cursor nulo e nada pendente), só escreve UMA vez para limpar — nunca a
 * cada flush. Falhas de storage só vão para o log: perder o snapshot é
 * voltar ao comportamento antigo, nunca travar o streamer.
 */
export function createSnapshotPersister(store: AgenteStreamerSnapshotStore) {
  /** `false` enquanto não se sabe se há algo gravado (antes do `restore`). */
  let storedEmpty = false;

  async function restore(): Promise<AgenteStreamerSnapshot | null> {
    try {
      const snapshot = await store.load();
      storedEmpty = snapshot === null;
      return snapshot ? { cursor: snapshot.cursor, pending: snapshot.pending ?? EMPTY_PHRASE_BUFFER } : null;
    } catch (error) {
      logger.error('restaurar o streamer do Agente falhou', error);
      return null;
    }
  }

  async function persist(cursor: StreamCursor | null, pending: PhraseBuffer): Promise<void> {
    const empty = cursor === null && pending.length === 0;
    if (empty && storedEmpty) return;
    try {
      if (empty) {
        await store.clear();
      } else {
        await store.save({ cursor, pending });
      }
      storedEmpty = empty;
    } catch (error) {
      logger.error('salvar o streamer do Agente falhou', error);
    }
  }

  return { restore, persist };
}
