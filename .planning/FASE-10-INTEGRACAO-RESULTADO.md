# Fase 10 do Gabriel integrada sobre a Fase 9 — o que foi verificado e o que falta

**Data:** 2026-10-28 · **Branch:** `feat/fase-10-agp-integracao` (a partir da ponta da Fase 9, `88ff5c0`)
**Merge:** `d896c64` (origem: `origin/feat/fase-10-agp-question-panel`, 13 commits de 12/10) · **Ajuste de teste:** `855ecad`
Nada foi empurrado (sem `push`). `.planning/config.json` continua modificado de antes e fora dos commits.

## 1. O que foi feito

- Merge **sem commitar** primeiro, para revisar. **1 conflito de texto**, em `taqciti/src/features/agente/associationClose.ts`.
  Resolução: mantida a função `isCloseOwed` (correção WR-02, nossa), adotada a redação do Gabriel nos comentários ("ao abrir o navegador, `runtime.onStartup`").
- O fix `restartGaveUpRounds` da Fase 10 (que o nosso lado não tinha) entrou: `agenteSessionFinisher.ts`, `agenteSessionFinisherInstance.ts`, `background/index.ts`.
- Foram 34 arquivos: aba AGP (`AgpQuestionsPanel.tsx`, `AgpLiveTabs.tsx`, `LiveScreen.tsx`, `PanelApp.tsx`), o feed por WebSocket (`agpQuestionsFeed.ts`, `agpBrowserSocket.ts`), storage (`agpQuestionsStore.ts`), regras puras, testes e documentos de planejamento da Fase 10.

## 2. O que foi VERIFICADO (com a saída real)

| Verificação | Resultado |
|---|---|
| `npm run typecheck` (Taqciti) | limpo |
| `npm run lint` (Taqciti) | limpo |
| `npx vitest run` (Taqciti) | **97 arquivos e 1513 testes passando** (antes 1434; +79 do Gabriel); 3 pulados = fumaça opt-in |
| `npm run build` (Taqciti) | ok |
| Fumaça AGP contra o **roteador WebSocket real do backend atual** (`AGP_PYTHON=python`) | **3 de 3 passam**: espelha `initial_state`/`question_new`/`question_expired`; sessão encerrada fecha com 4004 e o feed para sem reconectar; backend cai e volta, o painel reconecta sozinho e mantém as perguntas |
| Formato das mensagens (leitura de código) | bate: o backend manda `id`, `text`, `block`, `status="queued"`, `lens`, que são os campos que o painel exige; `question_expired` existe em `backend/app/services/pipeline.py:197` |
| Backend alterado pela Fase 10? | Não: a branch do Gabriel só toca `taqciti/` e `.planning/` |

**Achado:** o teste de fumaça chamava `python3` fixo. No Windows isso é só o atalho da Microsoft Store, e o servidor falso nunca subia (`ECONNREFUSED`). O teste agora aceita `AGP_PYTHON` (padrão continua `python3`). Rodar:
`cd taqciti && AGP_PYTHON=python AGP_SMOKE_SERVER=scripts/agp-fake-backend.py npx vitest run src/background/agpBackendSmoke.test.ts`

## 3. O que FALTA (nada disso foi provado)

### Não verificado
1. **Nunca foi visto no Chrome real.** Os 7 testes manuais do Gabriel (`.planning/phases/10-agp-question-panel-in-taqciti/10-UAT.md` e `.planning/PENDENCIAS-FASE-10.md` §1) nunca foram executados, por ninguém. Os testes automáticos provam protocolo e regras, não a tela no Meet.
2. **Depende da chave do Gemini com crédito** para as perguntas existirem de verdade (hoje 402). Sem isso, a aba AGP só consegue mostrar estado vazio.
3. **Build local da Taqciti foi sobrescrito.** Rodei `npm run build` sem as variáveis do ambiente local; o `taqciti/dist` que o seu Chrome carrega agora aponta para o endereço padrão. Para testar, refazer com `VITE_AGENTE_BACKEND_URL=http://127.0.0.1:8000 VITE_AGENTE_STREAMING_ENABLED=true npm --prefix taqciti run build` e dar ↻ em `chrome://extensions`.
4. **Visual** da aba AGP (emblemas Produto/Dados, painel compacto no Meet, saída larga): `/gsd-ui-phase 10` não rodou.

### Limitações de projeto (decisão do time, 10-A a 10-E)
5. **O WebSocket `/ws/{session_id}` não tem autenticação** (decisão 10-A). Quem souber o id lê as perguntas, e **conectar cria o pipeline de IA da sessão** (laço de 15 e 30 s: gasto de crédito).
6. **A aba só mostra, não age** (decisão 10-B): não gera, fixa nem descarta. Gerar perguntas continua no site. Você disse que não quer sair do Meet para pegar as perguntas: as perguntas automáticas aparecem na aba, mas o botão **Gerar agora** ainda é do site, a menos que o time decida o contrário.
7. **Fixar ou descartar no site não aparece na Taqciti**: o backend só avisa por TTL (`question_expired`), sem evento para pin/dismiss.

### Achados da revisão de código da Fase 10, deixados de propósito (`PENDENCIAS-FASE-10.md` §4)
8. **WR-04:** o feed conecta mesmo com a reunião pausada e ignora `streamingEnabled`.
9. **WR-05:** "Continuar envio" não confere `isClosing` (código da Fase 8).
10. **WR-06:** ir para `chrome://` (Nova Guia) no meio da call não dispara a DA-4 (precisaria da permissão `tabs`, que muda o aviso de instalação).
11. Mesma call aberta em **duas abas** pode encerrar a reunião da primeira.
12. `taqciti/src/background/index.ts` passou de 200 linhas (regra do `CLAUDE.md`); dividir é refator à parte.

### Processo e documentação
13. **A Fase 10 não tem os artefatos do GSD** (nada de `CONTEXT`, `RESEARCH`, planos numerados nem `VERIFICATION`): veio só com o `10-PLAN.md`, o `10-REVIEW.md` e o `10-UAT.md` do Gabriel. O ROADMAP ainda não lista planos nela. Decidir se a Fase 10 será (a) formalizada com `/gsd-discuss-phase 10` e `/gsd-plan-phase 10` reaproveitando o código, ou (b) tratada como trabalho já feito e só verificada com `/gsd-verify-work 10`.
14. **Documentos velhos entraram no merge:** `RETOMAR-AQUI.md` e `PENDENCIAS-FASE-08.md` (de 12/10) estão desatualizados.
15. **`CLAUDE.md` precisa de uma frase nova** quando a Fase 10 entrar na `main`: hoje ele diz que a Taqciti não usa o WebSocket (verdade até a Fase 9); com a aba AGP ela usa `/ws/{session_id}`.
16. **A branch do Gabriel foi cortada de uma Fase 8 mais antiga.** O merge só teve 1 conflito e tudo passa, mas isso não prova que a aba funciona sobre a Fase 8 final (71 commits a mais do nosso lado).

### Integração com `main` e `master` (ainda não feita)
17. Esta branch ainda precisa virar o commit de integração com a `master` como ancestral e **árvore final igual à nossa** (método do `INTEGRACAO-MASTER-ANALISE.md`), depois `main`, depois `master`. Fazer só com o time presente.
18. Antes de qualquer deploy: `GEMINI_API_KEY` no Railway (migration do `chunk_id` já está em produção, conferido).
