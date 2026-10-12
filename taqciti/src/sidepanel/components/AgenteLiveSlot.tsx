/**
 * O espaço do vínculo no topo do corpo ao vivo do painel (Fase 8, TAQ-02, D-06, D-07, D-08, D-12, D-18):
 * conduz a pessoa do aviso até o vínculo — cartão "Esta reunião é de qual cliente?" -> seletor -> barra
 * "Enviando ao vivo para {cliente}".
 *
 * Contêiner: junta o estado (hooks `useMeetingAssociation` / `useClientDirectory`, que só leem
 * `storage.local` e só mandam comandos) com as peças apresentacionais do 08-02/03/04. O `PanelApp`
 * só o posiciona. Estado local = só apresentação (qual passo está à vista, "ocupado", erro do seletor).
 *
 * Regras que moram aqui:
 *   - fechar sem escolher é "Depois" em TODAS as formas, inclusive minimizar o painel com o cartão
 *     aberto (UI-SPEC decisão d) — `expanded` true -> false com `choosing` manda `defer`;
 *   - a cápsula só abre o painel: ao ver `expanded` false -> true com `pending`, manda `open` e o
 *     cartão já aparece (a bolha da cápsula é decorativa);
 *   - abrir o seletor num painel compacto (320 px) sobe o painel para regular (564 px), uma vez;
 *   - um vínculo por vez: o comando pendente trava novos cliques (inclusive dois no mesmo instante).
 */
import { useEffect, useRef, useState } from 'react';
import { toBindingBarView, recoveredToastDue } from '@/features/agente/bindingView';
import { useClientDirectory } from '@/shared/hooks/useClientDirectory';
import { useMeetingAssociation } from '@/shared/hooks/useMeetingAssociation';
import type { AgenteBindTarget, AgenteCommandError } from '@/shared/types/agenteMessages';
import type { PanelSize } from '@/shared/types/domain';
import { AgenteBindingBar } from './AgenteBindingBar';
import { AgenteDecisionCard } from './AgenteDecisionCard';
import { ClientPicker, type ClientPickerError } from './ClientPicker';

const RECOVERED_TOAST = 'Agente de volta. Falas reenviadas.';

interface AgenteLiveSlotProps {
  meetingId: string;
  /** O painel está aberto (não minimizado). */
  expanded: boolean;
  panelSize: PanelSize;
  onPanelSizeChange: (size: PanelSize) => void;
  onToast: (message: string) => void;
}

/** Erro do comando -> cópia do seletor. Falha sem causa clara cai no texto da etapa que estava rodando. */
function toPickerError(error: AgenteCommandError, target: AgenteBindTarget): ClientPickerError {
  if (error === 'duplicate' || error === 'create-client' || error === 'create-session') return error;
  return target.kind === 'new-client' ? 'create-client' : 'create-session';
}

export function AgenteLiveSlot({
  meetingId,
  expanded,
  panelSize,
  onPanelSizeChange,
  onToast,
}: AgenteLiveSlotProps) {
  const { association, delivery, open, defer, bind } = useMeetingAssociation(meetingId);
  const [view, setView] = useState<'card' | 'picker'>('card');
  const [busy, setBusy] = useState(false);
  const [pickerError, setPickerError] = useState<ClientPickerError | null>(null);
  const busyRef = useRef(false);
  const directory = useClientDirectory(view === 'picker');

  const state = association?.state;
  const choosingOrDeferred = state === 'choosing' || state === 'deferred';
  const pickerOpen = view === 'picker' && choosingOrDeferred;

  // O vínculo andou (linking, linked...): o seletor já cumpriu o papel; um novo `deferred` volta ao cartão/barra.
  useEffect(() => {
    if (!choosingOrDeferred) setView('card');
  }, [choosingOrDeferred]);

  // Minimizar com o cartão aberto = "Depois"; a cápsula só abre o painel e o cartão já aparece.
  const previousExpanded = useRef(expanded);
  useEffect(() => {
    const wasExpanded = previousExpanded.current;
    previousExpanded.current = expanded;
    if (wasExpanded === expanded) return;
    if (wasExpanded && state === 'choosing') {
      setView('card');
      void defer();
    } else if (!wasExpanded && state === 'pending') {
      void open();
    }
  }, [expanded, state, defer, open]);

  // O Agente voltou depois de uma queda: um toast de 2,2 s (do próprio painel), uma vez.
  const previousDelivery = useRef(delivery);
  useEffect(() => {
    if (recoveredToastDue(previousDelivery.current, delivery)) onToast(RECOVERED_TOAST);
    previousDelivery.current = delivery;
  }, [delivery, onToast]);

  const showPicker = (): void => {
    setPickerError(null);
    setView('picker');
    if (panelSize === 'compact') onPanelSizeChange('regular');
  };

  const handleDefer = (): void => {
    setView('card');
    void defer();
  };

  const handleSelectFromBar = (): void => {
    void open();
    showPicker();
  };

  const handleBind = async (target: AgenteBindTarget): Promise<void> => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setPickerError(null);
    const result = await bind(target);
    busyRef.current = false;
    setBusy(false);
    if (!result.ok) setPickerError(toPickerError(result.error, target));
  };

  if (association === null) return null;

  if (pickerOpen) {
    return (
      <div className="mb-2 flex min-h-0 flex-[2] flex-col">
        <ClientPicker
          status={directory.status}
          clients={directory.clients}
          mode="live"
          busy={busy}
          error={pickerError}
          onConfirm={(client) => void handleBind({ kind: 'client', clientId: client.id, clientName: client.client })}
          onCreate={(name) => void handleBind({ kind: 'new-client', name })}
          onManualId={(sessionId) => void handleBind({ kind: 'manual', sessionId })}
          onRetry={directory.retry}
          onBack={handleDefer}
        />
      </div>
    );
  }

  if (state === 'choosing') {
    return (
      <div className="mb-2 shrink-0">
        <AgenteDecisionCard onSelect={showPicker} onDefer={handleDefer} />
      </div>
    );
  }

  const barView = toBindingBarView(association, delivery, true);
  if (barView === null) return null;
  return (
    <div className="mb-2 shrink-0">
      <AgenteBindingBar view={barView} onSelectClient={handleSelectFromBar} />
    </div>
  );
}
