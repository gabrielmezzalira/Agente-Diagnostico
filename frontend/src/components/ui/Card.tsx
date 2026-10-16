import type { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  highlight?: boolean
}

/** Cartão padrão do design system: gradiente verde escuro com contorno verde. */
export default function Card({ highlight = false, className = '', ...rest }: CardProps) {
  return <div className={`ds-card ${highlight ? 'ds-card-highlight' : ''} ${className}`} {...rest} />
}
