---
phase: 08-taqciti-session-association
plan: 09
subsystem: backend-webhook
status: complete
tags: [backend, fastapi, webhook, idempotency, supabase, migration, postgrest, tdd, pytest]

requires:
  - phase: 08-taqciti-session-association
    provides: "08-06: prova (A1) de que o webhook aceitava chunk_id extra; lock por sessão no pipeline"
provides:
  - "Migração 20261011000000: coluna transcript_chunks.chunk_id text + índice único ux_transcript_chunks_session_chunk (session_id, chunk_id), APLICADA em produção em 2026-10-12"
  - "TranscriptChunksRepository.insert_chunk(session_id, text, speaker, chunk_id=None) -> bool (False em 23505; outros erros relançados)"
  - "POST /webhook/extension idempotente: chunk_id já gravado -> 202 sem push_chunk; sem chunk_id o comportamento é o de antes; /webhook/recall intocado"
affects: [08-19, 08-21, 08-23]

actuals:
  tokens: 3500
  tasks: 3
  commits: 2

plan_head_before: d5ef1fef9756643738ac19c5163d114d81cd2883
plan_head_after: d919e4c1371b4e5e99455a31150acb0fdb52e5a1

tech-stack:
  added: []
  patterns:
    - "Repositório extraído em commit de refator puro, comportamento (migração + dedup) em commit separado"
    - "Duplicata detectada pelo próprio índice único (SQLSTATE 23505), sem consulta prévia: sem corrida entre checar e gravar"
    - "Chave chunk_id só entra na linha quando preenchida: clientes antigos e o recall gravam como antes"

key-files:
  created:
    - supabase/migrations/20261011000000_add_chunk_id_to_transcript_chunks.sql
    - backend/app/repositories/transcript_chunks_repository.py
    - backend/tests/test_webhook_idempotency.py
  modified:
    - backend/app/routers/webhook.py
    - backend/tests/test_extension_chunk_extra_fields.py

key-decisions:
  - "B3-a = aprovar-chunk-id: dedup por (session_id, chunk_id) com índice único; só 23505 vira 'duplicata', qualquer outro erro é relançado (nada de perda silenciosa)"
  - "B3-b = retirada-nunca e B3-c = 404-depois (padrões, sem resposta do time): o webhook continua sem tratar erro de banco (500) e sem 404 para sessão inexistente"
  - "chunk_id como text de até 200 caracteres (suposição A7), 422 acima disso"

requirements-completed: [TAQ-02]

coverage:
  - id: D1
    description: "Mesmo chunk_id duas vezes em POST /webhook/extension resulta em uma gravação e um único push_chunk; a repetição responde 202"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "backend/tests/test_webhook_idempotency.py#test_webhook_same_chunk_id_twice_pushes_once"
        status: pass
      - kind: unit
        ref: "backend/tests/test_webhook_idempotency.py#test_webhook_duplicate_chunk_id_returns_202_without_push"
        status: pass
    human_judgment: false
  - id: D2
    description: "insert_chunk devolve False só em 23505 e relança outros códigos; a chave chunk_id só vai na linha quando preenchida"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "backend/tests/test_webhook_idempotency.py#test_insert_chunk_returns_false_on_unique_violation"
        status: pass
      - kind: unit
        ref: "backend/tests/test_webhook_idempotency.py#test_insert_chunk_reraises_other_database_errors"
        status: pass
      - kind: unit
        ref: "backend/tests/test_webhook_idempotency.py#test_insert_chunk_without_chunk_id_omits_the_key"
        status: pass
    human_judgment: false
  - id: D3
    description: "chunk_id é opcional e limitado a 200 caracteres no contrato do webhook"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "backend/tests/test_webhook_idempotency.py#test_extension_chunk_chunk_id_is_optional_and_capped_at_200"
        status: pass
    human_judgment: false
  - id: D4
    description: "Migração aplicada no Supabase de produção com coluna e índice conferidos, linhas antigas intactas"
    requirement: TAQ-02
    verification: []
    human_judgment: true
    rationale: "Ação externa ao repositório, conferida pelas consultas da Task 3 (ver seção abaixo); a dedup real contra o Supabase (suposição A2) é provada no teste manual D-20 (b)."
---

# Phase 8 Plan 09: webhook idempotente por chunk_id Summary

**Webhook da extensão idempotente por `chunk_id`: migração aditiva (coluna `text` + índice único `(session_id, chunk_id)`) aplicada em produção, `TranscriptChunksRepository` que reconhece duplicata via SQLSTATE 23505 e `POST /webhook/extension` que responde 202 sem reprocessar uma fala reenviada.**

## Decisão B3

Registrada em 2026-10-12, antes de qualquer código. Respostas literais do time (fonte: `08-DECISOES-PENDENTES.md`, item 3):

- **B3-a:** `aprovar-chunk-id` (2026-10-12). Palavras do usuário: "aprovar-chunk-id e te autorizo explicitamente para fazer o migration".
- **B3-b:** sem resposta do time -> padrão `retirada-nunca` (D-18 literal: nunca desistir de uma fala por HTTP 500). O 08-23 lê este registro antes de implementar a regra.
- **B3-c:** sem resposta do time -> padrão `404-depois`. Pendência com dono (quem conduz a fase): registrar no 08-21 para revisitar no cutover do extension antigo (Fase 9). Hoje `session_id` inexistente continua virando 500.

