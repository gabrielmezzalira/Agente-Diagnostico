# Phase 4: Discovery Report + Pricing Handoff - Pattern Map

**Mapped:** 2026-09-22
**Files analyzed:** 10 (8 modified + 2 test-new; migration tratada como variante de arquivo modificado-por-padrão)
**Analogs found:** 10 / 10 (todos os analogs são internos ao próprio repo — nenhum arquivo novo de infraestrutura)

Todos os arquivos desta fase já existem — não há "arquivo novo" no sentido de criar uma pasta/módulo
novo. O padrão da fase inteira é: **cada arquivo é seu próprio melhor analog** (extensão do padrão
`mode`-branch já presente nele), com um segundo analog cruzado para o padrão específico sendo copiado
(sibling builder, migration aditiva, golden test). Por isso a tabela abaixo lista, para cada arquivo,
o trecho do próprio arquivo que já demonstra o padrão de ramificação por `mode`/`lens`, mais o analog
cruzado quando aplicável.

## File Classification

| Arquivo (modificado) | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/app/services/llm.py::generate_report` | service (LLM call) | request-response | próprio arquivo — bloco `citi_block` gated por `mode` (linhas 179-183) | exact (mesmo arquivo, mesmo padrão de gate) |
| `backend/app/services/discovery_prompt_builder.py::build_report_generator` | service (prompt builder, sibling) | request-response | próprio arquivo — `build_question_planner(lens)` (167-241), já particiona por lens | exact |
| `backend/app/services/llm_pricing_service.py::import_from_diagnosis` | service (LangChain, gate de negócio) | request-response | próprio arquivo — bloco `if session_id:` (98-119), já resolve `report` antes da extração | exact |
| `backend/app/services/llm_pricing_service.py` (blocos ampliados, ambos prompts) | service (prompt text) | request-response | próprio arquivo — `system_prompt` de `import_from_diagnosis` (141-154) e de `suggest_features` (256-262) | exact |
| `backend/app/repositories/pricing_repository.py::get_session_report`/`get_project_reports` | repository (Supabase select) | CRUD (read) | próprio arquivo — os dois métodos lado a lado (149-192) | exact |
| `backend/app/routers/sessions.py` (novo `PATCH .../report`) | route | request-response | `PATCH /questions/:id` (padrão de F6, atualiza `status` de sub-recurso por id) — ver `routers/sessions.py` endpoints de report (310-343) como analog de forma/response_model | role-match (endpoint PATCH de status já existe para `questions`, mesmo padrão de validação de `Literal`) |
| `backend/app/routers/sessions.py::upload_pdf_transcript` (D-39 fix) | route (file I/O + orquestração) | file-I/O | próprio arquivo — `generate_session_report`/`pipeline.trigger_report` já propaga `mode` via `SessionState` | exact (o bug é justamente a ausência do padrão que o resto do arquivo já segue) |
| `backend/app/routers/pricings.py::import_from_diagnosis` (endpoint) | route | request-response | sem mudança estrutural nesta fase — gate fica no service (ver Pattern 2 do RESEARCH) | n/a — arquivo não muda de fato |
| `backend/app/services/session_state.py` (readiness, novo método) | service (pure computation) | transform | `estimated_report_cost()` (139-149) — cálculo puro sobre estado já em memória | exact |
| `backend/app/services/coverage_areas.py::by_lens` | service (registry, já pronto) | transform | sem mudança — só consumido | n/a — arquivo não muda |
| `backend/app/services/pipeline.py::_run_report_generator` | service (orquestração) | event-driven | próprio arquivo — `red_flags_raw` já é `list[dict]` com `lens` (442-450); `questions_used` ainda é `list[str]` (439-441, alvo do D-40) | exact (o próprio arquivo tem os dois estilos lado a lado — copiar o de `red_flags_raw` para `questions_used`) |
| `supabase/migrations/<novo>_add_status_to_reports.sql` | migration | batch (DDL) | `supabase/migrations/20260922000000_add_lens_tagging.sql` | exact |
| `backend/tests/test_discovery_report.py` | test | transform/golden | `backend/tests/test_discovery_mode.py` (`_capture_report_user`, monkeypatch de `llm._call`) | exact |
| `backend/tests/test_import_from_diagnosis_gate.py` | test | integration (mock LLM) | `backend/tests/test_two_agent_lens.py` (fixtures de sessão discovery) + `llm_pricing_service.py` estrutura de `import_from_diagnosis` | role-match |

## Pattern Assignments

### `backend/app/services/llm.py::generate_report` (service, request-response)

**Analog:** o próprio arquivo, gate existente por `mode` (linhas 179-183) + uso indevido de
`SALES_AREA_SET.labels()` fixo (linha 121, é o bug apontado por D-28).

**Imports pattern** (linhas 1-8, manter estilo):
```python
import json
import re
from typing import Any, Optional

