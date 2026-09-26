---
phase: 07-taqciti-config-background-streamer
plan: 03
subsystem: taqciti-streaming
tags: [chrome-extension, react, chrome-storage, mv3, vitest, typescript, streaming, config-ui]

requires:
  - phase: 07-taqciti-config-background-streamer
    provides: "Plano 02: agenteConfigStore.ts (loadAgenteConfig/patchAgenteConfig/subscribeAgenteConfig), streamer lendo a config real do storage"
provides:
  - "Rota `?view=agente` em route.ts (WideViewRequest.agenteConfig, AGENTE_CONFIG_SEARCH) — pedido explícito vence a fase, roteado em App.tsx antes de request.history"
  - "useAgenteConfigForm.ts: hook de estado da tela (config/drafts/readiness/saving/justSaved/setField/save/setStreamingEnabled) com rascunho por campo que nunca sobrescreve texto não salvo"
  - "AgenteConfigScreen.tsx: tela 'Agente Diagnóstico' (toggle D-09, ID manual D-04, URL D-08, chave mascarada D-10) — composição pura, sem lógica de negócio"
  - "Link 'Agente Diagnóstico · streaming ao vivo' na HomeScreen"
  - "AgenteConfigScreen.test.tsx: 6 casos de componente provando salvar/toggle/mascaramento/rascunho-não-sobrescrito/status"
  - "Subseção 'Integração com o Agente Diagnóstico (opcional)' em docs/publicar-release.md"
affects: [08-taqciti-session-association, 09-cutover-retire-extension]

actuals:
  tokens: 6300
  tasks: 2
  commits: 4
  plan_head_before: d37f940a87a48ad1228a2492b94930626d671b51

tech-stack:
  added: []
  patterns:
    - "Rascunho por campo + marca de edição em ref (não state): uma entrega da assinatura só atualiza campos NÃO editados desde o último salvar — versão em React da lição G-06-1 da Fase 6 (que resolvia o mesmo problema com polling + guarda de foco em JS puro)"
    - "flushUntil em teste de componente: act() só comita atualizações pendentes quando o próprio callback assíncrono se resolve — checar o DOM enquanto ainda dentro do act (como faria um vi.waitFor chamado de dentro dele) nunca vê a mudança. O padrão correto é: cada passo de espera é o próprio act (com um delay real curto), e o predicado é checado DEPOIS que ele resolve, em loop até convergir ou estourar o timeout"

key-files:
  created:
    - taqciti/src/shared/hooks/useAgenteConfigForm.ts
    - taqciti/src/sidepanel/screens/AgenteConfigScreen.tsx
    - taqciti/src/sidepanel/screens/AgenteConfigScreen.test.tsx
  modified:
    - taqciti/src/sidepanel/route.ts
    - taqciti/src/sidepanel/route.test.ts
    - taqciti/src/sidepanel/App.tsx
    - taqciti/src/sidepanel/screens/HomeScreen.tsx
    - taqciti/docs/publicar-release.md

key-decisions:
  - "request.agenteConfig decidido em App.tsx ANTES de request.history e do switch de fase — mesma lógica do histórico: o pedido explícito da URL vence, nunca cai na tela de gravação/resumo"
  - "readiness deriva da config SALVA (não do rascunho em edição) — digitar não muda o status até 'Salvar' ser clicado; só o toggle (que grava na hora) muda o status imediatamente"
  - "Teste de componente descobriu que act(async () => {...}) só comita o DOM quando o próprio callback assíncrono resolve — um vi.waitFor chamado de DENTRO do act trava até o timeout porque a checagem nunca vê o commit; a correção foi o helper flushUntil, que faz o polling FORA do act, cada iteração sendo seu próprio act(delay curto)"

requirements-completed: [TAQ-01]

