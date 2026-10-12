/**
 * Tradução PURA do vínculo da reunião para o que as telas desenham (Fase 8, TAQ-02, D-12/D-18,
 * UI-SPEC §4/§5/§6). Recebe a associação (escrita pelo service worker) e o status de entrega e devolve
 * os "modelos de visão" dos componentes apresentacionais do 08-02 e do 08-04 — que não conhecem o
 * domínio. Sem React, sem `chrome`, sem relógio: um teste de tabela cobre tudo.
 *
 * `isLive` diz se a reunião ainda está acontecendo. Uma sala retomada (08-22) pode mostrar por um
 * instante `ended-unsent`, `sending` ou `sent` COM a reunião ao vivo; nenhum desses fica sem tela.
 */
import type { AgenteDelivery } from '@/shared/config/agenteDeliveryStore';
import { rejectionText } from '@/shared/config/agenteStatus';
import type { AssociationBadgeState } from '@/sidepanel/components/AssociationBadge';
import type { BindingBarView } from '@/sidepanel/components/AgenteBindingBar';
import type { EndPromptView } from '@/sidepanel/components/AgenteEndPrompt';
import type { MeetingAssociation } from './association';

/** Quando o vínculo não guardou o nome (não deveria acontecer), a barra ainda diz algo verdadeiro. */
const FALLBACK_CLIENT = 'a sessão escolhida';

function progressOf(association: MeetingAssociation): { done: number; total: number } {
  return association.sendProgress ?? { done: 0, total: 0 };
}

/** Vínculo de pé: a barra segue o estado da entrega (ok / fora do ar / recusa). */
function linkedBarView(association: MeetingAssociation, delivery: AgenteDelivery): BindingBarView {
  const clientName = association.clientName ?? FALLBACK_CLIENT;
  if (delivery.status === 'offline') return { kind: 'offline', clientName, queued: delivery.queued };
  if (delivery.status === 'rejected') return { kind: 'rejected', text: rejectionText(delivery.httpStatus) };
  // `failed` (reenvio ainda desligado, B3) não muda a barra: o detalhe fica na tela "Agente Diagnóstico".
  return { kind: 'linked', clientName };
}

/** A barra de vínculo acima da transcrição; `null` = nada a mostrar (a bolha ou o cartão cuidam disso). */
export function toBindingBarView(
  association: MeetingAssociation | null,
  delivery: AgenteDelivery,
  isLive: boolean,
): BindingBarView | null {
  if (association === null || !isLive) return null;
  switch (association.state) {
    case 'pending':
    case 'choosing':
      return null;
    case 'deferred':
    case 'ended-unsent':
      return { kind: 'deferred' };
    case 'linking':
    case 'sending':
      return { kind: 'linking', ...progressOf(association) };
    case 'linked':
    case 'sent':
      return linkedBarView(association, delivery);
    case 'send-failed':
      return { kind: 'stopped', ...progressOf(association) };
  }
}

/** O cartão da reunião encerrada; `null` = não há o que perguntar ou mostrar. */
export function toEndPromptView(
  association: MeetingAssociation | null,
  isLive: boolean,
): EndPromptView | null {
  if (association === null || isLive) return null;
  const clientName = association.clientName ?? FALLBACK_CLIENT;
  switch (association.state) {
    case 'ended-unsent':
      return { kind: 'ask' };
    case 'linking': // o vínculo ao vivo ainda termina de enviar depois do fim da reunião
    case 'sending':
      return { kind: 'sending', clientName, ...progressOf(association) };
    case 'sent':
      return { kind: 'sent', clientName };
    case 'send-failed':
      // A Taqciti já encerrou a sessão (B4-b, DA-2): o cartão avisa que o relatório precisa ser gerado de novo.
      return {
        kind: 'failed',
        ...progressOf(association),
        ...(association.sessionFinished === true && { sessionClosed: true }),
      };
    case 'linked':
      return { kind: 'linked-note', clientName };
    default:
      return null;
  }
}

/** O selo do histórico/painel; `null` = sem associação (reunião antiga ou envio desligado): sem selo. */
export function toBadgeState(
  association: MeetingAssociation | null,
  isLive: boolean,
): AssociationBadgeState | null {
  if (association === null) return null;
  switch (association.state) {
    case 'pending':
    case 'choosing':
    case 'deferred':
    case 'ended-unsent':
      return 'no-client';
    case 'linking':
    case 'sending':
      return 'sending';
    case 'linked':
      return isLive ? 'sending' : 'sent';
    case 'sent':
      return 'sent';
    case 'send-failed':
      return 'stopped';
  }
}

/** A bolha "!" só pula enquanto a pessoa ainda não abriu o aviso. */
export function shouldBounce(association: MeetingAssociation | null): boolean {
  return association?.state === 'pending';
}

/** O Agente voltou depois de uma queda: é a hora do toast "Agente de volta. Falas reenviadas.". */
export function recoveredToastDue(prev: AgenteDelivery | null, next: AgenteDelivery): boolean {
  return prev?.status === 'offline' && next.status === 'ok' && next.recoveredAt !== null;
}
