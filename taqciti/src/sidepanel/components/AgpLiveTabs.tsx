/**
 * As abas "Transcrição | AGP" do corpo ao vivo (Fase 10, TAQ-05). A transcrição segue sendo a aba padrão —
 * quem não abre a AGP não vê nada diferente. Mesmo componente nas duas superfícies ao vivo (painel injetado
 * no Meet e saída larga); `children` é a transcrição de cada uma. Estado local = só qual aba está à vista.
 */
import { useState, type ReactNode } from 'react';
import { useAgpQuestions } from '@/shared/hooks/useAgpQuestions';
import { AgpQuestionsPanel } from './AgpQuestionsPanel';

type Tab = 'transcript' | 'agp';

const TAB_BASE = 'rounded-control px-3 py-1 text-caption font-semibold transition-colors';

export function AgpLiveTabs({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<Tab>('transcript');
  const feed = useAgpQuestions();
  const count = feed.questions.length;

  const button = (value: Tab, label: string, badge?: number) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === value}
      onClick={() => setTab(value)}
      className={`${TAB_BASE} ${tab === value ? 'bg-white/[0.08] text-glow' : 'text-muted hover:text-glow'}`}
    >
      {label}
      {badge !== undefined && badge > 0 && <span className="ml-1.5 text-micro text-muted">{badge}</span>}
    </button>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="tablist" aria-label="Conteúdo ao vivo" className="mb-2 flex shrink-0 gap-1">
        {button('transcript', 'Transcrição')}
        {button('agp', 'AGP', count)}
      </div>
      {tab === 'transcript' ? children : <AgpQuestionsPanel feed={feed} />}
    </div>
  );
}
