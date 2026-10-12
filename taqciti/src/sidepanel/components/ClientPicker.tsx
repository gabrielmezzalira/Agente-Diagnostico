/**
 * Seletor de clientes (D-08, UI-SPEC §3) — "Esta reunião é de qual cliente?" depois do "Selecionar
 * cliente agora". Apresentacional: recebe a lista pronta, o estado (`loading` | `ready` | `error`)
 * e callbacks; não busca dado nem chama API (CLAUDE.md). A origem dos clientes mora atrás da
 * interface `ClientDirectory` — quem compõe este componente a consulta e entrega o resultado.
 *
 * Seleção em DOIS passos, de propósito: clicar numa linha só a MARCA; quem vincula/envia é o botão
 * do rodapé. Um clique errado não cria sessão órfã no Agente.
 *
 * Estado local só de apresentação (texto da busca e linha marcada). O Esc volta um passo e nunca
 * chega ao `document` (o painel ouve Esc lá e minimizaria a janela junto).
 */
import { useMemo, useRef, useState } from 'react';
import type { ClientSummary } from '@/features/agente/clientDirectory';
import { filterClients, sortClients } from '@/features/agente/clientSearch';
import { Button } from '@/shared/ui/Button';
import { SearchField } from '@/shared/ui/Field';
import { Icon } from '@/shared/ui/Icon';
import { CLIENT_ERROR_COPY, ClientCreateForm } from './ClientCreateForm';
import { ClientPickerList } from './ClientPickerList';
import { ManualSessionIdForm } from './ManualSessionIdForm';
import { containEscape } from './containEscape';

/** O que deu errado na última ação (a mensagem de cada um mora no formulário/plano B). */
export type ClientPickerError = 'duplicate' | 'create-client' | 'create-session';

type PickerMode = 'live' | 'ended';

const SUBTITLE: Record<PickerMode, string> = {
  live: 'Tudo o que já foi falado vai junto para a sessão deste cliente.',
  ended: 'A transcrição guardada será enviada para a sessão deste cliente.',
};
const CONFIRM_LABEL: Record<PickerMode, string> = {
  live: 'Vincular reunião',
  ended: 'Enviar reunião',
};
const BUSY_LABEL: Record<PickerMode, string> = {
  live: 'Vinculando…',
  ended: 'Enviando…',
};
const LOAD_ERROR =
  'Não consegui carregar os clientes. Confira a conexão e tente de novo — ou cole abaixo o ID de uma sessão que já existe.';

interface ClientPickerProps {
  status: 'loading' | 'ready' | 'error';
  clients: readonly ClientSummary[];
  mode: PickerMode;
  busy: boolean;
  error: ClientPickerError | null;
  onConfirm: (client: ClientSummary) => void;
  onCreate: (name: string) => void;
  onManualId: (sessionId: string) => void;
  onRetry: () => void;
  onBack: () => void;
}

export function ClientPicker({
  status,
  clients,
  mode,
  busy,
  error,
  onConfirm,
  onCreate,
  onManualId,
  onRetry,
  onBack,
}: ClientPickerProps) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Texto que abre o formulário de cliente novo; `null` = a lista está à vista.
  const [createSeed, setCreateSeed] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const visible = useMemo(
    () => sortClients(filterClients(clients, query)),
    [clients, query],
  );
  // Só vale a seleção de uma linha que a pessoa está vendo: nada de CTA agindo sobre cliente oculto.
  const selected = visible.find((item) => item.id === selectedId) ?? null;
  const loading = status === 'loading';

  const toggle = (item: ClientSummary): void => {
    if (busy) return;
    setSelectedId((current) => (current === item.id ? null : item.id));
  };

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-3"
      onKeyDown={(event) => {
        containEscape(event, onBack);
      }}
    >
      {createSeed === null && (
        <header className="shrink-0">
          <Button variant="ghost" size="compact" onClick={onBack} className="-ml-2">
            <Icon name="chevron" size={14} className="rotate-90" />
            Voltar
          </Button>
          <h2 className="mt-2 text-title font-semibold text-foreground">
            Escolher cliente
          </h2>
          <p className="mt-1 text-caption text-muted">{SUBTITLE[mode]}</p>
        </header>
      )}

      {createSeed !== null ? (
        <ClientCreateForm
          mode={mode}
          initialName={createSeed}
          clients={clients}
          busy={busy}
          error={error}
          onSubmit={onCreate}
          onCancel={() => setCreateSeed(null)}
        />
      ) : status === 'error' ? (
        <div className="scroll-region min-h-0 flex-1">
          <p className="text-read text-muted">{LOAD_ERROR}</p>
          <Button variant="secondary" size="compact" onClick={onRetry} className="mt-3">
            Tentar de novo
          </Button>
          <ManualSessionIdForm mode={mode} busy={busy} onSubmit={onManualId} />
        </div>
      ) : (
        <>
          <SearchField
            autoFocus
            value={query}
            disabled={loading}
            placeholder="Buscar cliente"
            aria-label="Buscar cliente"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (containEscape(event, onBack)) return;
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                listRef.current?.querySelector('button')?.focus();
              }
            }}
          />
          <Button
            variant="secondary"
            size="compact"
            disabled={loading || busy}
            onClick={() => setCreateSeed('')}
            className="shrink-0 self-start"
          >
            <Icon name="plus" size={14} />
            Criar cliente novo
          </Button>
          <ClientPickerList
            status={loading ? 'loading' : 'ready'}
            clients={visible}
            query={query}
            selectedId={selected?.id ?? null}
            busy={busy}
            listRef={listRef}
            onToggle={toggle}
            onCreateFromQuery={setCreateSeed}
          />
          {error === 'create-session' && (
            <p aria-live="assertive" className="shrink-0 text-caption text-danger">
              {CLIENT_ERROR_COPY['create-session']}
            </p>
          )}
          <footer className="glass shrink-0 rounded-panel p-3">
            <Button
              variant="primary"
              disabled={selected === null || busy}
              onClick={() => selected && onConfirm(selected)}
              className="w-full"
            >
              {busy ? BUSY_LABEL[mode] : CONFIRM_LABEL[mode]}
            </Button>
          </footer>
        </>
      )}
    </div>
  );
}