coverage:
  - id: D1
    description: "route.ts: WideViewRequest.agenteConfig + AGENTE_CONFIG_SEARCH ('?view=agente'), só valor exato ativa; App.tsx roteia request.agenteConfig antes de request.history"
    requirement: "TAQ-01"
    verification:
      - kind: unit
        ref: "taqciti/src/sidepanel/route.test.ts (8 casos: 5 antigos com agenteConfig:false + 3 novos do comportamento)"
        status: pass
      - kind: other
        ref: "grep -n \"request.agenteConfig\" taqciti/src/sidepanel/App.tsx (1 ocorrência, antes do if de history)"
        status: pass
    human_judgment: false
  - id: D2
    description: "useAgenteConfigForm.ts: estado da tela (config/drafts/readiness/saving/justSaved/setField/save/setStreamingEnabled), rascunho por campo nunca sobrescrito por entrega da assinatura quando o campo foi editado; save() normaliza via patchAgenteConfig; setStreamingEnabled grava na hora"
    requirement: "TAQ-01"
    verification:
      - kind: unit
        ref: "taqciti/src/sidepanel/screens/AgenteConfigScreen.test.tsx, caso 5 (rascunho não editado sobrevive a escrita externa no storage — prova indireta do hook via a tela)"
        status: pass
    human_judgment: false
  - id: D3
    description: "AgenteConfigScreen.tsx: toggle (checkbox), 3 TextField (ID da sessão, URL do backend, chave com type=password), botão Salvar, status com READINESS_LABELS, link Voltar (href=\"?\") — composição pura, sem lógica de negócio no JSX (CLAUDE.md SOLID)"
    requirement: "TAQ-01"
    verification:
      - kind: unit
        ref: "taqciti/src/sidepanel/screens/AgenteConfigScreen.test.tsx (6 casos: vazio/desligado, salvar normaliza e grava, toggle grava na hora, chave mascarada, rascunho sobrevive a escrita externa, status 'falta o ID')"
        status: pass
      - kind: other
        ref: "grep -c 'type=\"password\"' AgenteConfigScreen.tsx == 1; wc -l dos dois arquivos novos (124 e 126 linhas, < 200)"
        status: pass
    human_judgment: false
  - id: D4
    description: "HomeScreen.tsx: link 'Agente Diagnóstico · streaming ao vivo' (AGENTE_CONFIG_SEARCH) logo abaixo do parágrafo de descrição do header"
    requirement: "TAQ-01"
    verification:
      - kind: other
        ref: "grep -c AGENTE_CONFIG_SEARCH taqciti/src/sidepanel/screens/HomeScreen.tsx == 2 (import + uso)"
        status: pass
    human_judgment: false
  - id: D5
    description: "docs/publicar-release.md: subseção 'Integração com o Agente Diagnóstico (opcional)' — VITE_AGENTE_BACKEND_URL/VITE_AGENTE_STREAMING_ENABLED como padrões editáveis em runtime, x-agente-key sem variável de build de propósito"
    requirement: "TAQ-01"
    verification:
      - kind: other
        ref: "leitura manual do arquivo após a edição — subseção presente, fora da tabela das variáveis DocCITi"
        status: pass
    human_judgment: false
  - id: D6
    description: "Bateria final da fase: typecheck/lint/test/build da Taqciti + pytest do backend + invariantes (VITE_AGENTE_ só em agenteConfig.ts, nenhum artefato de build rastreado, nada fora do escopo mudou desde o merge do subtree)"
    requirement: "TAQ-01"
    verification:
      - kind: other
        ref: "npm run typecheck (0 erros); npm run lint (0 erros, 1 warning pré-existente fora de escopo); npm test (33 arquivos, 439 testes); npm run build (ok); git status --porcelain dist/node_modules (0); grep VITE_AGENTE_ (só agenteConfig.ts/agenteConfig.test.ts); git diff desde o merge do subtree em backend/server/document/PanelApp/manifest/package (0 arquivos)"
        status: pass
      - kind: other
        ref: "cd backend && python -m pytest tests/ -x -q — 1 falha (test_schema.py::test_tables_exist), pré-existente e fora de escopo (0 diff em backend/ nesta fase inteira; já documentada como pré-existente na Fase 6). 92 passed / 4 skipped sem esse teste."
        status: fail
    human_judgment: false
  - id: D7
    description: "SC1 (chamada real do Meet): ligar o toggle, colar o ID da sessão, confirmar chegada em transcript_chunks/monitoramento em poucos segundos, sem repetição, e que desligar para o envio"
    verification: []
    human_judgment: true
    rationale: "Exige uma chamada real do Google Meet e o web app do Agente Diagnóstico rodando — o executor não tem acesso a nenhum dos dois. Fica pendente para /gsd-verify-work, exatamente como o próprio plano instruiu (human-check da Task 2, não é um checkpoint ao vivo sob human_verify_mode=end-of-phase)."
  - id: D8
    description: "SC2 (fluxo em lote): com o toggle desligado, 'Gerar Documento' continua funcionando como antes"
    verification: []
    human_judgment: true
    rationale: "Exige rodar a extensão de verdade numa reunião de teste e gerar o documento — o executor não tem acesso ao ambiente de execução da extensão carregada no Chrome. Fica pendente para /gsd-verify-work."

duration: ~35min (com uma pausa entre a Task 1 e a Task 2 — ver Issues Encountered)
completed: 2026-09-26
status: complete
---

