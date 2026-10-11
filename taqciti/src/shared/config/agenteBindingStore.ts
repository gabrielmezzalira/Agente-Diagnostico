/**
 * O vínculo "sessão do Agente → última reunião enviada" (Fase 7, CR-01 e WR-01).
 *
 * Mora em `chrome.storage.local` — sobrevive ao fechamento do navegador, ao contrário do cursor
 * (`storage.session`) — para o streamer reconhecer uma reunião diferente mesmo sem cursor. Só os
 * ids (sessão e reunião), nunca texto.
 *
 * Chave PRÓPRIA, fora de `taq:agenteConfig`, e com um único escritor (o service worker, por
 * escrita direta, sem ler antes). Quando o vínculo ficava dentro da config, a tela e o service
 * worker faziam read-modify-write do mesmo objeto sem coordenação e uma gravação apagava a outra.
 * Aqui não há o que apagar: a tela nunca grava esta chave, e gravá-la não mexe na config (nem
 * dispara o `onChanged` dela).
 *
 * O vínculo só vale para a sessão com que foi gravado: trocar o `agenteSessionId` deixa de casar,
 * sem precisar zerar nada.
 */
import { readLocal, writeLocal } from '@/shared/services/storage';
import { STORAGE_KEYS } from './constants';

export interface AgenteBinding {
  sessionId: string;
  meetingId: string;
}

/** Valor salvo -> vínculo válido; ausente, malformado ou vazio vira `null` (sem vínculo). */
export function normalizeAgenteBinding(raw: unknown): AgenteBinding | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { sessionId, meetingId } = raw as Partial<AgenteBinding>;
  if (typeof sessionId !== 'string' || typeof meetingId !== 'string') return null;
  if (sessionId.length === 0 || meetingId.length === 0) return null;
  return { sessionId, meetingId };
}

export async function loadAgenteBinding(): Promise<AgenteBinding | null> {
  return normalizeAgenteBinding(await readLocal<unknown>(STORAGE_KEYS.agenteBinding));
}

/** Escrita direta do valor inteiro — sem leitura antes, então nada de ninguém pode ser desfeito. */
export function writeAgenteBinding(sessionId: string, meetingId: string): Promise<void> {
  return writeLocal(STORAGE_KEYS.agenteBinding, { sessionId, meetingId });
}

/** A reunião vinculada À SESSÃO ATUAL; vazio = nenhuma (inclusive quando o vínculo é de outra sessão). */
export function boundMeetingFor(binding: AgenteBinding | null, sessionId: string): string {
  return binding !== null && binding.sessionId === sessionId ? binding.meetingId : '';
}
