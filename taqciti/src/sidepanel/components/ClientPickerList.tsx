/**
 * A lista do seletor de clientes (D-08, UI-SPEC §3): contador, linhas selecionáveis e os estados
 * carregando / vazio / busca sem resultado. Recebe os clientes JÁ filtrados e ordenados — não
 * busca nem filtra nada (CLAUDE.md: componentes sem chamada de API, sem lógica de negócio em JSX).
 *
 * Todo nome de cliente entra como filho JSX (texto) e como atributo `title` — nunca como HTML.
 */
import type { RefObject } from 'react';
import type { ClientSummary } from '@/features/agente/clientDirectory';
import { clientHint, countLabel } from '@/features/agente/clientSearch';
import { Button } from '@/shared/ui/Button';
import { OptionCard } from '@/shared/ui/OptionCard';

const SKELETON_ROWS = 4;

interface ClientPickerListProps {
  status: 'loading' | 'ready';
  /** Os clientes que passam pela busca, já na ordem de exibição. */
  clients: readonly ClientSummary[];
  /** O que a pessoa digitou na busca (sem tratamento). */
  query: string;
  selectedId: string | null;
  busy: boolean;
  listRef: RefObject<HTMLUListElement>;
  onToggle: (client: ClientSummary) => void;
  /** "Criar cliente “{busca}”": abre o formulário já preenchido com o termo. */
  onCreateFromQuery: (name: string) => void;
}

function LoadingRows() {
  return (
    <>
      <p aria-live="polite" className="mb-2 text-caption text-muted">
        Carregando clientes…
      </p>
      <ul aria-hidden="true" className="space-y-2">
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <li
            key={index}
            data-skeleton-row
            className="glass-subtle h-14 animate-typing rounded-panel"
          />
        ))}
      </ul>
    </>
  );
}

function EmptyState({ query, onCreateFromQuery }: Pick<ClientPickerListProps, 'query' | 'onCreateFromQuery'>) {
  const term = query.trim();
  if (term === '') {
    return (
      <div className="px-2 py-6 text-center">
        <p className="text-read font-semibold">Nenhum cliente cadastrado ainda.</p>
        <p className="mt-1 text-caption text-muted">Crie o primeiro para vincular esta reunião.</p>
      </div>
    );
  }
  return (
    <div className="px-2 py-6 text-center">
      <p className="mb-3 break-words text-read font-semibold">{`Nenhum cliente com “${term}”.`}</p>
      <Button variant="secondary" size="compact" onClick={() => onCreateFromQuery(term)}>
        {`Criar cliente “${term}”`}
      </Button>
    </div>
  );
}

export function ClientPickerList({
  status,
  clients,
  query,
  selectedId,
  busy,
  listRef,
  onToggle,
  onCreateFromQuery,
}: ClientPickerListProps) {
  if (status === 'loading') {
    return (
      <div className="scroll-region min-h-0 flex-1">
        <LoadingRows />
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="scroll-region min-h-0 flex-1">
        <EmptyState query={query} onCreateFromQuery={onCreateFromQuery} />
      </div>
    );
  }

  return (
    <div className="scroll-region min-h-0 flex-1">
      <p className="mb-2 text-caption font-semibold uppercase tracking-wide tabular-nums text-muted">
        {countLabel(clients.length, query.trim() !== '')}
      </p>
      <ul
        ref={listRef}
        aria-label="Clientes"
        aria-busy={busy}
        tabIndex={0}
        className={`space-y-2 ${busy ? 'pointer-events-none opacity-70' : ''}`}
      >
        {clients.map((item) => (
          <li key={item.id} title={item.client}>
            <OptionCard
              role="single"
              label={item.client}
              hint={clientHint(item)}
              selected={item.id === selectedId}
              onClick={() => onToggle(item)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
