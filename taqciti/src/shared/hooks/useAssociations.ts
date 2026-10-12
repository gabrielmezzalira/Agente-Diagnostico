/**
 * O mapa de associações reunião -> Agente para as listas do painel (Fase 8, TAQ-02, UI-SPEC §6).
 *
 * Um histórico com 100 cartões não pode abrir 100 ouvintes de `chrome.storage.onChanged`: aqui existe
 * UMA assinatura de `subscribeAssociations` por superfície, compartilhada por todos os selos
 * (`useSyncExternalStore` sobre um cache de módulo). A assinatura nasce com o primeiro selo montado e
 * é encerrada quando o último sai, voltando o cache para o vazio — nada de dado velho na próxima vez.
 *
 * Só LEITURA de `storage.local` (o service worker é o único escritor).
 */
import { useSyncExternalStore } from 'react';
import type { MeetingAssociation } from '@/features/agente/association';
import { subscribeAssociations, type AssociationMap } from '@/shared/config/agenteAssociationStore';
import type { Unsubscribe } from '@/shared/types/domain';

const EMPTY: AssociationMap = Object.freeze({});

let snapshot: AssociationMap = EMPTY;
let stopUpstream: Unsubscribe | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of [...listeners]) listener();
}

function subscribe(listener: () => void): Unsubscribe {
  listeners.add(listener);
  if (stopUpstream === null) {
    stopUpstream = subscribeAssociations((map) => {
      snapshot = map;
      notify();
    });
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && stopUpstream !== null) {
      stopUpstream();
      stopUpstream = null;
      snapshot = EMPTY;
    }
  };
}

function getSnapshot(): AssociationMap {
  return snapshot;
}

/** Todas as associações (mapa `meetingId -> associação`). */
export function useAssociations(): AssociationMap {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** A associação de UMA reunião; `null` = reunião sem associação (antiga ou envio desligado). */
export function useAssociation(meetingId: string): MeetingAssociation | null {
  return useAssociations()[meetingId] ?? null;
}
