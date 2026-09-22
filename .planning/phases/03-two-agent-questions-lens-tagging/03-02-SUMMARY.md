---
phase: 03-two-agent-questions-lens-tagging
plan: 02
subsystem: database
tags: [supabase, migration, pydantic, lens, discovery]

requires:
  - phase: 02-discovery-mode
    provides: mode discovery + DiscoveryPromptBuilder (as sessões discovery que gravam lens)
provides:
  - "Colunas questions.lens e red_flags.lens (text nullable) no Supabase"
  - "COMMENT ampliando session_prompts.agent para question_planner_produto/dados"
  - "Campo lens: Optional[str] = None em QuestionResponse (API expõe a lente persistida)"
affects: [03-01, 03-03, 04-discovery-report]

actuals:
  tokens: 3500
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns: ["Migration aditiva nullable sem DEFAULT/CHECK (validação de enum no código, padrão do repo)"]

key-files:
  created: ["supabase/migrations/20260922000000_add_lens_tagging.sql"]
  modified: ["backend/app/models/questions.py"]

key-decisions:
  - "Colunas lens como text nullable, sem DEFAULT e sem CHECK (decisão humana Task 1) — segue o padrão das demais colunas enum-like do repo; validação fica no código (D-22)"
  - "session_prompts.agent ampliado só via COMMENT — coluna é text NOT NULL sem enum nativo, dispensa ALTER TYPE (D-23)"

patterns-established:
  - "Migration de lente: aditiva/idempotente, NULL no sales e em linhas antigas, sem backfill (D-18/D-24)"

requirements-completed: [LENS-03, LENS-04]

coverage:
  - id: D1
    description: "Colunas questions.lens e red_flags.lens criadas no Supabase (text nullable)"
    requirement: "LENS-03"
    verification:
      - kind: manual_procedural
        ref: "Supabase SQL Editor: SELECT ... FROM information_schema.columns WHERE column_name='lens' → 2 linhas (questions, red_flags)"
        status: pass
    human_judgment: false
  - id: D2
    description: "QuestionResponse expõe lens: Optional[str] = None para a API devolver a lente persistida"
    requirement: "LENS-04"
    verification:
      - kind: unit
        ref: "python -c \"from app.models.questions import QuestionResponse; assert 'lens' in QuestionResponse.model_fields\" → LENS_FIELD_OK"
        status: pass
    human_judgment: false

duration: ~10min
completed: 2026-09-22
status: complete
---

# Phase 03 · Plano 02: Modelo de dados da lente

**Migration aditiva única cria `questions.lens` e `red_flags.lens` (text nullable, sem DEFAULT/CHECK) e o campo `lens` em `QuestionResponse`, sustentando a persistência da lente Produto/Dados do discovery sem tocar no sales.**

## Performance

- **Tasks:** 3 (1 decisão humana, 1 código, 1 aplicação manual)
- **Files modified:** 2 (1 criado, 1 modificado)
- **Commits:** 2

## Accomplishments
- Migration `20260922000000_add_lens_tagging.sql`: `ADD COLUMN IF NOT EXISTS lens text` em `questions` e `red_flags`; `COMMENT` documentando os dois novos valores de `session_prompts.agent`.
- `QuestionResponse.lens: Optional[str] = None` (mesmo padrão do campo `block`).
- Migration aplicada e confirmada no Supabase (2 colunas presentes; linhas antigas/sales com `lens` NULL).

## Task Commits

1. **Task 1: decisão do formato da coluna (checkpoint humano)** — sem commit (decisão: `text-nullable`)
2. **Task 2: migration + campo lens no QuestionResponse** — `e8295dd` (feat)
   - fix do verify NO_DEFAULT_NO_ALTERTYPE robusto a comentários — `383b0c1` (docs)
3. **Task 3: aplicar migration ao Supabase (checkpoint humano)** — sem commit (aplicado via SQL Editor, confirmado)

## Files Created/Modified
- `supabase/migrations/20260922000000_add_lens_tagging.sql` — migration aditiva das colunas lens + COMMENT
- `backend/app/models/questions.py` — campo `lens` em `QuestionResponse`

## Decisões Made
- Task 1 (humano): `text-nullable` sem DEFAULT/CHECK — padrão do repo, validação de valor no código.

## Deviations from Plan
Uma auto-correção: o verify negativo `NO_DEFAULT_NO_ALTERTYPE_OK` (adicionado no review) dava falso positivo porque casava a string "ALTER TYPE" nos próprios comentários da migration. Ajustado para ignorar linhas de comentário (`--`) antes do grep. Sem mudança na migration em si.

## Issues Encountered
None além do falso positivo do verify acima, já resolvido.

## User Setup Required
Concluído nesta execução: o humano aplicou a migration no Supabase Dashboard → SQL Editor e confirmou as 2 colunas via `information_schema`.

## Next Phase Readiness
- Substrato de persistência pronto: `03-01` e `03-03` podem gravar `lens` em `questions`/`red_flags` contra o banco real.
- A lente ao vivo (WebSocket) e o split por lente são entregues em `03-01`/`03-03`.

---
*Phase: 03-two-agent-questions-lens-tagging · plano 02*
*Completed: 2026-09-22*
