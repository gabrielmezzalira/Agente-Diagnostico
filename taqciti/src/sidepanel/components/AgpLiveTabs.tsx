/**
 * As abas "Transcrição | AGP" do corpo ao vivo (Fase 10, TAQ-05). A transcrição segue sendo a aba padrão —
 * quem não abre a AGP não vê nada diferente. Mesmo componente nas duas superfícies ao vivo (painel injetado
 * no Meet e saída larga); `children` é a transcrição de cada uma. Estado local = só qual aba está à vista.
 *
 * Acessibilidade (padrão WAI-ARIA de abas, M-4): cada aba tem `id` e `aria-controls`, o corpo é o `tabpanel`
 * rotulado pela aba selecionada, e as setas esquerda/direita alternam entre as abas com `tabIndex` móvel.
 */
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useAgpQuestions } from '@/shared/hooks/useAgpQuestions';
import { AgpQuestionsPanel, type AgpSurface } from './AgpQuestionsPanel';

type Tab = 'transcript' | 'agp';

const TAB_ORDER: readonly Tab[] = ['transcript', 'agp'];

const TAB_BASE = 'h-8 rounded-control px-3 text-caption font-semibold transition-colors';

/** Rótulo falado da aba AGP com o contador; sem contador (0) não há rótulo e vale o texto visível. */
function agpTabLabel(count: number): string | undefined {
  if (count <= 0) return undefined;
  return count === 1 ? 'AGP, 1 pergunta' : `AGP, ${count} perguntas`;
}

function arrowStep(key: string): number {
  if (key === 'ArrowRight') return 1;
  if (key === 'ArrowLeft') return -1;
  return 0;
}

/** Aba para onde a seta leva (circular); `null` para qualquer outra tecla. Função pura. */
function tabAfterArrow(current: Tab, key: string): Tab | null {
  const step = arrowStep(key);
  if (step === 0) return null;
  const index = (TAB_ORDER.indexOf(current) + step + TAB_ORDER.length) % TAB_ORDER.length;
  return TAB_ORDER[index] ?? null;
}

export function AgpLiveTabs({ children, surface = 'panel' }: { children: ReactNode; surface?: AgpSurface }) {
  const [tab, setTab] = useState<Tab>('transcript');
  const feed = useAgpQuestions();
  const count = feed.questions.length;
  const baseId = useId();
  const tabId = (value: Tab) => `${baseId}-tab-${value}`;
  const panelId = `${baseId}-panel`;
  const buttons = useRef<Record<Tab, HTMLButtonElement | null>>({ transcript: null, agp: null });

  // Só no tablist e só as setas: qualquer outra tecla (do Meet ou nossa) passa intacta.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = tabAfterArrow(tab, event.key);
    if (next === null) return;
    event.preventDefault();
    setTab(next);
    buttons.current[next]?.focus();
  };

  const button = (value: Tab, label: string, badge?: number, ariaLabel?: string) => (
    <button
      ref={(element) => {
        buttons.current[value] = element;
      }}
      id={tabId(value)}
      type="button"
      role="tab"
      aria-selected={tab === value}
      aria-controls={panelId}
      aria-label={ariaLabel}
      tabIndex={tab === value ? 0 : -1}
      onClick={() => setTab(value)}
      className={`${TAB_BASE} ${tab === value ? 'bg-white/[0.08] text-glow' : 'text-muted hover:text-glow'}`}
    >
      {label}
      {badge !== undefined && badge > 0 && <span className="ml-1.5 text-micro text-muted">{badge}</span>}
    </button>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="tablist" aria-label="Conteúdo ao vivo" onKeyDown={onKeyDown} className="mb-2 flex shrink-0 gap-1">
        {button('transcript', 'Transcrição')}
        {button('agp', 'AGP', count, agpTabLabel(count))}
      </div>
      <div role="tabpanel" id={panelId} aria-labelledby={tabId(tab)} className="flex min-h-0 flex-1 flex-col">
        {tab === 'transcript' ? children : <AgpQuestionsPanel feed={feed} surface={surface} />}
      </div>
    </div>
  );
}
