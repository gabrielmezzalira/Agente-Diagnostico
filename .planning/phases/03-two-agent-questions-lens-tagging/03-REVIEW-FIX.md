---
phase: 03-two-agent-questions-lens-tagging
fixed_at: 2026-09-22T13:45:00Z
review_path: .planning/phases/03-two-agent-questions-lens-tagging/03-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 3
skipped: 1
status: partial
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-09-22T13:45:00Z
**Source review:** .planning/phases/03-two-agent-questions-lens-tagging/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope (critical + warning): 4
- Fixed: 3
- Skipped: 1

**Verificação executada em:** worktree isolada (`.claude/worktrees/rf-03-1732-1790084312`), criada a partir de `feat/fase-03-two-agent-questions`. As duas suítes de teste (`test_two_agent_lens.py` + `test_discovery_mode.py`, 37 asserções) foram rodadas ali após cada fix, não no checkout principal. Os commits foram fast-forwardados de volta para `feat/fase-03-two-agent-questions` ao final — a partir desse ponto os números são reproduzíveis também no checkout principal.

## Fixed Issues

### WR-01: `lens` não é restaurado ao recarregar o estado da sessão do banco

**Files modified:** `backend/app/services/pipeline.py`
**Commit:** `350c7b1`
**Applied fix:** Adicionado `lens=f.get("lens")` na reconstrução de `RedFlag(...)` (linha ~511-519) e `lens=q.get("lens")` na reconstrução de `Question(...)` (linha ~528-540) dentro de `_send_initial_state()`. Ambos os dataclasses (`RedFlag`, `Question` em `session_state.py`) já aceitavam `lens` como campo opcional — só faltava passá-lo no reload a partir do Supabase. Verificado: Tier 1 (releitura das linhas alteradas), Tier 2 (`python -c "import ast; ast.parse(...)"` — sintaxe OK) e suíte completa de testes (37/37 passando).

### WR-02: trava de dedup normalizado (D-17) bloqueia para sempre perguntas que só expiraram por TTL

**Files modified:** `backend/app/services/pipeline.py`
**Commit:** `c00548e`
**Applied fix:** `existing_normalized` agora exclui perguntas com `status == "dismissed"` do conjunto de dedup (em `_run_single_planner`). Como o projeto não distingue hoje "rejeitada manualmente pelo usuário" de "expirou por TTL sem interação" (ambas usam o mesmo status `dismissed` — inclusive `_expire_due_questions` grava exatamente esse valor), a opção segura recomendada pelo review foi aplicada: nenhuma das duas fica banida do dedup pelo resto da sessão. Introduzir um status `expired` distinto seria uma mudança de contrato maior (enum de status, frontend, banco) — fora do escopo desta correção pontual. Comentário no código documenta a limitação. Verificado: Tier 1, Tier 2 (sintaxe OK) e suíte completa (37/37 passando, nenhum teste dependia do comportamento anterior).

### WR-04: a lente do red flag não chega ao relatório final — tagging incompleto ponta a ponta

**Files modified:** `backend/app/services/pipeline.py`
**Commit:** `a05478b`
**Applied fix:** Incluído `"lens": rf.lens` no dict `red_flags_raw` construído em `_run_report_generator()`. Confirmado que `llm_service.generate_report()` consome a lista via `.get(...)` por chave específica (`severity`, `text`, `evidence`) — a chave extra `lens` não quebra nada hoje. **Não foi alterado** o prompt do `ReportGenerator` (`DiscoveryPromptBuilder.build_report_generator()`) para instruir agrupamento por lente na seção "## Riscos e Alertas" — essa parte do fix sugerido pelo review é explicitamente opcional ("opcionalmente, instruir...") e envolve mudança de comportamento do prompt (risco de regressão na qualidade do relatório gerado por LLM), então foi deixada de fora desta correção pontual de dados. Se o time quiser o agrupamento visual por lente no relatório, isso deve ser uma mudança separada e testada com o LLM real. Verificado: Tier 1, Tier 2 (sintaxe OK) e suíte completa (37/37 passando).

## Skipped Issues

### WR-03: `pipeline.py` executa queries Supabase diretamente no service — viola a regra de arquitetura do CLAUDE.md

**File:** `backend/app/services/pipeline.py` (múltiplos pontos, ex.: linhas 236-244, 288-295, 380-389, 619-627)
**Reason:** Skipped por instrução explícita do orquestrador desta corrida de fix, alinhada com a regra de conduta do próprio CLAUDE.md ("Nunca misture correção crítica com refator no mesmo commit"). O próprio review classifica esse item como "refator de escopo maior" e recomenda "registrar como item de débito técnico a ser planejado separadamente (não misturar com a correção de bugs pontuais acima)". Extrair `SessionRepository`/`QuestionRepository`/`RedFlagRepository` toca praticamente todos os métodos de `SessionPipeline`/`PipelineManager` (743 linhas) e é uma mudança estrutural, não um bug pontual — deve ser planejada como task própria (com as 7 seções obrigatórias do CLAUDE.md: o que muda, como, riscos, prevenção, rollback, decisões do time, verificação ponta a ponta) antes de ser executada.
**Original issue:** `pipeline.py` chama `db.table(...).insert()/update()/select()` diretamente dentro de `SessionPipeline` e `PipelineManager`, violando "Sem queries SQL/Supabase em services" do CLAUDE.md. O padrão de repositório já existe no projeto (`backend/app/repositories/pricing_repository.py`) mas nunca foi aplicado ao pipeline do Agente Diagnóstico.

---

_Fixed: 2026-09-22T13:45:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
