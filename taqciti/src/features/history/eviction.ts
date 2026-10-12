/**
 * Evicção do histórico de reuniões (Fase 8, D-04, Pitfall 4) — regra pura, sem `chrome`.
 *
 * No modelo B uma reunião que ainda não foi para o Agente só existe neste navegador: jogá-la fora
 * para respeitar o teto seria perdê-la para sempre. Por isso a evicção só remove reunião já enviada
 * (`linked`/`sent`) ou sem associação; as não enviadas ficam, mesmo que o histórico passe do teto
 * ("teto suave"). Enviar uma reunião libera espaço na gravação seguinte.
 */
import type { AssociationState } from '@/features/agente/association';

/** Estados em que a transcrição ainda não chegou ao Agente — a cópia local é a única. */
export const UNSENT_STATES: readonly AssociationState[] = [
  'pending',
  'choosing',
  'deferred',
  'linking',
  'ended-unsent',
  'sending',
  'send-failed',
];

export interface EvictionResult<T> {
  kept: T[];
  /** Ids removidos — quem chama limpa também a associação deles. */
  evicted: string[];
}

/**
 * `records` já vem ordenado do mais recente para o mais antigo. Mantém TODOS os protegidos e completa
 * até `max` com os não protegidos mais novos; a ordem de entrada é preservada.
 */
export function selectRecordsToKeep<T extends { id: string }>(
  records: readonly T[],
  max: number,
  isProtected: (id: string) => boolean,
): EvictionResult<T> {
  const protectedCount = records.filter((record) => isProtected(record.id)).length;
  let freeSlots = Math.max(0, max - protectedCount);

  const kept: T[] = [];
  const evicted: string[] = [];
  for (const record of records) {
    if (isProtected(record.id)) {
      kept.push(record);
    } else if (freeSlots > 0) {
      kept.push(record);
      freeSlots -= 1;
    } else {
      evicted.push(record.id);
    }
  }
  return { kept, evicted };
}