# Phase 7 Plan 3: Tela "Agente Diagnóstico" na Taqciti (toggle, ID manual, URL, chave mascarada) Summary

**A Taqciti ganha uma tela de verdade (`?view=agente`, alcançável pela tela inicial) para ligar o
streaming ao vivo para o Agente Diagnóstico: toggle, campo para colar o ID da sessão, URL do
backend e chave mascarada — tudo salvo em `chrome.storage.local` sem precisar recompilar a
extensão, e sem nunca apagar o que a pessoa ainda está digitando.**

## Performance
- **Duration:** ~35min de trabalho ativo (ver nota sobre a pausa em Issues Encountered)
- **Started:** 2026-09-25T23:10:41-03:00 (logo após o commit final do plano 07-02)
- **Completed:** 2026-09-26T08:46:13-03:00
- **Tasks:** 2/2
- **Files modified:** 8 (3 novos + 5 modificados)

## Accomplishments
- `route.ts` ganhou `WideViewRequest.agenteConfig` e a constante `AGENTE_CONFIG_SEARCH = '?view=agente'`
  — mesmo mecanismo já usado por `?view=history`, só o valor exato ativa (maiúsculas/plural não
  contam). `route.test.ts`: 8/8 verde (5 casos antigos atualizados + 3 novos).
- `App.tsx` roteia `request.agenteConfig` **antes** de `request.history` e do `switch` de fase — o
  pedido explícito da URL vence, igual ao histórico.
- `useAgenteConfigForm.ts` (124 linhas): assina `agenteConfigStore`, mantém um rascunho por campo
  com marca de edição em `ref` — uma entrega da assinatura só atualiza campos que a pessoa **não**
  está editando. `save()` normaliza via `patchAgenteConfig` e limpa as marcas; `setStreamingEnabled`
  grava na hora, sem esperar o botão.
- `AgenteConfigScreen.tsx` (126 linhas): composição pura — toggle, 3 `TextField` (chave com
  `type="password"`), botão "Salvar"/"Salvo!", status `aria-live="polite"` com `READINESS_LABELS`,
  link "Voltar" (`href="?"`). Nenhuma lógica de negócio no JSX.
- `HomeScreen.tsx` ganhou o link "Agente Diagnóstico · streaming ao vivo" logo abaixo da descrição
  do header.
- `AgenteConfigScreen.test.tsx`: 6 casos de componente, todos verdes — sem nada salvo (vazio +
  desligado), salvar grava normalizado, toggle grava na hora, chave mascarada, rascunho não editado
  sobrevive a uma escrita externa no storage (prova direta do G-06-1 em React), status "falta o ID
  da sessão" com toggle ligado e ID vazio.
- `docs/publicar-release.md` ganhou a subseção "Integração com o Agente Diagnóstico (opcional)",
  deixando claro que `VITE_AGENTE_*` são só padrões editáveis em runtime — ao contrário das
  variáveis DocCITi da tabela acima, que "não têm conserto" depois de publicadas.
- Bateria final da fase: `npm run typecheck` (0 erros), `npm run lint` (0 erros), `npm test` (33
  arquivos, 439 testes verdes), `npm run build` (ok), nenhum artefato de `dist/`/`node_modules`
  rastreado, `VITE_AGENTE_` só em `agenteConfig.ts`/`agenteConfig.test.ts`, e **zero** arquivos fora
  do escopo declarado alterados desde o commit de importação do subtree.

## Task Commits
1. **Task 1 (RED): teste da rota `?view=agente`** - `b629b73` (test)
2. **Task 1 (GREEN): rota + hook + tela do Agente** - `3d468f3` (feat)
3. **Task 2: link + teste de componente + docs + verificação final** - `dd5a76d` (feat)
**Plan metadata:** commit final deste SUMMARY (a seguir)

## Files Created/Modified
- `taqciti/src/sidepanel/route.ts` - `WideViewRequest.agenteConfig`, `AGENTE_CONFIG_SEARCH`
- `taqciti/src/sidepanel/route.test.ts` - 8 casos (5 atualizados + 3 novos)
- `taqciti/src/sidepanel/App.tsx` - roteia `request.agenteConfig` antes de `request.history`
- `taqciti/src/shared/hooks/useAgenteConfigForm.ts` - estado da tela (novo, 124 linhas)
- `taqciti/src/sidepanel/screens/AgenteConfigScreen.tsx` - tela "Agente Diagnóstico" (novo, 126 linhas)
- `taqciti/src/sidepanel/screens/AgenteConfigScreen.test.tsx` - 6 casos de componente (novo)
- `taqciti/src/sidepanel/screens/HomeScreen.tsx` - link para a tela do Agente
- `taqciti/docs/publicar-release.md` - subseção sobre `VITE_AGENTE_*`

