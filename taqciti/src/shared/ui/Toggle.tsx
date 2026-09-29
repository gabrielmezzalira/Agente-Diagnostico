/**
 * Liga/desliga do design system — um switch no mesmo vocabulário do Button e
 * do OptionCard: trilho de vidro quando desligado, verde da marca (translúcido,
 * com fio de 1px) quando ligado, e o mesmo anel de foco do Button.
 *
 * É um <button role="switch">: Espaço e Enter já ativam de fábrica, sem
 * handler de tecla próprio (que dispararia duas vezes). O rótulo fica DENTRO do
 * botão — assim clicar no texto também alterna e ele vira o nome acessível.
 */
interface ToggleProps {
  checked: boolean;
  /** Recebe o valor novo (o oposto do atual). */
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}

const BASE =
  'group inline-flex select-none items-center gap-3 rounded-full text-left text-read text-foreground ' +
  'disabled:opacity-45 disabled:grayscale disabled:pointer-events-none ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/70';

const TRACK_BASE =
  'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ease-flow';

const TRACK_STATE = {
  on: 'bg-primary/85 shadow-[inset_0_0_0_1px_rgb(var(--c-primary)/0.38)]',
  off: 'glass-subtle group-hover:bg-white/[0.075]',
};

const THUMB_BASE =
  'absolute left-0.5 top-0.5 h-5 w-5 rounded-full transition-transform duration-200 ease-flow';

const THUMB_STATE = {
  on: 'translate-x-5 bg-primary-deep',
  off: 'translate-x-0 bg-white/70',
};

export function Toggle({ checked, onChange, label, disabled = false }: ToggleProps) {
  const state = checked ? 'on' : 'off';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={BASE}
    >
      <span aria-hidden="true" className={`${TRACK_BASE} ${TRACK_STATE[state]}`}>
        <span className={`${THUMB_BASE} ${THUMB_STATE[state]}`} />
      </span>
      <span>{label}</span>
    </button>
  );
}
