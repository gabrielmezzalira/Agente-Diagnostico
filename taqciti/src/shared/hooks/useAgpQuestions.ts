/**
 * As perguntas do Agente para o painel AGP (Fase 10, TAQ-05). LÊ só de `chrome.storage.local`, onde o service
 * worker espelha o que o backend manda; nunca abre conexão (o painel do Meet não fala com o backend). A pergunta
 * some quando o backend manda `question_expired` — não há relógio local.
 */
import { useEffect, useState } from 'react';
import { EMPTY_AGP_FEED, subscribeAgpFeed, type AgpFeed } from '@/shared/config/agpQuestionsStore';

export function useAgpQuestions(): AgpFeed {
  const [feed, setFeed] = useState<AgpFeed>(EMPTY_AGP_FEED);
  useEffect(() => subscribeAgpFeed(setFeed), []);
  return feed;
}
