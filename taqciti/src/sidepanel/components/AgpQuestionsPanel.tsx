/**
 * A aba "AGP" (Fase 10, TAQ-05): as perguntas que o Agente gerou para a sessão vinculada a esta reunião, cada
 * uma com a lente (Produto ou Dados). Só apresenta — a Taqciti não recalcula nem inventa pergunta, e sem
 * vínculo explícito mostra o aviso em vez de qualquer pergunta (critério 3).
 */
import type { AgpLens } from '@/features/agente/agpQuestions';
import type { AgpConnection, AgpFeed } from '@/shared/config/agpQuestionsStore';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';

const LENS_LABEL: Record<AgpLens, string> = { produto: 'Produto', dados: 'Dados' };

const PAUSED_HINT =
  'A atualização volta sozinha quando a captura estiver gravando e o envio ao Agente estiver ligado.';

interface StatusBanner {
  text: string;
  title?: string;
  withPauseIcon: boolean;
}

/** Faixa de status por conexão; `null` quando ao vivo (não há faixa). Função pura, sem JSX. */
function statusBannerFor(connection: AgpConnection): StatusBanner | null {
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

function emptyMessageFor(connection: AgpConnection): string {
  return connection === 'paused'
    ? 'Nenhuma pergunta foi recebida antes da pausa.'
    : 'Nenhuma pergunta por enquanto. Elas aparecem aqui conforme o Agente gera.';
}

function Notice({ children }: { children: string }) {
  return (
    <p className="flex flex-1 items-center justify-center px-4 text-center text-body text-muted">{children}</p>
  );
}

export function AgpQuestionsPanel({ feed }: { feed: AgpFeed }) {
  if (feed.sessionId === null) {
    return <Notice>Vincule esta reunião a um cliente para ver aqui as perguntas do Agente.</Notice>;
  }
  if (feed.connection === 'idle') {
    return <Notice>A sessão do Agente não está ativa. Não há perguntas para mostrar.</Notice>;
  }

  const visible = feed.questions;
  const banner = statusBannerFor(feed.connection);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {banner !== null && (
        <p role="status" title={banner.title} className="flex shrink-0 items-center gap-1 text-caption text-muted">
          {banner.withPauseIcon && <Icon name="pause" size={11} />}
          {banner.text}
        </p>
      )}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {visible.length === 0 ? (
          <Notice>{emptyMessageFor(feed.connection)}</Notice>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label="Perguntas do Agente">
            {visible.map((question) => (
              <li key={question.id} className="glass-subtle rounded-panel p-3">
                <div className="mb-1.5 flex items-center gap-2">
                  {question.lens !== null && (
                    <Badge tone={question.lens === 'produto' ? 'primary' : 'neutral'}>{LENS_LABEL[question.lens]}</Badge>
                  )}
                  {question.status === 'pinned' && <Badge tone="warning">Fixada</Badge>}
                </div>
                <p className="m-0 text-body leading-relaxed">{question.text}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
