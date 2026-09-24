---
phase: 05-two-lens-monitoring-frontend
plan: 04
subsystem: ui
tags: [react, typescript, prd-handoff, discovery]

# Dependency graph
requires:
  - phase: 05-two-lens-monitoring-frontend
    plan: 02
    provides: "lensBadgeVariant/lensLabel/blockLabel, LensBadge compartilhado, oculta botao Relatorio da topbar em discovery"
  - phase: 05-two-lens-monitoring-frontend
    plan: 03
    provides: "api.sessions.getReadiness / updateReportStatus, tipo Readiness, Report.status (Optional[Literal])"
provides:
  - "ProjectDetailPage.tsx::ReadinessBar + bloco 'Gerar PRD' gated por readiness + READINESS_SIGNAL_LABELS"
  - "SessionActivePage.tsx: seletor de status/aprovacao do relatorio (ramo !isActive) + hint 'Libera a importacao no Precificador'"
affects: ["handoff de PRD (fim da Fase 5)", "import-from-diagnosis no Precificador (gate D-37)"]

# Actuals (#2632)
actuals:
  tokens: 2476
  tasks: 2
  commits: 2
plan_head_before: 9060a5d10cc18063936104a46e9fd51bf311f1cd

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ReadinessBar como clone visual do BudgetBar (bg-[var(--color-accent)] fill, h-1.5), escopado ao bloco 'Gerar PRD' na ProjectDetailPage"
    - "pickDiscoverySession: escolha deterministica da sessao de discovery (mais recente por started_at) sem estado extra, recomputada a cada render a partir de sessions[]"
    - "handleUpdateReportStatus segue o mesmo padrao disable-while-mutating de handleRegenerate/handleUploadPdf (updatingStatus + reverte para o ultimo status confirmado via setFinishedReport, nunca o valor tentado)"

key-files:
  created: []
  modified:
    - frontend/src/pages/ProjectDetailPage.tsx
    - frontend/src/pages/SessionActivePage.tsx

key-decisions:
  - "Bloco 'Gerar PRD' inserido como secao dedicada antes de 'Precificacoes' (Claude's Discretion do CONTEXT.md) em vez de por-card-de-sessao — mantem a pagina com um unico ponto de handoff, alinhado ao precedente de 'Nova sessao' como CTA de secao"
  - "Seletor de status implementado como <select> nativo (Claude's Discretion) em vez de 3 botoes — as 3 opcoes verbatim ja sao curtas o suficiente para um <option> sem quebrar o layout compacto da sessao encerrada"
  - "disabled do botao 'Gerar PRD' inclui tambem generatingPrd (alem dos 3 estados do plano: !ready/loading/erro) — previne duplo clique durante o POST de generateReport, mesmo padrao disable-while-mutating usado no resto do arquivo (Rule 2 - funcionalidade critica minima, nao architectural)"

requirements-completed: [REP-02]