import google.genai as genai
from google.genai import types as genai_types

from app.services.coverage_areas import SALES_AREA_SET
```
Para o branch discovery, adicionar `DISCOVERY_AREA_SET` ao import acima (não substituir
`SALES_AREA_SET` — sales continua usando ele).

**Gate por `mode` já existente — copiar esta forma exata** (linhas 179-183):
```python
citi_block = (
    f"## Portfólio CITi (referência comercial)\n{CITI_PORTFOLIO}\n\n"
    f"## Catálogo de serviços CITi (referência para sprints)\n{CITI_SERVICE_CATALOG}\n\n"
    f"## Referência de tecnologias\n{CITI_TECH_REFERENCE}\n\n"
) if mode == "sales" else ""
```
Aplicar o mesmo estilo (`if mode == "sales" else ...` / `if mode == "discovery" else ...`) para:
1. escolher `SALES_AREA_SET` vs `DISCOVERY_AREA_SET` na montagem de `area_labels` (linha 121);
2. escolher o `system` prompt fixo atual vs. o novo esqueleto PRD de 16 seções (o esqueleto vive em
   `discovery_prompt_builder.py::build_report_generator`, chamado via `system_prompt` — na prática
   `system_prompt` já é passado por `pipeline.py`/`sessions.py` a partir de `self.state.prompts`, então
   o branch dentro de `generate_report` só precisa do fallback `system_prompt or (...)` continuar
   servindo o sales; o builder discovery é quem monta o PRD).

**Pré-montagem híbrida por lens (D-27) — nova função, seguir o formato de tabela já usado em
`coverage_rows`/`coverage_table` (linhas 123-139)**:
```python
# Adaptar de app/services/llm.py:121-139 — trocar SALES_AREA_SET.labels() fixo
# por DISCOVERY_AREA_SET.by_lens(lens).labels() dentro do branch discovery.
def _coverage_table_for_lens(coverage: dict, lens: str) -> str:
    status_labels = {"covered": "Coberto", "partial": "Parcial", "uncovered": "Não coberto"}
    rows = [
        (info.get("name") or area, status_labels.get(info.get("status", ""), info.get("status", "")),
         info.get("score", 0), info.get("notes", ""))
        for area, info in coverage.items()
        if isinstance(info, dict) and info.get("lens") == lens
    ]
    if not rows:
        return "_Nenhuma área classificada ainda._"
    return (
        "| Área | Status | Score | Observações |\n| --- | --- | --- | --- |\n"
        + "\n".join(f"| {l} | {s} | {sc}% | {n} |" for l, s, sc, n in rows)
    )
