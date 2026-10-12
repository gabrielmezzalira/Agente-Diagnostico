/**
 * Barra de vínculo ao vivo (D-12, D-18, UI-SPEC §4): uma faixa de uma linha
 * acima da transcrição que diz, sem ambiguidade, para onde a reunião está indo.
 *
 * Apresentacional puro (CLAUDE.md: sem chamada de API, sem hook de dados). Ela
 * recebe um "modelo de visão" já pronto — `BindingBarView` — e não conhece os
 * tipos do domínio; a tradução domínio -> visão fica no hook de fiação (08-14).
 *
 * Regras de cor do contrato:
 *   - saudável  -> accent (`text-glow`), só no estado `linked`;
 *   - parada    -> warning (mesmo literal do aviso de captura do `PanelApp`),
 *                  nunca danger: nada foi perdido, a transcrição segue guardada.
 *
 * O nome do cliente vem de fora e é desenhado como texto JSX (React escapa),
 * com `title` como atributo — nunca como HTML (T-08-07).
 */
import type { ReactNode } from 'react';
import { Button } from '../../shared/ui/Button';
import { ProgressRail } from '../../shared/ui/ProgressRail';
import { Surface } from '../../shared/ui/Surface';

export type BindingBarView =
  | { kind: 'deferred' }
  | { kind: 'linking'; done: number; total: number }
  | { kind: 'linked'; clientName: string }
  | { kind: 'offline'; clientName: string; queued: number }
  | { kind: 'rejected'; text: string }
  | { kind: 'stopped'; done: number; total: number };

interface AgenteBindingBarProps {
  view: BindingBarView;
  /** Ação do estado `deferred`: reabre a escolha de cliente. */
  onSelectClient?: (() => void) | undefined;
}

/* Uma linha, no mínimo 40px: o texto longo cresce em altura, nunca empurra o botão. */
const ROW = 'flex min-h-[40px] items-center gap-3 px-3 py-2 text-caption';

/* Mesmo literal do aviso de captura (PanelApp): warning, sem token novo. */
const WARNING =
  'rounded-control border border-[#f2c94c]/25 bg-[#f2c94c]/10 text-[#f7dd8f] leading-relaxed';

function queueLabel(queued: number): string {
  return `${queued} ${queued === 1 ? 'fala' : 'falas'} na fila`;
}

function stoppedText(done: number, total: number): string {
  return `O envio parou na parte ${done} de ${total}. O que já chegou continua no Agente.`;
}

/** Aviso warning: `role="status"` + `aria-live="polite"` (informa sem interromper). */
function WarningRow({
  children,
  title,
}: {
  children: ReactNode;
  title?: string | undefined;
}) {
  return (
    <div role="status" aria-live="polite" title={title} className={`${ROW} ${WARNING}`}>
      {children}
    </div>
  );
}

export function AgenteBindingBar({ view, onSelectClient }: AgenteBindingBarProps) {
  switch (view.kind) {
    case 'deferred':
      return (
        <Surface level="item" className={`${ROW} text-muted`}>
          <span className="min-w-0 flex-1">Sem cliente. A transcrição fica só aqui.</span>
          <Button
            variant="ghost"
            size="compact"
            onClick={onSelectClient}
            className="shrink-0"
          >
            Selecionar cliente
          </Button>
        </Surface>
      );

    case 'linking':
      return (
        <Surface level="item" className={`${ROW} text-muted`}>
          <span className="shrink-0">Enviando o que já foi falado…</span>
          <div className="min-w-0 flex-1">
            <ProgressRail position={view.done} total={view.total} />
          </div>
        </Surface>
      );

    case 'linked':
      return (
        <Surface level="item" className={`${ROW} text-glow`}>
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
            aria-hidden="true"
          />
          <span className="shrink-0">Enviando ao vivo para</span>
          <span className="min-w-0 flex-1 truncate font-semibold" title={view.clientName}>
            {view.clientName}
          </span>
        </Surface>
      );

    case 'offline':
      return (
        <WarningRow title={view.clientName}>
          <span className="min-w-0 flex-1">
            O Agente está fora do ar. Guardando as falas aqui e reenviando quando ele
            voltar.
          </span>
          <span className="shrink-0 font-semibold tabular-nums">
            {queueLabel(view.queued)}
          </span>
        </WarningRow>
      );

    case 'rejected':
      return (
        <WarningRow>
          <span className="min-w-0 flex-1">{view.text}</span>
        </WarningRow>
      );

    case 'stopped':
      return (
        <WarningRow>
          <span className="min-w-0 flex-1">{stoppedText(view.done, view.total)}</span>
        </WarningRow>
      );
  }
}