coverage:
  - id: D1
    description: "Bloco readiness/'Gerar PRD' so renderiza quando project.mode === 'discovery' e existe ao menos uma sessao (senao nao renderiza nada) — sales fica byte-identico"
    requirement: "REP-02"
    verification:
      - kind: unit
        ref: "npx tsc -b --noEmit (exit 0) + grep GERAR_PRD_OK (getReadiness + 'Gerar PRD' + mode === 'discovery' ligados no componente)"
        status: pass
    human_judgment: true
    rationale: "O gate por project.mode e a ausencia de fetch/render em sales estao no codigo e compilam, mas a inspecao visual real (projeto sales sem o bloco, projeto discovery com a barra/botao) nao tem teste de render automatizado (sem @testing-library configurado) — precisa confirmacao humana."
  - id: D2
    description: "Botao 'Gerar PRD' fica desabilitado (fail closed) em !readiness.ready, readinessLoading e readinessError; o title lista low_signals mapeados via READINESS_SIGNAL_LABELS quando bloqueado"
    requirement: "REP-02"
    verification:
      - kind: unit
        ref: "npx tsc -b --noEmit (exit 0) — disabled={!readiness?.ready || readinessLoading || !!readinessError || generatingPrd} tipado sem erro"
        status: pass
    human_judgment: true
    rationale: "A condicao de disabled cobre os 3 estados do plano (mais generatingPrd) e compila, mas o comportamento real do fail-closed (barra a 0%, label 'Carregando...', tooltip com os sinais faltantes) precisa verificacao visual manual — nenhuma sessao real com readiness abaixo do limiar foi exercitada neste plano."
  - id: D3
    description: "A barra mostra Math.round(readiness.score * 100)% e o clique (com botao liberado) chama api.sessions.generateReport e navega para /sessions/{id}"
    requirement: "REP-02"
    verification:
      - kind: unit
        ref: "npx tsc -b --noEmit (exit 0) — handleGeneratePrd tipado, navigate(`/sessions/${sessionId}`) chamado apos generateReport resolver"
        status: pass
    human_judgment: false
  - id: D4
    description: "Seletor de status na sessao encerrada so aparece quando finishedReport.status != null (discovery); as 3 opcoes batem verbatim com o Literal do backend; mudar chama updateReportStatus e desabilita durante a chamada"
    requirement: "REP-02"
    verification:
      - kind: unit
        ref: "npx tsc -b --noEmit (exit 0) + grep STATUS_SELECTOR_OK (updateReportStatus + 'Aprovado para build' + hint de aprovacao ligados no componente)"
        status: pass
    human_judgment: true
    rationale: "O gate finishedReport.status != null e o handler PATCH estao no codigo e compilam, mas o render real do seletor (3 opcoes, disabled durante a chamada, reversao em falha) precisa confirmacao visual humana em uma sessao discovery encerrada real."
  - id: D5
    description: "'Aprovado para build' mostra o hint 'Libera a importacao no Precificador' perto do seletor"
    requirement: "REP-02"
    verification:
      - kind: unit
        ref: "grep 'Libera a importação no Precificador' (acentuado, texto verbatim do UI-SPEC Copywriting Contract) presente em SessionActivePage.tsx"
        status: pass
    human_judgment: false

duration: ~15min
completed: 2026-09-24
status: complete
---

# Phase 5 Plan 4: Handoff de PRD (frontend) — ReadinessBar/"Gerar PRD" + seletor de status/aprovação Summary

**Fecha a camada de frontend do handoff de PRD: na página do projeto, uma barrinha de readiness + botão "Gerar PRD" bloqueado abaixo do limiar (com o que falta no tooltip); na sessão discovery encerrada, um seletor de status onde "Aprovado para build" sinaliza que libera o import no Precificador. Tudo gated por discovery — sales fica byte-idêntico.**

## Performance

- **Duration:** ~15min
- **Completed:** 2026-09-24
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `ProjectDetailPage.tsx` ganhou `READINESS_SIGNAL_LABELS` (mapa fechado dos 4 sinais de readiness → frases PT curtas), `pickDiscoverySession` (escolhe deterministicamente a sessão mais recente por `started_at`), `ReadinessBar` (clone visual do `BudgetBar`) e um bloco dedicado "Gerar PRD" inserido antes de "Precificações", gated por `project.mode === 'discovery'`. O bloco busca o readiness via `api.sessions.getReadiness` no mount, com estado escopado (`readiness`/`readinessLoading`/`readinessError`) — fail closed nos 3 estados (botão desabilitado). O clique (quando liberado) chama `api.sessions.generateReport` e navega para a sessão.
- `SessionActivePage.tsx` ganhou, dentro do bloco `finishedReport &&` (ramo `!isActive`), um seletor `<select>` com as 3 opções verbatim do backend ("Rascunho" / "Em revisão" / "Aprovado para build"), gated por `finishedReport.status != null`. `handleUpdateReportStatus` segue o mesmo padrão disable-while-mutating de `handleRegenerate`/`handleUploadPdf`: desabilita o seletor durante o `PATCH`, reverte ao último status confirmado em falha (reusando o banner de erro existente), e mostra o hint "Libera a importação no Precificador" quando o status atual é "Aprovado para build".

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1 (D-47): ReadinessBar + botão "Gerar PRD" gated por readiness na página do projeto** - `78873d2` (feat)
2. **Task 2 (D-48): seletor de status/aprovação do relatório na sessão encerrada** - `55e5750` (feat)

