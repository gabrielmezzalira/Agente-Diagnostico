/**
 * Cartão "Esta reunião é de qual cliente?" (D-06, D-07, UI-SPEC §2).
 *
 * Aparece no topo do corpo do painel, acima da transcrição (que continua
 * rolando por baixo — não é modal). Fechar sem escolher significa "Depois":
 * vale para o botão, para o × e para o Esc com o foco dentro do cartão.
 *
 * O painel ouve Esc em `document` e recolhe a janela. Por isso o Esc DENTRO do
 * cartão para a propagação (Pitfall 11): fecha o cartão primeiro; só um segundo
 * Esc, já fora dele, minimiza o painel.
 *
 * Apresentacional puro: sem chamada de API, sem hook de dados e sem foco
 * automático — o aviso nunca rouba o foco de quem está digitando no Meet.
 */
import type { KeyboardEvent } from 'react';
import { Button } from '../../shared/ui/Button';
import { Icon } from '../../shared/ui/Icon';
import { Surface } from '../../shared/ui/Surface';

const TITLE = 'Esta reunião é de qual cliente?';
const BODY =
  'Enquanto você não escolher, a Taqciti só guarda a transcrição neste navegador. Nada vai para o Agente.';

interface AgenteDecisionCardProps {
  /** "Selecionar cliente agora" — leva ao picker. */
  onSelect: () => void;
  /** "Depois", × e Esc: a pessoa fechou sem escolher. */
  onDefer: () => void;
}

export function AgenteDecisionCard({ onSelect, onDefer }: AgenteDecisionCardProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    onDefer();
  };

  return (
    <Surface
      level="card"
      role="region"
      aria-label={TITLE}
      onKeyDown={handleKeyDown}
      className="relative p-4"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h2 className="text-title font-semibold">{TITLE}</h2>
        <Button
          variant="ghost"
          size="compact"
          aria-label="Fechar aviso"
          onClick={onDefer}
          className="!min-h-0 h-7 w-7 shrink-0 !p-0"
        >
          <Icon name="close" size={14} />
        </Button>
      </div>
      <p className="mb-4 text-read text-muted">{BODY}</p>
      <div className="flex gap-2">
        <Button variant="primary" onClick={onSelect} className="flex-1">
          Selecionar cliente agora
        </Button>
        <Button variant="ghost" onClick={onDefer} className="shrink-0">
          Depois
        </Button>
      </div>
    </Surface>
  );
}
