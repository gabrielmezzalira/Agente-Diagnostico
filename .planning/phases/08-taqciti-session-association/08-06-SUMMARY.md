---
phase: 08-taqciti-session-association
plan: 06
subsystem: backend-pipeline
status: complete
tags: [backend, fastapi, asyncio, lock, concurrency, tdd, pytest, webhook, pydantic]

requires:
  - phase: 08-taqciti-session-association
    provides: "contexto da Fase 8 (envio em partes D-10 e reenvio D-18 mandam chunks em rajada)"
provides:
  - "PipelineManager.get_or_create com asyncio.Lock por session_id e nova checagem após adquirir: chunks concorrentes da mesma reunião criam um único pipeline (T-08-09, Pitfall 5b)"
  - "PipelineManager._build_pipeline: o corpo original do get_or_create, extraído sem alteração"
  - "Prova automatizada (A1) de que POST /webhook/extension aceita e ignora um chunk_id extra, insumo da decisão B3"
affects: [08-09, 08-10, 08-20]

actuals:
  tokens: 3300
  tasks: 2
  commits: 3

plan_head_before: bbf14e876930902096c623649aed08857af9b391
plan_head_after: 10bcd9123566f6a150b7ade6356a1f95e01bed4b

tech-stack:
  added: []
  patterns:
    - "Lock por chave (dict de asyncio.Lock por session_id) para serializar só a criação do recurso da mesma sessão, sem bloquear sessões diferentes"
    - "Extração do corpo para _build_pipeline em vez de reindentar 100+ linhas dentro de async with: diff mínimo e correção separada de refator"
    - "Testes puros com fakes de db/llm e monkeypatch de SessionPipeline.start, sem conftest.supabase_client nem .env"

key-files:
  created:
    - backend/tests/test_pipeline_get_or_create_lock.py
    - backend/tests/test_extension_chunk_extra_fields.py
  modified:
    - backend/app/services/pipeline.py

key-decisions:
  - "O corpo de get_or_create foi movido sem nenhuma alteração para _build_pipeline e o get_or_create virou o invólucro com o lock: evita reindentar o método inteiro (diff de 21 linhas em vez de ~110) e mantém a correção separada de refator"
  - "A entrada de self._locks só é removida quando nada foi registrado (sessão inexistente/encerrada) e em stop_session; com pipeline registrado o lock permanece até o stop"
  - "A suposição A1 foi provada sem mudar produção: chunk_id extra é aceito e ignorado hoje; a decisão B3 (usar ou não chunk_id para idempotência) continua com o time (plano 08-09)"

patterns-established:
  - "Quem esperou o lock reaproveita o pipeline já registrado pela primeira chamada (checagem repetida dentro do lock)"

requirements-completed: [TAQ-02]

coverage:
  - id: D1
    description: "Duas chamadas concorrentes de get_or_create para a mesma sessão devolvem o mesmo pipeline, com um único start, um único registro e uma única consulta à tabela sessions"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "backend/tests/test_pipeline_get_or_create_lock.py#test_concurrent_calls_same_session_create_single_pipeline"
        status: pass
    human_judgment: false
  - id: D2
    description: "O lock é por session_id: com a sessão A presa no LLM, a sessão B termina sem esperar"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "backend/tests/test_pipeline_get_or_create_lock.py#test_concurrent_calls_different_sessions_do_not_block"
        status: pass
    human_judgment: false
  - id: D3
    description: "Sessão encerrada com allow_finished=True continua devolvendo pipeline de uso único (load_state_only), sem registrar em _pipelines e sem start; sessão inexistente devolve None sem deixar lock sobrando"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "backend/tests/test_pipeline_get_or_create_lock.py#test_finished_session_allow_finished_is_single_use"
        status: pass
      - kind: unit
        ref: "backend/tests/test_pipeline_get_or_create_lock.py#test_unknown_session_returns_none_and_leaves_no_lock"
        status: pass
    human_judgment: false
  - id: D4
    description: "ExtensionChunk aceita e ignora um campo extra chunk_id, e extension_webhook só grava session_id, speaker e text no banco (evidência da suposição A1 para a decisão B3)"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "backend/tests/test_extension_chunk_extra_fields.py"
        status: pass
    human_judgment: false
---

# Phase 8 Plan 06: Lock por sessão no PipelineManager Summary

**`asyncio.Lock` por `session_id` em `PipelineManager.get_or_create` fecha a corrida que criava dois pipelines (e tarefas órfãs chamando o Gemini) quando dois chunks da mesma reunião chegavam juntos, mais a prova automatizada de que o webhook atual tolera um `chunk_id` extra.**

## Performance

- **Duração:** ~5 min (início 2026-10-12T03:28Z, fim 03:33Z)
- **Tarefas:** 2 de 2
- **Arquivos:** 3 (1 de produção alterado, 2 testes novos)

## Accomplishments

- Antes do conserto, o teste de concorrência provou a corrida: duas chamadas simultâneas para a mesma sessão devolviam dois objetos `SessionPipeline` diferentes e chamavam `start` duas vezes.
- Agora a segunda chamada espera a primeira terminar de montar o pipeline e reaproveita o mesmo. Sessões diferentes continuam independentes (lock por chave).
- O caminho `allow_finished=True` para sessão encerrada segue igual: pipeline de uso único, sem registro e sem `start`.
- O time tem evidência de que mandar `chunk_id` hoje não quebra o webhook, e de que ele ainda é ignorado (não chega ao banco). A decisão B3 continua aberta, no plano 08-09.

## Task Commits

