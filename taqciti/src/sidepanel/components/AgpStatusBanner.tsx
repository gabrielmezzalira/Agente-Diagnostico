/**
 * A faixa de status da aba AGP (Fase 10, G-10-7): "Conectando…", "Reconectando…" ou "Pausado". Só apresenta o
 * estado da conexão que o feed já traz; nada de regra nova. Mora na linha das abas (à direita) para não roubar
 * altura da lista de perguntas no painel compacto.
 */
import type { AgpConnection, AgpFeed } from '@/shared/config/agpQuestionsStore';
import { Icon } from '@/shared/ui/Icon';

const PAUSED_HINT =
  'A atualização volta sozinha quando a captura estiver gravando e o envio ao Agente estiver ligado.';

interface StatusBanner {
  text: string;
  title?: string;
  withPauseIcon: boolean;
}

/** Faixa de status por conexão; `null` quando ao vivo (não há faixa). Função pura, sem JSX. */
export function statusBannerFor(connection: AgpConnection): StatusBanner | null {
  switch (connection) {
    case 'connecting':
      return { text: 'Conectando ao Agente…', withPauseIcon: false };
    case 'reconnecting':
      return { text: 'Reconectando ao Agente…', withPauseIcon: false };
    case 'paused':
      return { text: 'Pausado · mostrando as últimas perguntas', title: PAUSED_HINT, withPauseIcon: true };
    default:
      return null;
  }
}

export function AgpStatusBanner({ feed }: { feed: AgpFeed }) {
  if (feed.sessionId === null) return null;
  const banner = statusBannerFor(feed.connection);
  if (banner === null) return null;
  return (
    <p role="status" title={banner.title} className="flex min-w-0 flex-1 items-center justify-end gap-1 text-right text-caption text-muted">
      {banner.withPauseIcon && <Icon name="pause" size={11} />}
      {banner.text}
    </p>
  );
}
