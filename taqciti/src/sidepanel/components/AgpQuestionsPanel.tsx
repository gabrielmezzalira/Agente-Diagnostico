/**
 * A aba "AGP" (Fase 10, TAQ-05): as perguntas que o Agente gerou para a sessão vinculada a esta reunião, cada
 * uma com a lente (Produto ou Dados). Só apresenta — a Taqciti não recalcula nem inventa pergunta, e sem
 * vínculo explícito mostra o aviso em vez de qualquer pergunta (critério 3).
 */
import type { AgpLens } from '@/features/agente/agpQuestions';
import type { AgpConnection, AgpFeed } from '@/shared/config/agpQuestionsStore';
import { Badge } from '@/shared/ui/Badge';

const LENS_LABEL: Record<AgpLens, string> = { produto: 'Produto', dados: 'Dados' };

/** Onde a tela aparece: o painel injetado no Meet (padrão) ou a saída larga (sem o espaço de vínculo). */
export type AgpSurface = 'panel' | 'wide';

const UNLINKED_NOTICE = 'Vincule esta reunião a um cliente para ver aqui as perguntas do Agente.';
const UNLINKED_WIDE_HINT = ' O vínculo é feito no painel do TaqCITi dentro do Meet.';

/** Aviso de "sem vínculo": a saída larga não tem o espaço de vínculo, então diz onde vincular. Função pura. */
function unlinkedMessageFor(surface: AgpSurface): string {
  return surface === 'wide' ? UNLINKED_NOTICE + UNLINKED_WIDE_HINT : UNLINKED_NOTICE;
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

export function AgpQuestionsPanel({ feed, surface = 'panel' }: { feed: AgpFeed; surface?: AgpSurface }) {
  if (feed.sessionId === null) {
    return <Notice>{unlinkedMessageFor(surface)}</Notice>;
  }
  if (feed.connection === 'idle') {
    return <Notice>A sessão do Agente não está ativa. Não há perguntas para mostrar.</Notice>;
  }

  const visible = feed.questions;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div tabIndex={0} className="scroll-region flex min-h-0 flex-1 flex-col outline-none">
        {visible.length === 0 ? (
          <Notice>{emptyMessageFor(feed.connection)}</Notice>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label="Perguntas do Agente">
            {visible.map((question) => (
              <li
                key={question.id}
                className="glass-subtle animate-fade-in rounded-panel p-4 motion-reduce:animate-none"
              >
                {(question.lens !== null || question.status === 'pinned') && (
                  <div className="mb-2 flex items-center gap-2">
                    {question.lens !== null && (
                      <Badge tone={question.lens === 'produto' ? 'primary' : 'neutral'}>
                        {LENS_LABEL[question.lens]}
                      </Badge>
                    )}
                    {question.status === 'pinned' && <Badge tone="warning">Fixada</Badge>}
                  </div>
                )}
                <p className="m-0 break-words text-body leading-relaxed">{question.text}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
