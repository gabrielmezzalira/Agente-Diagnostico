import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

const CONTROL =
  'w-full rounded-[10px] bg-ds-inner border border-ds-inner-border text-ds-text text-[14px] px-3.5 ' +
  'placeholder:text-ds-dim hover:border-ds-green-line focus:border-ds-green focus:outline-none disabled:opacity-50'

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${CONTROL} h-[42px] ${className}`} {...rest} />
}

export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${CONTROL} py-3 leading-[1.6] resize-y ${className}`} {...rest} />
}

export function Select({ className = '', ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${CONTROL} h-[42px] ${className}`} {...rest} />
}

interface FieldProps {
  label: string
  htmlFor?: string
  hint?: ReactNode
  error?: string | null
  required?: boolean
  children: ReactNode
}

/** Rótulo + controle + dica/erro. O rótulo usa o estilo mono dos demais rótulos de seção. */
export function Field({ label, htmlFor, hint, error, required, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="ds-label">
        {label}
        {required && <span className="text-ds-green"> *</span>}
      </label>
      {children}
      {error ? (
        <span role="alert" className="text-[12.5px] text-ds-red">{error}</span>
      ) : (
        hint && <span className="text-[12.5px] text-ds-muted">{hint}</span>
      )}
    </div>
  )
}
