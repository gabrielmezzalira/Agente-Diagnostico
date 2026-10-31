/**
 * Regra pura do que o tamanho COMPACTO do painel do Meet esconde ou junta para sobrar altura para a lista da aba
 * AGP (G-10-7). Escolha do usuário em 2026-10-31: o painel fica em 320 px e não cresce sozinho; o que não cabe
 * sai do caminho. Só o compacto muda; médio e alto ficam como estão. Sem I/O, sem React.
 */
import type { PanelSize } from '@/shared/types/domain';

export interface CompactLayout {
  /**
   * O campo "Nome da reunião" aparece no cabeçalho. No compacto não (opção a); para renomear, use "Expandir".
   */
  showMeetingTitleField: boolean;
  statsInControlsRow: boolean; // STUB (RED)
}

export function compactLayoutFor(size: PanelSize): CompactLayout {
  const compact = size === 'compact';
  return { showMeetingTitleField: !compact, statsInControlsRow: false };
}
