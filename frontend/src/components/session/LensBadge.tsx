import { lensBadgeVariant, lensLabel } from '../../lib/lens'
import { Chip } from '../ui'

/** Tag Produto/Dados (UI-02/D-44). Em modo vendas (lens null) não renderiza nada. */
export default function LensBadge({ lens }: { lens: 'produto' | 'dados' | null }) {
  const variant = lensBadgeVariant(lens)
  if (variant === 'none') return null
  return <Chip tone={variant === 'produto' ? 'green' : 'neutral'}>{lensLabel(lens)}</Chip>
}
