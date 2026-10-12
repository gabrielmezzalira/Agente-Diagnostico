/**
 * As perguntas do Agente para o painel AGP (Fase 10, TAQ-05). LÊ só de `chrome.storage.local`, onde o service
 * worker espelha o que o backend manda; nunca abre conexão (o painel do Meet não fala com o backend). Devolve
 * também o "agora", que anda a cada segundo só enquanto há pergunta na tela — é o que faz o card vencido sumir
 * mesmo que o `question_expired` demore.
 */
import { useEffect, useState } from 'react';
import { EMPTY_AGP_FEED, subscribeAgpFeed, type AgpFeed } from '@/shared/config/agpQuestionsStore';

const TICK_MS = 1_000;

export interface AgpQuestionsView {
  feed: AgpFeed;
  nowMs: number;
}

export function useAgpQuestions(): AgpQuestionsView {
  const [feed, setFeed] = useState<AgpFeed>(EMPTY_AGP_FEED);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => subscribeAgpFeed(setFeed), []);

  const hasQuestions = feed.questions.length > 0;
  useEffect(() => {
    if (!hasQuestions) return;
    setNowMs(Date.now());
    const timer = setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [hasQuestions]);

  return { feed, nowMs };
}
