interface ChoiceOption<T extends string> {
  value: T
  label: string
  description?: string
}

interface ChoiceGroupProps<T extends string> {
  name: string
  value: T
  options: ChoiceOption<T>[]
  onChange: (value: T) => void
}

/** Escolha única em cartões clicáveis (rádio nativo por baixo, para teclado e leitor de tela). */
export default function ChoiceGroup<T extends string>({ name, value, options, onChange }: ChoiceGroupProps<T>) {
  return (
    <div role="radiogroup" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {options.map(opt => {
        const selected = opt.value === value
        return (
          <label
            key={opt.value}
            className={`flex flex-col gap-0.5 px-4 py-3 rounded-xl border cursor-pointer transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ds-green ${
              selected ? 'bg-ds-green-soft border-ds-green-line' : 'bg-ds-inner border-ds-inner-border hover:border-ds-green-line'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={selected}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            <span className={`text-[14px] font-semibold ${selected ? 'text-ds-green' : 'text-ds-text'}`}>{opt.label}</span>
            {opt.description && <span className="text-[12.5px] text-ds-muted">{opt.description}</span>}
          </label>
        )
      })}
    </div>
  )
}
