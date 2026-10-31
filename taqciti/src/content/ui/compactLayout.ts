// STUB (RED): comportamento ainda não implementado.
import type { PanelSize } from '@/shared/types/domain';

export interface CompactLayout {
  showMeetingTitleField: boolean;
}

export function compactLayoutFor(_size: PanelSize): CompactLayout {
  return { showMeetingTitleField: true };
}
