---
phase: 08-taqciti-session-association
plan: 15
subsystem: backend-extension-routes + pipeline-manager
status: complete
tags: [backend, fastapi, pydantic, pipeline, asyncio, taqciti, decision-b4b, dependency-injection]

requires:
  - phase: 08-taqciti-session-association
    provides: "08-07: ExtensionRepository/ExtensionSessionService/extension_clients.py + gate verify_extension_key (B1); 08-12: rota POST /clients; 08-06: lock por sessão no PipelineManager.get_or_create"
provides:
  - "POST /webhook/extension/sessions/{session_id}/finish: encerra só sessão source 'extension' (active -> finished com compare-and-set) e para o pipeline em memória; sob o gate x-agente-key"
  - "Idempotência: sessão já finished responde 200 sem regravar e chama stop_session de novo (repara finish que gravou e falhou ao parar); 404 inexistente; 409 outra origem ou status diferente de active/finished"
  - "ExtensionSessionService(repo, pipeline_stopper=None): parador injetado por construtor; padrão = adaptador com import tardio do singleton pipeline_manager"
  - "PipelineManager.stop_session espera a criação em andamento (mesmo lock do get_or_create): sem pipeline órfão sobre sessão encerrada"
affects: [08-16, 08-24, 08-25, 08-26, 08-27, 08-21]

actuals:
  tokens: 4505
  tasks: 3
  commits: 2

plan_head_before: 5cf258122a63c27ee88d9ac8a210c6a5f6842e23
plan_head_after: 80ebad1d56de5e8654c8dbe8869ca2fc6546d781

tech-stack:
  added: []
  patterns:
    - "Encerramento em camadas: router (só roteia, sem db.table) -> ExtensionSessionService.finish_session (404/409/idempotência) -> ExtensionRepository (get_session, mark_session_finished com compare-and-set por status = active)"
    - "Dependency Inversion: porta PipelineStopper (Protocol) injetada no service; os testes passam um parador falso, sem monkeypatch no singleton"
    - "stop_session adquire e solta o lock da sessão antes de retirar o pipeline (espera uma criação em andamento sem segurar o lock durante o stop)"

key-files:
  created: []
  modified:
    - backend/app/models/extension.py
    - backend/app/repositories/extension_repository.py
    - backend/app/services/extension_session_service.py
    - backend/app/routers/extension_clients.py
    - backend/app/services/pipeline.py
    - backend/tests/test_extension_clients.py
    - backend/tests/test_pipeline_get_or_create_lock.py

key-decisions:
  - "B4-b consolidada registrada como já respondida (sem nova parada); a recomendação antiga de 10 min do RESEARCH está superada"
  - "finish grava finished PRIMEIRO e só depois chama stop_session; falha do stop vai só para o log (mesmo padrão do finish do web app)"
  - "Compare-and-set perdido (outra chamada encerrou no meio) é tratado como sessão já encerrada: 200 e stop_session chamado"
  - "stop_session sem lock existente continua exatamente como antes (sem espera)"

requirements-completed: []

coverage:
  - id: D1
    description: "POST /webhook/extension/sessions/{id}/finish grava finished só em sessão extension active, é idempotente, 404/409 sem efeito colateral, atrás do gate x-agente-key, sem acesso direto ao banco no router"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "backend/tests/test_extension_clients.py#test_finish_active_extension_session_writes_and_stops_pipeline"
        status: pass
      - kind: unit
        ref: "backend/tests/test_extension_clients.py#test_finish_already_finished_is_idempotent_and_still_stops_pipeline"
        status: pass
      - kind: unit
        ref: "backend/tests/test_extension_clients.py#test_finish_other_source_or_status_is_409_without_side_effects"
        status: pass
      - kind: unit
        ref: "backend/tests/test_extension_clients.py#test_finish_route_is_gated_and_has_response_model"
        status: pass
  - id: D2
    description: "stop_session espera a criação do pipeline em andamento; sessões diferentes não se bloqueiam; stop idempotente; sem recriar pipeline depois do stop"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "backend/tests/test_pipeline_get_or_create_lock.py#test_stop_session_waits_for_creation_in_progress"
        status: pass
      - kind: unit
        ref: "backend/tests/test_pipeline_get_or_create_lock.py#test_stop_session_does_not_wait_for_other_session_creation"
        status: pass
---

# Phase 8 Plan 15: Rota de finish da extensão e correção da corrida do stop_session — Summary

Rota `POST /webhook/extension/sessions/{id}/finish` (gate `x-agente-key`, idempotente, compare-and-set, só `source == 'extension'`) com o parador de pipeline injetado por construtor, mais a correção de `PipelineManager.stop_session` para esperar a criação em andamento — em dois commits separados.

## Decisão B4-b (respondida em 2026-10-12)

Registro (Task 1, sem código e sem nova pergunta ao time). Transcrito literalmente de `08-DECISOES-PENDENTES.md`, seção "4. B4-b":

- **Resposta B4-b:** AJUSTE da opção `sw-com-alarms` (2026-10-12), palavras do usuário: "encerra a sessão na hora que a call acaba" (sem a espera de 10 minutos; motivo: custo de IA ocioso depois da call).
- **Aceita o resíduo "Envio parou"? (sim/não):** **NÃO** (2026-10-12). Palavras do usuário: "não aceito. espera de 5 minutos." Ou seja: se o envio em partes parar (fila não esvazia) a Taqciti encerra a sessão mesmo assim depois de 5 minutos parado (limite de segurança contra o custo de IA ocioso).
- **Reentrar na mesma sala depois do encerramento (2026-10-12):** `sim` — vira reunião nova (nova associação pendente e nova sessão), em vez de retomar a sessão encerrada.
- **DA-1 (08-24):** `reuniao-nova-de-verdade`. **DA-2 (08-20):** `continuar-com-aviso`. **DA-3 (aba fechada no meio da call):** `fechar-aba-encerra` (plano 08-26).
- **B4-b consolidada:** `sw-com-alarms` AJUSTADA: (1) encerrar na hora que a call acaba, com a fila de envio vazia; (2) com envio parado/fila não vazia, encerrar após 5 min; (3) reentrada na mesma sala depois de encerrada = reunião nova.
- A recomendação antiga do RESEARCH (esperar 10 min, Pitfall 1 / Open Question 1) está **superada** por esta decisão.

