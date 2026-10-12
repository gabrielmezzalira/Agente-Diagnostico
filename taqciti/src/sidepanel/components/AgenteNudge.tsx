/**
 * A bolha "!" do aviso de reunião detectada (D-07, UI-SPEC §1): um círculo
 * amarelo de aviso que dá um pulinho a cada 5 s, sem som, sem notificação do
 * sistema e sem tirar o foco de ninguém — nunca interrompe a reunião.
 *
 * É UM componente com DUAS ancoragens, para o painel não precisar de dois:
 *   - `header`: botão clicável (alvo de 32 px) no cabeçalho do painel aberto;
 *   - `capsule`: enfeite no canto da cápsula minimizada. Não captura clique nem
 *     ponteiro — o clique é da cápsula inteira, o que evita depender de a bolha
 *     atravessar a captura de arraste da cápsula.
 *
 * Apresentacional puro: quem compõe (o painel) decide quando `bouncing` é
 * verdadeiro. O componente só anima enquanto for — e nunca conhece o estado
 * da associação reunião -> cliente.
 */
import { Icon } from '../../shared/ui/Icon';

const NAME = 'Reunião detectada. Escolher o cliente no Agente.';

/** Círculo de 20 px na cor de aviso (warning #F2C94C), glifo escuro por cima. */
const BUBBLE =
  'flex h-5 w-5 items-center justify-center rounded-full bg-[#F2C94C] text-background';

interface AgenteNudgeProps {
  anchor: 'capsule' | 'header';
  /** Só anima enquanto verdadeiro; falso mantém a bolha visível e parada. */
  bouncing: boolean;
  /** Usado só na ancoragem `header`; na cápsula o clique é da própria cápsula. */
  onActivate?: () => void;
}

export function AgenteNudge({ anchor, bouncing, onActivate }: AgenteNudgeProps) {
  const motion = bouncing ? 'animate-nudge' : '';

  if (anchor === 'capsule') {
    return (
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -right-1 -top-1 ${BUBBLE} ${motion}`}
      >
        <Icon name="alert" size={12} />
      </span>
    );
  }

  /* A animação roda no círculo, não no botão: o alvo de clique fica parado. */
  return (
    <button
      type="button"
      aria-label={NAME}
      title={NAME}
      onClick={onActivate}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/70"
    >
      <span className={`${BUBBLE} ${motion}`}>
        <Icon name="alert" size={12} />
      </span>
    </button>
  );
}