1. **Task 1, RED:** `dc938e3` test(08-06): RED da concorrência do get_or_create (pipeline duplicado)
2. **Task 1, GREEN:** `2832c46` feat(08-06): lock por sessão no PipelineManager.get_or_create
3. **Task 2:** `10bcd91` test(08-06): prova que ExtensionChunk tolera e ignora chunk_id extra

Não houve commit de REFACTOR (nada a limpar). Os commits de produção e de teste ficaram separados, como pede o CLAUDE.md (correção ≠ refator).

### RED (Task 1)

- **Teste:** `tests/test_pipeline_get_or_create_lock.py` (4 casos).
- **Resultado do RED:** 2 falhas dos 4 casos, nos alvos certos. `test_concurrent_calls_same_session_create_single_pipeline` falhou em `assert first is second` com `start == 2` (a corrida real); `test_unknown_session_returns_none_and_leaves_no_lock` falhou com `AttributeError: ... no attribute '_locks'`. Os outros dois (sessões diferentes e sessão encerrada) passaram já no RED porque descrevem comportamento que o código antigo já tinha e que o lock não pode quebrar (guarda de regressão).
- **Avaliação semântica:** o alvo principal executou e falhou exatamente na asserção planejada (dois pipelines distintos), sem erro de import, fixture ou sintaxe. O plano é `type: execute` (não `type: tdd`), então o classificador `check tdd-red-evidence` não foi exigido.

## Files Created/Modified

- `backend/app/services/pipeline.py` (modificado, +21 linhas): `PipelineManager._locks`, `get_or_create` como invólucro com o lock, `_build_pipeline` (corpo original intacto), `self._locks.pop` em `stop_session`.
- `backend/tests/test_pipeline_get_or_create_lock.py` (novo): 4 casos com fakes de db/llm.
- `backend/tests/test_extension_chunk_extra_fields.py` (novo): 3 casos (validação com `chunk_id`, sem `chunk_id`, e chamada direta de `extension_webhook`).

## Decisions Made

Ver `key-decisions` no frontmatter. A principal: extrair o corpo para `_build_pipeline` em vez de reindentá-lo dentro do `async with`. O resultado é o mesmo comportamento pedido pelo plano (o corpo roda dentro do lock, com nova checagem depois de adquirir) com um diff de 21 linhas, dentro do teto de 25 do critério de aceitação.

## Deviations from Plan

### Ajuste de forma (não de comportamento)

**1. [Ajuste de implementação] Corpo extraído para `_build_pipeline` em vez de indentado dentro do lock**
- **Found during:** Task 1
- **Issue:** o plano diz que "o corpo atual de get_or_create passa a rodar dentro do lock". Indentar o corpo (~110 linhas) estouraria o teto de "no máximo 25 linhas adicionadas" do critério de aceitação e criaria um diff enorme só de espaços, misturando correção com mudança de forma.
- **Fix:** o corpo foi movido literalmente para `_build_pipeline(session_id, allow_finished)` e `get_or_create` o chama dentro de `async with lock:`. O comportamento é idêntico ao descrito no plano.
- **Files modified:** `backend/app/services/pipeline.py`
- **Commit:** `2832c46`

**Total de desvios:** 1 (ajuste de forma, sem mudança de comportamento ou de contrato). **Impacto:** nenhum além do diff menor.

## Issues Encountered

Nenhum. O arquivo `pipeline.py` usa finais de linha CRLF; a edição foi feita preservando CRLF para não gerar um diff de quebras de linha.

## Authentication Gates

Nenhum.

## Known Stubs

Nenhum. Os arquivos criados ou alterados não têm placeholders, valores vazios ligados à UI nem dados simulados fora dos fakes de teste.

## Threat Flags

Nenhum. Nenhuma superfície nova: nenhum endpoint, caminho de auth ou acesso a arquivo foi adicionado. T-08-09 (pipelines duplicados) mitigado pelo lock por sessão + teste de concorrência. T-08-SC: `backend/requirements.txt` sem diff.

## Riscos conhecidos e aceitos (do plano)

- **`stop_session` concorrente com `get_or_create`:** um `get_or_create` em andamento pode registrar o pipeline logo depois de um `stop_session`. O `stop_session` é idempotente (coberto por `test_finish_stops_pipeline.py`, verde), e o fluxo normal encerra a sessão antes de novos chunks.
- **Pitfall 5a:** o `insert` síncrono do supabase-py dentro de `async def` bloqueia o event loop por chunk; a mitigação desta fase é o envio serial com pausa (plano 08-05). Trocar por `asyncio.to_thread` fica para outra discussão.

## Verification

- `python -m pytest tests/test_pipeline_get_or_create_lock.py tests/test_extension_chunk_extra_fields.py tests/test_finish_stops_pipeline.py tests/test_webhook_auth.py -q`: 16 passed.
- `python -m pytest tests/test_pipeline_get_or_create_lock.py tests/test_finish_stops_pipeline.py tests/test_readiness_route.py -q`: 11 passed.
- `git diff --stat bbf14e8 HEAD -- backend/app`: só `pipeline.py` (+21); o commit da Task 2 não toca `backend/app/`.
- `backend/requirements.txt` sem diff.

## Next Phase Readiness

Backend pronto para a rajada do envio em partes (08-10, 08-20). A decisão B3 (usar ou não `chunk_id` para idempotência) segue com o time no plano 08-09; este plano deixa a evidência de que o campo extra é tolerado hoje.

## Self-Check: PASSED

- FOUND: backend/tests/test_pipeline_get_or_create_lock.py
- FOUND: backend/tests/test_extension_chunk_extra_fields.py
- FOUND: backend/app/services/pipeline.py (com `self._locks` e `async with lock`)
- FOUND commits: dc938e3, 2832c46, 10bcd91
