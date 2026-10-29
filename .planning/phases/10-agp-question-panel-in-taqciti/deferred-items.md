# Fase 10 — itens adiados (fora do escopo dos planos)

## Teste de temporização instável sob carga (descoberto no plano 10-02)

- **Arquivo:** `taqciti/src/sidepanel/screens/AgenteConfigScreenPlanB.test.tsx`
- **Sintoma:** na suíte completa (`cd taqciti && npx vitest run`, ~150 s, máquina carregada) 9 testes falham com
  `flushUntil: predicado não ficou verdadeiro a tempo`; rodando o arquivo sozinho passa 10/10.
- **Causa provável:** o helper `flushUntil` tem prazo curto e a renderização do jsdom estoura sob carga.
- **Não relacionado a:** mudanças do plano 10-02 (background/máquina da reunião). Nenhum import em comum.
- **Decisão:** não corrigido aqui (fora do escopo); candidato a ajuste do prazo do `flushUntil` num plano de testes.

## Mais três testes que estouram os 5 s do prazo padrão sob carga (descoberto no plano 10-03)

- **Arquivos:** `taqciti/src/background/agenteAssociationHttp.test.ts` ("lista os clientes vindos de GET /webhook/extension/clients, com o x-agente-key"), `taqciti/src/background/agenteStreamer.test.ts` ("WR-02: fala ainda na janela quando o service worker reinicia sai depois do reinício") e `taqciti/src/sidepanel/screens/AgenteConfigScreen.test.tsx` ("(0) com a leitura da config pendente mostra 'Carregando configuração…'").
- **Sintoma:** na suíte completa (`cd taqciti && npx vitest run`, 102 arquivos) cada um falha com ~5.1 s (o prazo padrão de 5 s do vitest); rodando os três arquivos juntos, sozinhos, passam 74/74.
- **Causa provável:** a mesma do item acima — máquina carregada pela suíte inteira (import dinâmico e renderização do jsdom estouram o prazo).
- **Não relacionado a:** mudanças do plano 10-03 (feed do AGP). Nenhum dos três importa `agpQuestionsFeed*`, `agpTarget` nem `agpQuestionsStore`.
- **Decisão:** não corrigido aqui (fora do escopo). O teste novo deste plano (`agpQuestionsFeedInstance.test.ts`) já usa `vi.setConfig({ testTimeout: 30_000 })` para não entrar nessa lista. Candidato a um plano de testes: prazo maior (`testTimeout`/`hookTimeout`) no `vitest.config.ts` para a suíte inteira.