```
Nota: `coverage` já chega com `"lens"` embutido por item (via `session_state.coverage_to_dict()`,
linhas 156-173 — ver trecho abaixo) — **filtrar por `info["lens"] == lens` é mais barato** que
recalcular `DISCOVERY_AREA_SET.by_lens(lens)` a cada chamada (RESEARCH.md, "Nota de implementação").

**Error handling pattern:** não há try/except em `generate_report` — erros de parsing/LLM sobem
naturalmente; seguir o mesmo não-tratamento (consistente com o restante do arquivo, `classify_coverage`
e `detect_red_flags` só fazem try/except ao redor do `_parse_json`, não da chamada em si).

**Assinatura `questions_used` (D-40, Pitfall 1):** mudar de `list[str]` para `list[dict]` com
`{"text": ..., "lens": ...}`, no mesmo padrão de `red_flags` (já é `list[dict]` com `lens` — ver
`red_flags_raw` em `pipeline.py:442-450`, reproduzido abaixo). Sales continua recebendo apenas texto
para não quebrar REP-03 — o branch sales pode fazer `q["text"] if isinstance(q, dict) else q` para
aceitar as duas formas durante a transição, OU (mais limpo) sales monta a lista de dicts com
`lens=None` e o prompt sales ignora o campo lens (nunca usa, já que sales não referencia lens em
lugar nenhum do system prompt atual).

---

### `backend/app/services/discovery_prompt_builder.py::build_report_generator` (service, sibling builder)

**Analog:** o próprio arquivo — `build_question_planner(self, lens: str)` (linhas 167-241) já mostra
o padrão de "framing + vocabulário calibrado por DMS + retorno de string longa" que o novo PRD
skeleton deve seguir, só que numa escala maior (16 seções em vez de um parágrafo).

**Estrutura/estilo a copiar** (docstring do módulo, linhas 1-38): manter a disciplina de comentários
que documentam CADA decisão (`D-XX`) inline, e a regra crítica já documentada no topo do arquivo —
**NUNCA importar `CITI_PORTFOLIO`/`CITI_SERVICE_CATALOG`/`CITI_TECH_REFERENCE`** neste módulo (SC#3 /
DISC-03). O novo método reescrito deve preservar essa mesma garantia.

**Assinatura atual a substituir** (linhas 247-273) — método inteiro será reescrito para produzir o
esqueleto PRD de 16 seções (D-26), mantendo a assinatura `def build_report_generator(self) -> str:`
sem novos parâmetros (o `lens` das perguntas/red-flags é resolvido na pré-montagem em `llm.py`, não
aqui — este método só gera o *system prompt*, que instrui o LLM a preencher as seções fornecidas nas
tabelas do `user` message).

**Padrão de calibração por DMS a reaproveitar** (linhas 69-72, `_dms_str()`):
```python
def _dms_str(self) -> str:
    if self.dms is None:
        return f"Não mapeado ({self.dms_label}): {self.dms_desc}"
    return f"{self.dms}/5 ({self.dms_label}): {self.dms_desc}"
```
Usar `self._dms_str()` no novo prompt PRD do mesmo jeito que os outros 3 métodos do builder já fazem.

**Formato de seção vazia (`[a preencher no PRD]`, discretionary D-26):** seguir o estilo de instrução
explícita já usado em `build_report_generator` atual (linha 260-261: "OBRIGATÓRIO: inclua TODAS as 18
áreas..."), i.e., uma instrução imperativa no próprio system prompt dizendo ao LLM para usar
literalmente o marcador `[a preencher no PRD]` em qualquer subseção sem dado de input.

---

### `backend/app/services/llm_pricing_service.py::import_from_diagnosis` (service, gate D-37)

**Analog:** o próprio arquivo — bloco `if session_id:` (linhas 98-119) já busca `report` via
`self._repo.get_session_report(session_id)` (linha 104); o gate entra logo depois desta linha.

**Imports pattern** (linhas 1-20 aprox., já usa `HTTPException` do FastAPI dentro do service — ver
linha 101-103 para o estilo de raise já estabelecido):
```python
from fastapi import HTTPException
```

**Core pattern — ponto exato de inserção do gate** (adaptado de linhas 104-105):
```python
report = self._repo.get_session_report(session_id)  # SELECT precisa incluir "status" (ver Pitfall 5)
if report and report.get("status") not in (None, "Aprovado para build"):
    raise HTTPException(
        status_code=422,
        detail="O relatório de discovery precisa estar 'Aprovado para build' antes do import.",
    )