**Plan metadata:** commit final (docs) — ver `git log` após esta etapa.

## Files Created/Modified

- `frontend/src/pages/ProjectDetailPage.tsx` — `READINESS_SIGNAL_LABELS`, `pickDiscoverySession`, `ReadinessBar`, estado `readiness`/`readinessLoading`/`readinessError`/`generatingPrd`, `handleGeneratePrd`, bloco "Gerar PRD" gated por `project.mode === 'discovery'`.
- `frontend/src/pages/SessionActivePage.tsx` — estado `updatingStatus`, `handleUpdateReportStatus`, seletor de status/aprovação dentro do bloco `finishedReport &&`, gated por `finishedReport.status != null`.

## Decisions Made

- Bloco "Gerar PRD" como seção dedicada antes de "Precificações" (Claude's Discretion do CONTEXT.md), não por card de sessão — mantém um único ponto de handoff na página, mesmo padrão visual do CTA "Nova sessão".
- Seletor de status implementado como `<select>` nativo (Claude's Discretion), não 3 botões — as 3 opções verbatim cabem confortavelmente em `<option>` sem alterar o layout compacto da sessão encerrada.
- `disabled` do botão "Gerar PRD" inclui também `generatingPrd` além dos 3 estados descritos no plano (`!ready`/loading/erro) — previne duplo clique durante o `POST` de `generateReport`, mesmo padrão disable-while-mutating já usado no resto do arquivo (Rule 2 — funcionalidade crítica mínima, não decisão arquitetural).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - encoding do grep de verificação] Corrigido o texto de verificação da Task 2 para usar acentuação correta**
- **Encontrado durante:** verificação automatizada da Task 2
- **Problema:** O comando `<automated>` da Task 2 no PLAN.md busca a string `'Libera a importacao no Precificador'` sem acentos, mas o UI-SPEC (Copywriting Contract, fonte canônica da cópia) especifica o texto verbatim "Libera a importação no Precificador" com acentuação correta, e o CLAUDE.md exige respostas/textos em português correto. Todo o PLAN.md aparenta estar normalizado em ASCII sem acentos (ex: "sessao", "geracao", "nao" ao longo do arquivo inteiro), o que é consistente com uma normalização do próprio documento de planejamento, não uma instrução deliberada para remover acentos da UI.
- **Fix:** Implementado o hint com acentuação correta ("Libera a importação no Precificador"), verificado com um grep equivalente acentuado (`STATUS_SELECTOR_OK` confirmado). Nenhuma mudança de comportamento — só a forma correta do texto em PT.
- **Arquivos modificados:** `frontend/src/pages/SessionActivePage.tsx`
- **Commit:** `55e5750`

## Issues Encountered

Nenhum. `npx tsc -b --noEmit` saiu limpo (exit 0) após as duas tasks.

## User Setup Required

None — nenhuma configuração externa necessária; nenhum contrato de backend foi tocado (a 05-03 já expôs tudo que este plano consome).

## Next Phase Readiness

- Handoff de PRD completo no frontend: botão "Gerar PRD" gated por readiness na página do projeto + seletor de status/aprovação na sessão discovery encerrada. Fecha o D-41 (Fase 5 honra o D-35 dividido na Fase 4).
- Verificação visual humana pendente (D1/D2/D4 marcados `human_judgment: true`, mesma lacuna já sinalizada pela 05-02/05-03): abrir um projeto discovery real com uma sessão de readiness abaixo e acima do limiar para confirmar visualmente o bloqueio/tooltip/liberação do botão, e uma sessão discovery encerrada para confirmar o seletor de status + hint de aprovação. Recomendado antes do ship da fase (mesma recomendação acumulada nas 05-02/05-03).
- Nenhum bloqueio identificado. Fase 5 fecha as 4 plans previstas (05-01 a 05-04).

## Self-Check: PASSED

Arquivos declarados (`frontend/src/pages/ProjectDetailPage.tsx`, `frontend/src/pages/SessionActivePage.tsx`) e os 2 commits (`78873d2`, `55e5750`) confirmados no disco/histórico do git.

---
*Phase: 05-two-lens-monitoring-frontend*
*Completed: 2026-09-24*