> **LEMBRETE OBRIGATÓRIO: TEM QUE CRIAR `GEMINI_API_KEY` NO RAILWAY** antes de qualquer deploy, merge na `master`/`main` ou junção com o AGM (B2 = `aprovar-sem-env`).

**Ordem de rollout:** migração (FEITA em 2026-10-12) -> deploy do backend -> build da Taqciti (plano 08-19). O código do webhook depende da coluna; o deploy do backend ainda não foi feito.

## O que foi feito

- **Task 1 (checkpoint:decision B3):** já respondida pelo time; registrada acima antes de qualquer código.
- **Task 2a, commit `2dce313` (refactor puro):** o `insert` direto de `extension_webhook` foi para `TranscriptChunksRepository.insert_chunk` (sem mudar o que é gravado). `test_extension_chunk_extra_fields.py` passou sem alteração antes e depois.
- **Task 2b, commit `d919e4c` (comportamento):**
  - Migração `supabase/migrations/20261011000000_add_chunk_id_to_transcript_chunks.sql`: `ADD COLUMN IF NOT EXISTS chunk_id text`, `CREATE UNIQUE INDEX IF NOT EXISTS ux_transcript_chunks_session_chunk`, `COMMENT ON COLUMN`.
  - `ExtensionChunk.chunk_id: str | None = Field(default=None, max_length=200)`.
  - `insert_chunk(..., chunk_id=None) -> bool`: só inclui a chave quando preenchida; `APIError` com `code == "23505"` devolve `False`, outros códigos são relançados.
  - `extension_webhook`: `False` -> `{"accepted": True}` sem `asyncio.create_task(push_chunk(...))`.
  - Testes: `test_webhook_idempotency.py` (novo, 10 casos) e `test_extension_chunk_extra_fields.py` atualizado ao contrato novo.
- **Task 3 (checkpoint:human-action, ver abaixo):** migração aplicada em produção e conferida.

## Task 3 — migração aplicada em produção

- **Data:** 2026-10-12.
- **Quem aplicou:** o orquestrador (Claude, sessão principal), por autorização explícita do usuário ("aprovar-chunk-id e te autorizo explicitamente para fazer o migration"). O executor não aplicou, não leu `.env` e não pediu token.
- **Opção usada:** conector Supabase (`apply_migration`), nem a Opção A (SQL Editor) nem a B (`supabase db push`) do roteiro; equivalente à A, sem credenciais expostas. Projeto "Agente-Diagnostico" (id `fzvwtkipzxdnubprvfct`, o projeto do app, com `transcript_chunks` de 1562 linhas). Nome da migração registrada: `add_chunk_id_to_transcript_chunks`. SQL exato do arquivo da migração. Resultado: `success=true`.
- **Consultas de conferência, rodadas logo depois:**
  1. Coluna: `chunk_id` / `text` (1 linha, como esperado).
  2. Índice: `ux_transcript_chunks_session_chunk` (1 linha, como esperado).
  3. Linhas com `chunk_id` nulo: **1562**.
  4. Total de linhas: **1562** (iguais: linhas antigas intactas).

## Verificação

- `cd backend && python -m pytest tests/test_webhook_idempotency.py tests/test_extension_chunk_extra_fields.py tests/test_webhook_auth.py -x -q` -> **16 passed in 0.89s**. Os testes novos falharam antes da implementação (RED: 10 failed, 2 passed) e passaram depois.
- Semente do plano: `test_webhook_same_chunk_id_twice_pushes_once` (mesmo `chunk_id` duas vezes -> um `push_chunk`).
- `grep -c "CREATE UNIQUE INDEX IF NOT EXISTS ux_transcript_chunks_session_chunk"` na migração -> 1.
- `insert_chunk` dentro de `recall_webhook` -> 0 (recall intocado).
- `requirements.txt` sem diff (nenhum pacote novo; `postgrest` já vem com supabase-py).
- Suíte completa do backend: 136 passed, 4 skipped, 1 failed (`tests/test_schema.py::test_tables_exist`, ver Itens adiados).

## Deviations from Plan

None - plan executed exactly as written.

Observação, sem mudança de comportamento: além do caso 3, os casos 1 e 2 de `test_extension_chunk_extra_fields.py` também foram atualizados, porque o `model_dump()` agora inclui `chunk_id: None` e o campo deixou de ser "ignorado". O plano pedia só o caso 3; a atualização decorre do contrato novo.

## Itens adiados / pendências

- `backend/tests/test_schema.py::test_tables_exist` falha com `PGRST205` ("Could not find the table 'public.information_schema.tables'"): o teste consulta o Supabase real e não toca nada deste plano. Fora do escopo; não corrigido.
- **B3-c (`404-depois`):** registrar a pendência do 404 no 08-21 (dono: quem conduz a fase).
- **Suposição A2** (`APIError.code == "23505"` num insert real): o código `.code` existe em `postgrest.exceptions.APIError`, conferido; a prova contra o Supabase real fica para o teste manual D-20 (b) (derrubar o Agente durante uma reunião, religar e conferir que nenhuma fala ficou duplicada).
- O 08-19 (Taqciti passa a mandar `chunk_id`) só executa com a Task 3 concluída, o que já está cumprido.

## Known Stubs

None.

## Threat Flags

None - o único novo ponto de superfície (índice único em `transcript_chunks`) está coberto por T-08-15/T-08-16 do plano.

## Next Phase Readiness

Pronto para o 08-19 e o 08-23 (que lê a seção "Decisão B3"). Antes de qualquer deploy: criar `GEMINI_API_KEY` no Railway.

## Self-Check: PASSED