Pré-condições conferidas: "B4-b consolidada" presente em `08-DECISOES-PENDENTES.md` (1 ocorrência); `aprovar-recomendado` em `08-07-SUMMARY.md` (2 ocorrências, B1 aprovada); os três arquivos do 08-07/08-12 existem. Quem trata o resíduo "Envio parou" (5 min) é a Taqciti (08-27/08-25); este plano só fornece a rota.

## O que foi feito

| Task | Commit | O que |
|------|--------|-------|
| 1 | (sem commit próprio; registrado neste SUMMARY) | Registro da B4-b e conferência das pré-condições |
| 2 | `c62edb5` | `feat(08-15)`: modelo `ExtensionSessionFinishResponse`, `ExtensionRepository.get_session` e `mark_session_finished` (compare-and-set), `ExtensionSessionService.finish_session` + porta `PipelineStopper`, rota POST `/sessions/{session_id}/finish`, 12 testes novos em `test_extension_clients.py` |
| 3 | `80ebad1` | `fix(08-15)`: `stop_session` adquire o lock da sessão antes de retirar o pipeline (+8 linhas em `pipeline.py`, limite do plano: 12), 4 testes novos em `test_pipeline_get_or_create_lock.py` |

Feature e correção de corrida ficaram em commits separados, como o plano exige. `sessions.py` (finish do web app) não foi tocado e `get_or_create`/`_build_pipeline` também não.

## Verificação

- `python -m pytest tests/test_extension_clients.py tests/test_finish_stops_pipeline.py tests/test_pipeline_get_or_create_lock.py -q` -> **46 passed**.
- Suíte completa do backend: **152 passed, 4 skipped, 1 failed** — a falha é a pré-existente `tests/test_schema.py::test_tables_exist` (precisa de Supabase real; fora de escopo).
- RED confirmado antes do código: Task 2 falhou na coleta (`ImportError: ExtensionSessionFinishResponse`); Task 3 falhou em `test_stop_session_waits_for_creation_in_progress` (`stop_session` terminava sem esperar).
- `awk` de `db.table` no router -> 0; `git show --name-only HEAD -- sessions.py` logo após o commit da Task 2 -> vazio; `numstat` de `pipeline.py` na Task 3 -> `8 0` (<= 12).
- Manual com Supabase real e o ponta a ponta com a Taqciti ficam para o roteiro D-20 do 08-21 (o executor não abre `.env` nem sobe deploy).

## Deviations from Plan

None - plano executado como escrito. Observações (não são desvios):

- `finish_session` (service e rota) é `async`, como o finish do web app (`sessions.py`), porque chama `stop_session` com `await`; as chamadas ao Supabase dentro dele são síncronas (mesmo padrão já existente). As demais rotas da extensão continuam `def` síncronas.
- Dívida registrada (não bloqueante, do plano): unificar o finish do web app e o da extensão num service comum (refator futuro; comentário no service aponta `sessions.py::finish_session`).
- Limite conhecido (T-08-30, aceito no plano): o web app também grava `source = 'extension'`, então o backend não distingue sessão criada pela Taqciti da criada no web app; quem protege o plano B (ID colado) é a Taqciti, que só encerra origem `picker`.
- `pipeline.py` continua acima de 200 linhas (dívida de tamanho pré-existente); nenhum refator entrou.

## Auth Gates

Nenhum.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum. A superfície nova (rota de finish) é a coberta por T-08-30/T-08-31/T-08-47 do `<threat_model>` do plano; sem pacote novo (`requirements.txt` sem diff, T-08-SC).

## Lembretes obrigatórios (herdados da fase)

> **TEM QUE CRIAR `GEMINI_API_KEY` NO RAILWAY** antes de qualquer deploy, merge na `master`/`main` ou junção com o AGM (resposta B2 = `aprovar-sem-env`). Sem ela, projetos sem chave própria não rodam o pipeline de IA. O executor nunca lê `.env`; nada foi deployado e não houve migração de banco nesta tarefa.

- **Risco T-08-10** (rotas de escrita da extensão abertas enquanto `EXTENSION_SHARED_KEY` não estiver ativa no Railway) continua aceito pelo **Time Antonio até o login do AGM**; a rota de finish herda o mesmo gate opt-in (`verify_extension_key`).
- Rollback: `git revert 80ebad1` (volta à corrida rara do finish durante a criação) e `git revert c62edb5` (remove a rota; sessões já encerradas continuam encerradas). Sem a rota NÃO distribuir a Taqciti dos planos 08-16, 08-27 e 08-25 (o finish daria 404).
- `TAQ-02` NÃO foi marcado como concluído neste plano (instrução do orquestrador: só quando for o último plano que o declara).

## Self-Check: PASSED

- FOUND: backend/app/services/extension_session_service.py (`def finish_session`), backend/app/routers/extension_clients.py (`/sessions/{session_id}/finish`), backend/app/services/pipeline.py (`async def stop_session` com o lock)
- FOUND commits: c62edb5, 80ebad1 (ancestrais de HEAD)
