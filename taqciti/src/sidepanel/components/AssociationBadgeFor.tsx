/**
 * O selo de associação de uma reunião do histórico, a partir do id dela (Fase 8, TAQ-02, UI-SPEC §6).
 *
 * Lê a associação do mapa compartilhado (`useAssociations`: uma única assinatura para todos os cartões)
 * e a traduz com `toBadgeState`. Sem associação (reunião antiga ou envio desligado) não desenha nada —
 * nunca inventa "Sem cliente" para o passado.
 */
import { toBadgeState } from '@/features/agente/bindingView';
import { useAssociation } from '@/shared/hooks/useAssociations';
import { AssociationBadge } from './AssociationBadge';

interface AssociationBadgeForProps {
  recordId: string;
  /** A reunião ainda está acontecendo (status `recording`). */
  live: boolean;
}

export function AssociationBadgeFor({ recordId, live }: AssociationBadgeForProps) {
  const state = toBadgeState(useAssociation(recordId), live);
  return state === null ? null : <AssociationBadge state={state} />;
}
