interface StepListProps {
  steps: readonly string[]
}

/** Lista numerada de passos: bolha verde com o número + texto. */
export default function StepList({ steps }: StepListProps) {
  return (
    <ol className="m-0 p-0 list-none flex flex-col gap-4">
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-4">
          <span
            aria-hidden
            className="w-7 h-7 shrink-0 rounded-full bg-ds-green-soft border border-ds-green-line text-ds-green font-mono text-[12px] font-semibold flex items-center justify-center"
          >
            {i + 1}
          </span>
          <span className="text-[14.5px] leading-[1.6] text-ds-text-2 pt-[3px]">{step}</span>
        </li>
      ))}
    </ol>
  )
}
