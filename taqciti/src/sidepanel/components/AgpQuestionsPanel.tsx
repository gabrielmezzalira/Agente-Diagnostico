/**
 * A aba "AGP" (Fase 10, TAQ-05): as perguntas que o Agente gerou para a sessão vinculada a esta reunião, cada
 * uma com a lente (Produto ou Dados). Só apresenta — a Taqciti não recalcula nem inventa pergunta, e sem
 * vínculo explícito mostra o aviso em vez de qualquer pergunta (critério 3).
 */
import { isAgpQuestionVisible, type AgpLens } from '@/features/agente/agpQuestions';
import type { AgpFeed } from '@/shared/config/agpQuestionsStore';
import { Badge } from '@/shared/ui/Badge';

const LENS_LABEL: Record<AgpLens, string> = { produto: 'Produto', dados: 'Dados' };

function Notice({ children }: { children: string }) {
  return (
    <p className="flex flex-1 items-center justify-center px-4 text-center text-body text-muted">{children}</p>
  );
}

export function AgpQuestionsPanel({ feed, nowMs }: { feed: AgpFeed; nowMs: number }) {
  if (feed.sessionId === null) {
    return <Notice>Vincule esta reunião a um cliente para ver aqui as perguntas do Agente.</Notice>;
  }
  if (feed.connection === 'idle') {
    return <Notice>A sessão do Agente não está ativa. Não há perguntas para mostrar.</Notice>;
  }

  const visible = feed.questions.filter((question) => isAgpQuestionVisible(question, nowMs));
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
      {feed.connection !== 'live' && (
        <p role="status" className="shrink-0 text-caption text-muted">
          {feed.connection === 'connecting' ? 'Conectando ao Agente…' : 'Reconectando ao Agente…'}
        </p>
      )}
      {visible.length === 0 ? (
        <Notice>Nenhuma pergunta por enquanto. Elas aparecem aqui conforme o Agente gera.</Notice>
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
  );
}