reports = [report] if report else []
```

**Error handling pattern:** mesmo estilo do resto do método — `HTTPException` com `status_code` e
`detail` em português, nunca exception genérica (ver linhas 94-95, 101-103, 109-116, 164-168).

**Blocos ampliados (D-32) — texto a inserir no `system_prompt`** (linha 145, dentro da string já
existente):
```python
"- bloco temático (Engenharia de Dados, Visualização, Ciência de Dados, Automação, Integração, "
"Consumo/Interface, GenAI/IA, Machine Learning, Governança & LGPD/Segurança, "
"Infra/MLOps/Observabilidade, Descoberta/Consultoria, Geral)\n"
```
Aplicar a MESMA lista literal em `suggest_features` (linha 259), mantendo os dois prompts
sincronizados como o RESEARCH.md exige. Incluir a linha curta de desambiguação logo depois:
```python
"Desambiguação: ML = modelos preditivos clássicos; GenAI = LLM/RAG/agentes; "
"Ciência de Dados = análise/estatística exploratória.\n"
```

---

### `backend/app/repositories/pricing_repository.py::get_session_report`/`get_project_reports` (repository)

**Analog:** os dois métodos lado a lado no próprio arquivo (linhas 149-192) — mudança puramente
mecânica de adicionar `"status"` ao `.select(...)`.

**Core pattern (linhas 169-176 e 184-192), com a mudança destacada:**
```python
result = (
    self._db.table("reports")
    .select("id, markdown_content, generated_at, status")   # + "status" (era sem)
    .in_("session_id", session_ids)
    .order("generated_at", desc=True)
    .execute()
)
```
```python
result = (
    self._db.table("reports")
    .select("id, markdown_content, generated_at, status")   # + "status"
    .eq("session_id", session_id)
    .order("generated_at", desc=True)
    .limit(1)
    .execute()
)
```
Nenhuma outra mudança de assinatura ou tipo de retorno — `dict | None` / `list[dict]` permanecem
iguais (Pitfall 5 do RESEARCH: sem isso o gate sempre passa silenciosamente).

---

### `backend/app/routers/sessions.py` (novo endpoint `PATCH .../report` para status, D-38)

**Analog:** o par de endpoints de report já existente no mesmo arquivo (linhas 310-343) para forma
de response/erro, mais o padrão geral de `Literal` para campos enum-like usado em todo o repo
(`mode`, `source`, `lens`).

**Imports pattern** (linhas 1-19, já traz tudo necessário — só falta `Literal`):
```python
from typing import Literal, Optional
from pydantic import BaseModel
```

**Core pattern — endpoint sugerido, seguindo a forma dos dois já existentes** (analog: linhas
310-322 para `GET`, response usando `ReportResponse`):
```python
class ReportStatusUpdate(BaseModel):
    status: Literal["Rascunho", "Em revisão", "Aprovado para build"]


@router.patch("/{session_id}/report", response_model=ReportResponse)
async def update_session_report_status(
    session_id: UUID, payload: ReportStatusUpdate, db: Client = Depends(get_supabase)
):
    result = (
        db.table("reports")
        .update({"status": payload.status})
        .eq("session_id", str(session_id))
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="No report found for this session")
    return result.data[0]
```
**Nota de camada:** este PATCH faz update direto — é aceitável no router porque é uma escrita
simples de campo (sem lógica de negócio/orquestração), no mesmo nível de simplicidade dos GETs de
report já presentes neste arquivo (que também tocam `db.table(...)` direto no router, não via
service). Não confundir com o gate de D-37, que É lógica de negócio e por isso vive em
`llm_pricing_service.py` (ver Pattern 2 do RESEARCH.md).

**Fix D-39 — `upload_pdf_transcript` deve propagar `mode`** (linha 469, dentro do bloco já lido):
```python
markdown, inp, out = await llm_service.generate_report(
    api_key=gemini_key,
    transcript=transcript,
    coverage=coverage,
    red_flags=red_flags,
    questions_used=questions_used,
    project_type=project_type,
    dms=dms,
    pre_meeting_context=pre_meeting_context,
    system_prompt=prompts.get("report_generator"),
    mode=project.get("mode", "sales"),   # <-- linha nova; commit separado (correção, não feature)
)
```
`project` já está disponível no escopo da função (linha 369: `project = session.get("projects") or {}`).
Este é um commit isolado — CLAUDE.md exige não misturar correção com feature/refator.

---

### `backend/app/services/session_state.py` (readiness score — novo método, D-33/D-34)

**Analog:** `estimated_report_cost()` (linhas 139-149) — função pura que lê só `self.*` (estado já em
memória) e devolve um número, sem I/O, sem side effects. O novo método de readiness deve seguir
exatamente essa forma: puro, sem `await`, sem chamada a `db`/LLM.

**Core pattern a espelhar:**
```python
def estimated_report_cost(self) -> float:
    transcript_tokens = len(self.get_transcript_text()) // 4 + 2000
    raw = (
        (transcript_tokens / 1000) * INPUT_COST_PER_1K
        + (REPORT_MAX_OUTPUT_TOKENS / 1000) * OUTPUT_COST_PER_1K
    )
    return raw * REPORT_COST_MARGIN
