export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'active'
export type ButtonSize = 'md' | 'sm' | 'hero'

const BASE =
  'inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap transition-colors ' +
  'disabled:opacity-50 disabled:pointer-events-none cursor-pointer'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-ds-green text-[#04120a] border border-ds-green shadow-[0_0_24px_rgba(62,224,111,0.25)] hover:bg-ds-green-hover',
  secondary: 'bg-white/[0.04] text-ds-text border border-ds-border-strong hover:bg-white/[0.08]',
  ghost: 'bg-transparent text-ds-text-2 border border-transparent hover:bg-white/[0.05] hover:text-ds-text',
  danger: 'bg-transparent text-ds-red border border-ds-red/30 hover:bg-ds-red/10',
  active: 'bg-ds-green-soft text-ds-green border border-ds-green-line hover:bg-ds-green/20',
}

const SIZES: Record<ButtonSize, string> = {
  md: 'h-[38px] px-4 rounded-[10px] text-[13.5px]',
  sm: 'h-8 px-3 rounded-[10px] text-[12.5px]',
  hero: 'h-16 px-6 rounded-[14px] text-[17px] font-bold w-full shadow-[0_0_40px_rgba(62,224,111,0.3)]',
}

export function buttonClasses(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md', extra = ''): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${extra}`.trim()
}

