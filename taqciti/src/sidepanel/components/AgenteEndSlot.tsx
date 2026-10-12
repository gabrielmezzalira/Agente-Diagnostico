/**
 * O espaço do Agente no fim da reunião e no histórico (Fase 8, TAQ-02, D-09, D-10, D-11, UI-SPEC §5):
 * conduz a pessoa de "Enviar esta reunião ao Agente?" até o envio em partes ou o descarte confirmado.
 *
 * Contêiner: junta o estado (`useMeetingAssociation` / `useClientDirectory`, que só leem `storage.local`
 * e só mandam comandos) com as peças apresentacionais do 08-02/03/04. Estado local = só apresentação
 * (seletor aberto, modal de descarte, "ocupado", erro do seletor).
 *
 * Regras que moram aqui:
 *   - `variant="card"` é a tela "Transcrição salva" (cartão); `variant="button"` é o histórico
 *     (botão "Enviar ao Agente"). Nos dois, só `ended-unsent` pergunta; `send-failed` mostra a falha e
 *     nunca oferece reenviar do zero (duplicaria as partes que já chegaram — B3, plano 08-20);
 *   - descartar só acontece no botão de confirmar do modal; Esc, fundo e "Manter reunião" não mandam nada;
 *   - um comando por vez: o `busyRef` trava o segundo clique no mesmo instante;
 *   - na saída larga o seletor ocupa a tela inteira dentro do `AppShell`; no painel, ele entra no lugar.
 */
import { useEffect, useRef, useState } from 'react';
import { toEndPromptView } from '@/features/agente/bindingView';
import { useClientDirectory } from '@/shared/hooks/useClientDirectory';
import { useMeetingAssociation } from '@/shared/hooks/useMeetingAssociation';
import type { AgenteBindTarget, AgenteCommandError } from '@/shared/types/agenteMessages';
import { AppShell } from '@/shared/ui/AppShell';
import { Button } from '@/shared/ui/Button';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';
import { AgenteEndPrompt, type EndPromptView } from './AgenteEndPrompt';
import { ClientPicker, type ClientPickerError } from './ClientPicker';

interface AgenteEndSlotProps {
  meetingId: string;
  /** Título da reunião, mostrado no modal de descarte. */
  title: string;
  variant: 'card' | 'button';
  surface: 'panel' | 'wide';
  /** A reunião deixou de existir (descartada): quem hospeda a tela volta para a lista. */
  onDiscarded?: () => void;
}

/** Erro do comando -> cópia do seletor. Falha sem causa clara cai no texto da etapa que estava rodando. */
function toPickerError(error: AgenteCommandError, target: AgenteBindTarget): ClientPickerError {
  if (error === 'duplicate' || error === 'create-client' || error === 'create-session') return error;
  return target.kind === 'new-client' ? 'create-client' : 'create-session';
}

/** No histórico, "enviada" é uma linha de apoio (o selo já diz o resto); o resto usa o cartão inteiro. */
function viewForVariant(view: EndPromptView, variant: 'card' | 'button'): EndPromptView {
  return variant === 'button' && view.kind === 'sent'
    ? { kind: 'linked-note', clientName: view.clientName }
    : view;
}

export function AgenteEndSlot({ meetingId, title, variant, surface, onDiscarded }: AgenteEndSlotProps) {
  const { association, bind, discard } = useMeetingAssociation(meetingId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pickerError, setPickerError] = useState<ClientPickerError | null>(null);
  const busyRef = useRef(false);

  const view = toEndPromptView(association, false);
  const asking = view?.kind === 'ask';
  const directory = useClientDirectory(pickerOpen && asking);

  // O envio andou (sending, sent...): o seletor já cumpriu o papel.
  useEffect(() => {
    if (!asking) setPickerOpen(false);
  }, [asking]);

  const openPicker = (): void => {
    setPickerError(null);
    setPickerOpen(true);
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

  const handleDiscard = async (): Promise<void> => {
    setConfirmDiscard(false);
    if (busyRef.current) return;
    busyRef.current = true;
    const result = await discard();
    busyRef.current = false;
    if (result.ok) onDiscarded?.();
  };

  if (view === null) return null;

  if (asking && pickerOpen) {
    const picker = (
      <ClientPicker
        status={directory.status}
        clients={directory.clients}
        mode="ended"
        busy={busy}
        error={pickerError}
        onConfirm={(client) => void handleBind({ kind: 'client', clientId: client.id, clientName: client.client })}
        onCreate={(name) => void handleBind({ kind: 'new-client', name })}
        onManualId={(sessionId) => void handleBind({ kind: 'manual', sessionId })}
        onRetry={directory.retry}
        onBack={() => setPickerOpen(false)}
      />
    );
    return surface === 'wide' ? (
      <div className="fixed inset-0 z-40 bg-background">
        <AppShell>
          <div className="flex min-h-0 flex-1 flex-col p-4">{picker}</div>
        </AppShell>
      </div>
    ) : (
      <div className="mb-2 flex min-h-0 flex-[2] flex-col">{picker}</div>
    );
  }

  return (
    <div className={variant === 'card' ? 'mb-2 shrink-0' : 'shrink-0'}>
      {asking && variant === 'button' ? (
        <Button variant="secondary" size="compact" className="w-full" onClick={openPicker}>
          Enviar ao Agente
        </Button>
      ) : (
        <AgenteEndPrompt
          view={viewForVariant(view, variant)}
          onSelectClient={openPicker}
          onDiscard={() => setConfirmDiscard(true)}
        />
      )}
      <ConfirmModal
        open={confirmDiscard}
        title="Descartar esta reunião?"
        description={`“${title}” será removida do histórico da Taqciti, com a transcrição. Nada foi enviado ao Agente, então não há como recuperar.`}
        confirmLabel="Descartar"
        cancelLabel="Manter reunião"
        danger
        onConfirm={() => void handleDiscard()}
        onCancel={() => setConfirmDiscard(false)}
      />
    </div>
  );
}