```

**Dados-fonte já disponíveis para os 4 sinais (D-33)** — usar os mesmos que `coverage_to_dict()`
(linhas 156-173) e os campos de `RedFlag`/`Question` já existentes (linhas 53-79, com `lens`):
```python
# Sinal 1 (cobertura mínima por lente) e Sinal 2 (% global) usam self.coverage
# (dict[str, CoverageArea]) do mesmo jeito que coverage_to_dict() já itera:
area_set = DISCOVERY_AREA_SET if self.mode == "discovery" else SALES_AREA_SET
lens_by_key = {a.key: a.lens for a in area_set.areas}
# Sinal 3 (perguntas respondidas / transcrição mínima) usa self.questions (status) +
# self.get_transcript_text() (já existe, linha ~ próxima a estimated_report_cost).
```
Sugestão de assinatura de retorno (discretionary): um dataclass/dict com `score: float`,
`signals: dict[str, float]`, `ready: bool` — para a Fase 5 conseguir mostrar "quais sinais estão
baixos" (D-34) sem reprocessar nada.

---

### `backend/app/services/pipeline.py::_run_report_generator` (orquestração, D-40 + status grant)

**Analog:** o próprio método (linhas 434-478) — `red_flags_raw` (442-450) já é exatamente o padrão
que `questions_used` (439-441) precisa copiar.

**Padrão já correto a copiar (red_flags_raw, linhas 442-450):**
```python
red_flags_raw = [
    {
        "text": rf.text,
        "severity": rf.severity,
        "evidence": rf.evidence,
        "lens": rf.lens,
    }
    for rf in self.state.red_flags
]
```

**Trecho a mudar (questions_used, linhas 439-441) — de `list[str]` para `list[dict]`:**
```python
# ANTES:
questions_used = [
    q.text for q in self.state.questions if q.status in ("used", "pinned")
]
# DEPOIS (D-40, mesmo padrão de red_flags_raw):
questions_used = [
    {"text": q.text, "lens": q.lens}
    for q in self.state.questions if q.status in ("used", "pinned")
]
```

**Grant do `status` inicial no INSERT (linhas 466-470) — gated por `mode`, sem novo flag paralelo:**
```python
db.table("reports").insert({
    "session_id": self.state.session_id,
    "markdown_content": markdown,
    "cost_usd": str(round(tokens_to_usd(inp, out), 6)),
    **({"status": "Rascunho"} if self.state.mode == "discovery" else {}),
}).execute()
```
Aplicar a mesma mudança de `.insert(...)` em `sessions.py::upload_pdf_transcript` (linha ~484-491) e em
`sessions.py::generate_session_report` se ele fizer insert próprio (hoje ele só lê de volta o insert
feito por `pipeline.trigger_report`, então não precisa mudar).

**Comentário de guarda-corrilho já presente no arquivo (linhas 411-413) — respeitar sempre:**
```python
# Fase 3 / D-24: gate único por `mode` — mesmo padrão já usado na
# seleção de builder (pipeline.py PipelineManager.get_or_create).
# NUNCA introduzir um segundo flag paralelo a `mode`.
```

---

### `supabase/migrations/<novo>_add_status_to_reports.sql` (migration aditiva, D-36)

**Analog:** `supabase/migrations/20260922000000_add_lens_tagging.sql` (arquivo inteiro, reproduzido
abaixo) — é o padrão canônico de migration aditiva/nullable/sem-default do repo.

**Padrão completo a copiar (adaptando tabela/coluna):**
```sql
-- Migration: <novo_timestamp>_add_status_to_reports.sql
-- Adiciona a coluna status à tabela reports para o campo Status do PRD
-- (Rascunho | Em revisão | Aprovado para build) — só relatórios discovery usam.
-- Aditiva e idempotente (ADD COLUMN IF NOT EXISTS), nullable e SEM DEFAULT:
-- linhas antigas e todos os relatórios sales ficam com status NULL, sem backfill
-- manual e sem alterar comportamento existente (D-36, análogo a D-18/D-24 para lens).
-- A validação do valor {Rascunho, Em revisão, Aprovado para build} fica no código
-- (Pydantic Literal), seguindo o padrão das demais colunas enum-like do repo
-- (project_type/source/mode/lens), sem CHECK e sem ALTER TYPE.