## Decisions Made
- **`request.agenteConfig` decidido antes de `request.history`** em `App.tsx` — mesma prioridade do
  histórico; um pedido de tela nunca deve cair em outra.
- **`readiness` deriva da config salva, não do rascunho** — digitar não muda o status até "Salvar";
  só o toggle (grava na hora) muda o status imediatamente.
- **Padrão de teste `flushUntil` documentado no próprio arquivo de teste:** descoberto durante a
  execução que `act(async () => {...})` só comita atualizações no DOM quando o próprio callback
  assíncrono se resolve — um `vi.waitFor` chamado de DENTRO do `act` nunca vê a mudança (o polling
  roda antes do commit acontecer) e trava até estourar o timeout. A correção foi fazer o polling
  FORA do `act`, com cada iteração sendo seu próprio `act()` com um delay real curto. Documentado
  como comentário no topo de `AgenteConfigScreen.test.tsx` para quem for escrever o próximo teste de
  componente da Taqciti.

## Deviations from Plan

None de Rule 1-4 — plano executado como escrito. Duas notas de processo/descoberta técnica (acima,
em Decisions Made) não são deviations de bug/funcionalidade, são lições de execução.

**Total deviations:** 0 auto-fixed. **Impact on plan:** nenhum — as duas descobertas (prioridade de
rota, padrão de teste assíncrono) foram incorporadas na própria implementação/teste antes do
commit, não exigiram correção posterior.

## Issues Encountered

- **Pausa entre a Task 1 e a Task 2:** a sessão recebeu uma mensagem de "continue" no meio da
  execução, entre o commit da Task 1 (`3d468f3`, 2026-09-25 23:18) e o commit da Task 2 (`dd5a76d`,
  2026-09-26 08:46) — daí o "Duration" do cabeçalho não refletir tempo de trabalho ativo contínuo.
  Nenhum commit foi perdido; a continuação retomou exatamente de onde parou (Task 2 ainda não
  iniciada), sem redigitar nem repetir trabalho já commitado.
- **`backend/tests/test_schema.py::test_tables_exist` falhando** — pré-existente e fora de escopo
  (0 diff em `backend/` nesta fase inteira; já documentado como pré-existente na Fase 6 via
  `git stash`). Detalhes em `.planning/phases/07-taqciti-config-background-streamer/deferred-items.md`
  e registrado no ledger (`gsd_run windows append`, id 2, kind `unrun-verify`).
- **1 warning de lint pré-existente** em `taqciti/src/document/baixarDocumento.ts:26` (eslint-disable
  sem uso) — fora do escopo deste plano (arquivo não tocado). `npm run lint` sai com 0 erros.
  Registrado no mesmo `deferred-items.md` e no ledger (id 3, kind `lint-warning`).

## User Setup Required

None - nenhuma variável de ambiente/serviço externo novo é necessária para esta task. A verificação
manual ponta a ponta numa chamada real do Google Meet (SC1) e do fluxo "Gerar Documento" (SC2)
permanece pendente para `/gsd-verify-work`, como o próprio plano já previa (`<human-check>` da
Task 2, sob `workflow.human_verify_mode = end-of-phase`).

## Next Phase Readiness

A Fase 7 está tecnicamente completa do ponto de vista de código: rota, hook, tela, link, testes e
documentação prontos; toda a bateria automática da fase (typecheck/lint/test/build da Taqciti +
pytest do backend, exceto o teste pré-existente de schema) passou. **Pendente antes de fechar a
fase de verdade:** a verificação manual SC1 (chamada real do Meet chegando em `transcript_chunks` /
tela de monitoramento) e SC2 ("Gerar Documento" sem regressão) — ambas descritas no `<human-check>`
da Task 2 do plano e ainda não executadas por este executor (exigem Chrome com a extensão carregada
e uma chamada real do Meet, fora do alcance do agente). A Fase 8 (TAQ-02, auto-detecção de sessão)
já tem onde plugar: `patchAgenteConfig({ agenteSessionId })` por cima do campo manual que esta fase
entregou, sem exigir nenhuma mudança nos arquivos desta fase. Nenhum bloqueio de código conhecido.

## Self-Check: PASSED

Todos os arquivos criados/modificados e o próprio SUMMARY.md foram confirmados em disco; os 3
commits de código desta execução (`b629b73`, `3d468f3`, `dd5a76d`) foram confirmados em
`git log --oneline --all`.

---
*Phase: 07-taqciti-config-background-streamer*
*Completed: 2026-09-26*
