/**
 * Cartão de fim da reunião e envio em partes (D-09, D-10, D-11, UI-SPEC §5).
 *
 * Uma peça só, cinco aparências escolhidas por `EndPromptView`:
 *   ask          pergunta se a reunião vai para o Agente (Selecionar / Descartar)
 *   sending      "Enviando para {cliente}…" + trilho "{x} de {y}"
 *   sent         "Reunião enviada para {cliente}." com o check de sucesso
 *   failed       o envio parou no meio — aviso warning e linha de apoio
 *   linked-note  só uma linha de apoio "Enviada para {cliente}"
 *
 * Decisões do contrato que este arquivo respeita:
 *   - não há botão "Cancelar": o envio continua no service worker mesmo com o
 *     painel fechado (UI-SPEC decisão e);
 *   - não há botão "Continuar envio" nem "Enviar ao Agente" na falha: sem o
 *     identificador por trecho (decisão B3) uma nova tentativa duplicaria as
 *     partes que já chegaram. Entra no plano 08-20, se a B3 for aplicada;
 *   - a falha é warning, nunca danger: nada foi perdido, a transcrição segue
 *     guardada na Taqciti.
 *
 * Apresentacional puro: recebe o modelo de visão pronto, sem API e sem hook de
 * dados. O nome do cliente é texto JSX (React escapa) com `title` como
 * atributo — nunca HTML (T-08-07).
 */
import { Button } from '../../shared/ui/Button';
import { Icon } from '../../shared/ui/Icon';
import { ProgressRail } from '../../shared/ui/ProgressRail';
import { Surface } from '../../shared/ui/Surface';

export type EndPromptView =
  | { kind: 'ask' }
  | { kind: 'sending'; clientName: string; done: number; total: number }
  | { kind: 'sent'; clientName: string }
  | { kind: 'failed'; done: number; total: number }
  | { kind: 'linked-note'; clientName: string };

interface AgenteEndPromptProps {
  view: EndPromptView;
  /** "Selecionar cliente" do estado `ask`. */
  onSelectClient?: (() => void) | undefined;
  /** "Descartar" do estado `ask` (a confirmação é de quem recebe o callback). */
  onDiscard?: (() => void) | undefined;
}

/* Mesmo literal do aviso de captura (PanelApp): warning, sem token novo. */
const WARNING =
  'rounded-control border border-[#f2c94c]/25 bg-[#f2c94c]/10 px-3 py-2 text-caption leading-relaxed text-[#f7dd8f]';

/**
 * Uma linha "{prefixo} {cliente}{sufixo}" em que só o nome encolhe: o prefixo e
 * o sufixo ficam inteiros, o nome longo vira reticências com o texto completo
 * em `title` (o mesmo padrão da barra de vínculo).
 */
function ClientLine({
  prefix,
  name,
  suffix,
  className,
}: {
  prefix: string;
  name: string;
  suffix: string;
  className: string;
}) {
  return (
    <p className={`flex min-w-0 items-baseline ${className}`}>
      <span className="shrink-0 whitespace-pre">{`${prefix} `}</span>
      <span className="min-w-0 truncate font-semibold" title={name}>
        {name}
      </span>
      <span className="shrink-0">{suffix}</span>
    </p>
  );
}

export function AgenteEndPrompt({
  view,
  onSelectClient,
  onDiscard,
}: AgenteEndPromptProps) {
  switch (view.kind) {
    case 'ask':
      return (
        <Surface level="card" className="p-4">
          <h2 className="mb-2 text-title font-semibold">
            Enviar esta reunião ao Agente?
          </h2>
          <p className="mb-4 text-read text-muted">
            Ela está guardada só na Taqciti. Escolha o cliente ou descarte.
          </p>
          <div className="flex gap-2">
            <Button variant="primary" onClick={onSelectClient} className="flex-1">
              Selecionar cliente
            </Button>
            <Button
              variant="ghost"
              onClick={onDiscard}
              className="shrink-0 text-danger/80 hover:text-danger"
            >
              Descartar
            </Button>
          </div>
        </Surface>
      );

    case 'sending':
      return (
        <Surface level="card" className="p-4">
          <ClientLine
            prefix="Enviando para"
            name={view.clientName}
            suffix="…"
            className="mb-3 text-read"
          />
          <ProgressRail position={view.done} total={view.total} />
        </Surface>
      );

    case 'sent':
      return (
        <Surface level="card" className="flex items-center gap-3 p-4">
          <Icon name="check" size={18} className="shrink-0 text-primary" />
          <ClientLine
            prefix="Reunião enviada para"
            name={view.clientName}
            suffix="."
            className="min-w-0 flex-1 text-read"
          />
        </Surface>
      );

    case 'failed':
      return (
        <Surface level="card" className="p-4">
          <p role="status" aria-live="polite" className={WARNING}>
            {`O envio parou na parte ${view.done} de ${view.total}. O que já chegou continua no Agente.`}
          </p>
          <p className="mt-2 text-caption text-muted">
            A transcrição continua guardada na Taqciti. Você pode copiá-la ou baixá-la
            enquanto isso.
          </p>
        </Surface>
      );

    case 'linked-note':
      return (
        <ClientLine
          prefix="Enviada para"
          name={view.clientName}
          suffix=""
          className="text-caption text-muted"
        />
      );
  }
}