ALTER TABLE reports ADD COLUMN IF NOT EXISTS status text;

COMMENT ON COLUMN reports.status IS
    'Status do relatório discovery (igual ao campo Status do PRD): Rascunho | Em revisão | '
    'Aprovado para build. NULL para relatórios sales e linhas antigas — sem backfill. '
    'Validação de valor em código (Pydantic Literal), sem CHECK/enum nativo.';
```
Nomenclatura de arquivo: seguir o padrão `YYYYMMDDHHMMSS_add_<coisa>_to_<tabela>.sql` já usado nos
dois exemplos existentes (`20260921000000_add_mode_to_projects.sql`,
`20260922000000_add_lens_tagging.sql`).

---

### `backend/tests/test_discovery_report.py` (novo — golden REP-01 + REP-03)

**Analog:** `backend/tests/test_discovery_mode.py` — em especial o helper `_capture_report_user`
(linhas 166-186) e o par de testes sales/discovery (linhas 190-220).

**Imports pattern (topo do arquivo analog, inferir do uso):**
```python
import pytest
from app.services import llm
from app.services.prompt_builder import CITI_PORTFOLIO, CITI_SERVICE_CATALOG, CITI_TECH_REFERENCE
```

**Helper a reaproveitar (copiar verbatim, linhas 166-186), ajustando `questions_used`/`red_flags`
para os novos formatos de dict com `lens` (D-40):**
```python
async def _capture_report_user(monkeypatch, **kwargs) -> str:
    """Chama generate_report com llm._call monkeypatchado, retornando a mensagem `user` enviada."""
    captured: dict = {}

    async def _fake_call(api_key, system, user, max_output_tokens=None):
        captured["user"] = user
        return "relatorio de teste", 0, 0

    monkeypatch.setattr(llm, "_call", _fake_call)

    await llm.generate_report(
        api_key="x",
        transcript="transcricao de teste",
        coverage={},
        red_flags=[],
        questions_used=[],
        project_type="bi",
        dms=None,
        **kwargs,
    )
    return captured["user"]
```

**Golden test pattern para REP-03 (regressão sales) — mesma forma de `test_generate_report_sales_mode_includes_citi_block`
(linhas 203-214 do analog):**
```python
@pytest.mark.asyncio
async def test_sales_mode_unchanged(monkeypatch):
    """REP-03: generate_report(mode='sales') continua byte-idêntico após a fase."""
    user = await _capture_report_user(monkeypatch, mode="sales")
    assert _CITI_HEADER in user  # bloco comercial presente, como hoje
    # + comparar contra fixture/string congelada capturada ANTES da mudança em llm.py
```

**Novo teste REP-01 (esqueleto PRD, duas tabelas por lens, marcador de seção vazia):**
```python
@pytest.mark.asyncio
async def test_generate_report_discovery_prd_skeleton_has_16_sections(monkeypatch):
    coverage = {
        "gargalo": {"status": "covered", "score": 90, "notes": "ok", "lens": "produto", "name": ""},
        "qualidade_fontes": {"status": "uncovered", "score": 0, "notes": "", "lens": "dados", "name": ""},
    }
    user = await _capture_report_user(monkeypatch, mode="discovery")
    # asserts sobre presença das tabelas Produto/Dados e marcador [a preencher no PRD]
```

---

### `backend/tests/test_import_from_diagnosis_gate.py` (novo — integração REP-02)

**Analog:** `backend/tests/test_two_agent_lens.py` para o estilo de fixtures de sessão discovery, e
o corpo de `llm_pricing_service.py::import_from_diagnosis` (linhas 71-179) como referência do fluxo a
exercitar (mock do `BaseChatModel` via `with_structured_output`, como já deve ser feito nos testes
existentes de `llm_pricing_service`).

**Core pattern (gate 422 quando não aprovado; sucesso quando aprovado) — estrutura sugerida:**
```python
def test_import_from_diagnosis_blocks_when_status_not_approved(pricing_repo_stub, llm_stub):
    service = LLMPricingService(repo=pricing_repo_stub, llm=llm_stub)
    with pytest.raises(HTTPException) as exc:
        service.import_from_diagnosis(pricing_id="...", session_id="...")
    assert exc.value.status_code == 422


def test_import_from_diagnosis_succeeds_when_approved(pricing_repo_stub, llm_stub):
    # pricing_repo_stub.get_session_report retorna {"status": "Aprovado para build", ...}
    service = LLMPricingService(repo=pricing_repo_stub, llm=llm_stub)
    features = service.import_from_diagnosis(pricing_id="...", session_id="...")
    assert len(features) >= 1
    # assert pricing_repo_stub.update_pricing foi chamado com {"session_id": ...}
```

## Shared Patterns

### Gate por `mode` (nunca introduzir segundo flag)
**Source:** `backend/app/services/pipeline.py:411-413` (comentário explícito), replicado em
`llm.py:179-183` (citi_block) e na seleção de builder em `PipelineManager.get_or_create`.
**Apply to:** `llm.py::generate_report` (branch discovery), `pipeline.py::_run_report_generator`
(status grant), `sessions.py::upload_pdf_transcript` (fix D-39).
```python
# NUNCA introduzir um segundo flag paralelo a `mode`.
if self.state.mode == "discovery":
    ...
else:
    ...
```

### Migration aditiva/nullable sem DEFAULT
**Source:** `supabase/migrations/20260922000000_add_lens_tagging.sql`
**Apply to:** nova migration de `reports.status`.
```sql
ALTER TABLE <tabela> ADD COLUMN IF NOT EXISTS <coluna> text;
COMMENT ON COLUMN <tabela>.<coluna> IS '...NULL para linhas antigas/sales — sem backfill...';
```

### Validação de campo enum-like via `Literal` (nunca `CHECK`/enum nativo)
**Source:** padrão geral do repo (`mode`, `source`, `project_type`, `lens`) — nenhum exemplo isolado
de `Literal` em Pydantic foi lido diretamente nesta sessão, mas é o padrão consistente citado em
RESEARCH.md "Don't Hand-Roll" e confirmado pela ausência de `CHECK`/`ENUM` nas migrations lidas.
**Apply to:** `ReportStatusUpdate` (novo endpoint PATCH), qualquer validação de `status`.
```python
status: Literal["Rascunho", "Em revisão", "Aprovado para build"]
```

### Golden test via monkeypatch de `llm._call` (nunca do `system` prompt)
**Source:** `backend/tests/test_discovery_mode.py::_capture_report_user` (linhas 166-186).
**Apply to:** `test_discovery_report.py` (REP-01 e REP-03).
```python
async def _fake_call(api_key, system, user, max_output_tokens=None):
    captured["user"] = user
    return "relatorio de teste", 0, 0
monkeypatch.setattr(llm, "_call", _fake_call)
```

## No Analog Found

Nenhum arquivo desta fase carece de analog — todo o trabalho é extensão de arquivos/padrões já
existentes no próprio repo (nenhuma pasta/módulo novo, nenhuma lib nova).

## Metadata

**Analog search scope:** `backend/app/services/`, `backend/app/repositories/`, `backend/app/routers/`,
`supabase/migrations/`, `backend/tests/` (leitura direta, sem Glob adicional necessário — todos os
arquivos-alvo já vieram nomeados/ancorados no CONTEXT.md e RESEARCH.md com números de linha).
**Files scanned:** 10 arquivos-fonte + 2 arquivos de teste analog + 1 migration analog = 13.
**Pattern extraction date:** 2026-09-22
