# Phase 3: Two-Agent Questions + Lens Tagging - Pattern Map

**Mapped:** 2026-09-21
**Files analyzed:** 8 (7 modificados + 1 migration + 1 teste novo)
**Analogs found:** 8 / 8 — todos os analogs são as próprias fases anteriores do mesmo módulo
(Fase 1 / Fase 2), já que esta fase é extensão cirúrgica de código já existente, não código novo
de domínio.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/app/services/pipeline.py` (`_run_question_planner`) | service (orchestrator) | request-response (LLM call + DB insert + WS broadcast) | Ele mesmo — `_run_red_flag_detector` (`pipeline.py:244-280`) é o analog mais próximo dentro do mesmo arquivo (mesmo shape: LLM call → dedup → insert → broadcast) | exact (mesmo arquivo, padrão irmão) |
| `backend/app/services/discovery_prompt_builder.py` (`build_question_planner`, `build_red_flag_detector`) | service (prompt builder) | transform (string composition) | Ele mesmo — `build_coverage_classifier` já usa `DISCOVERY_AREA_SET.schema_json(...)` como padrão de composição condicional | exact |
| `backend/app/services/coverage_areas.py` (`AreaDefinition` + `AreaSet.by_lens`) | model (registry) | transform (pure functions) | Ele mesmo — `AreaSet.block_enum()`/`.labels()`/`.keys()` (linhas 38-53) são o padrão de método derivado sobre `_ordered()` | exact |
| `backend/app/services/session_state.py` (`Question`, `RedFlag`, `SessionState.question_trigger_count`, `coverage_to_dict`) | model (dataclass) | CRUD (estado em memória) | Ele mesmo — campos já existentes `tokens_used`/`cost_usd` são o padrão de contador simples em `SessionState` | exact |
| `backend/app/services/llm.py` (`detect_red_flags`, `generate_questions`) | service (LLM client) | request-response | Ele mesmo — `generate_questions` (255-314) é literalmente o arquivo a modificar; `classify_coverage` (62-79) é o padrão irmão de contrato JSON opcional via `system_prompt` | exact |
| `backend/app/models/questions.py` (`QuestionResponse`) | model (Pydantic schema) | transform (serialization) | Ele mesmo — campo `block: Optional[str] = None` já é o padrão de campo opcional nullable a copiar para `lens` | exact |
| `supabase/migrations/<novo>.sql` | migration | batch (DDL aditivo) | `supabase/migrations/20260921000000_add_mode_to_projects.sql` | exact |
| `backend/tests/test_two_agent_lens.py` (novo) | test | request-response (unit, monkeypatch) | `backend/tests/test_expire_questions.py` (fake DB) + `backend/tests/test_discovery_mode.py` (gate por `mode`, golden byte-idêntico) | exact (combinação dos dois padrões) |

## Pattern Assignments

### `backend/app/services/pipeline.py` — split `_run_question_planner` em Produto→Dados

**Analog:** o próprio método atual (282-344) + `_run_red_flag_detector` (244-280) como padrão irmão
de "LLM call → dedup → insert → broadcast", e o seam de seleção por `mode` (598-612) como padrão de
gate.

**Estado atual do método a dividir** (`pipeline.py:282-344`):
```python
async def _run_question_planner(self) -> None:
    key = self._resolve_gemini_key()
    if not key:
        await ws_manager.broadcast(
            self.state.session_id, "error", {"message": "Chave Gemini não configurada para este projeto."}
        )
        return
    # Max 5 queued
    queued_count = sum(1 for q in self.state.questions if q.status == "queued")
    if queued_count >= 5:
        return
    transcript = self.state.get_transcript_text(last_n=80)
    recent = list({
        q.text
        for q in self.state.questions
        if q.source == "pre_mapped" or q.status == "dismissed"
    } | {
        q.text
        for q in self.state.questions[-6:]
        if q.status in ("queued", "pinned", "used")
    })
    questions, inp, out = await llm_service.generate_questions(
        key, transcript, self.state.coverage_to_dict(), recent,
        self.state.project_type, self.state.data_maturity_score,
        bank_questions=self.state.bank_questions,
        system_prompt=self.state.prompts.get("question_planner"),
        pre_meeting_context=self.state.pre_meeting_context,
    )
    self.state.add_token_cost(inp, out)
    db = get_supabase()
    now = datetime.now(timezone.utc)
    expires_at = (now + timedelta(seconds=self.state.question_ttl_seconds)).isoformat()
    for q_data in questions:
        queued_count = sum(1 for q in self.state.questions if q.status == "queued")
        if queued_count >= 5:
            break
        q_id = str(uuid.uuid4())
        q = Question(
            id=q_id, text=q_data.get("text", ""), block=q_data.get("block", "negocio"),
            source="auto", status="queued", generated_at=now.isoformat(), expires_at=expires_at,
        )
        self.state.questions.append(q)
        db.table("questions").insert({...}).execute()
        await ws_manager.broadcast(self.state.session_id, "question_new", q.__dict__)
```

**Gate por `mode` a replicar** (`pipeline.py:598-612` — mesmo padrão if/else, não introduzir 2º sinalizador):
```python
mode = project.get("mode") or "sales"
if mode == "discovery":
    builder = DiscoveryPromptBuilder(...)
else:
    builder = PromptBuilder(...)
```
Use exatamente essa forma para o split: `if self.state.mode == "discovery": ... else: <caminho atual
inalterado>`.

**Dedup pré-existente de red flags a NÃO confundir** (`pipeline.py:254,258`):
```python
existing_texts = {f.text[:60] for f in self.state.red_flags}
...
if not text or text[:60] in existing_texts:
    continue
```
É por prefixo bruto de 60 chars — a nova trava de perguntas (D-17) deve ser texto normalizado
(`" ".join(text.strip().lower().split())`), padrão separado, não reaproveitar este.

**Insert de red flag a estender com `lens`** (`pipeline.py:262-277`, adicionar `lens=lens` no
`RedFlag(...)` e `"lens": rf.lens` no insert):
```python
rf = RedFlag(
    id=flag_id, text=text, severity=flag.get("severity", "warning"),
    evidence=flag.get("evidence", ""), detected_at=now,
)
...
db.table("red_flags").insert({
    "id": flag_id, "session_id": self.state.session_id, "text": rf.text,
    "severity": rf.severity, "evidence": rf.evidence,
}).execute()
```

---

### `backend/app/services/discovery_prompt_builder.py` — split por lente

**Analog:** `build_coverage_classifier` (69-94) e `build_question_planner` (155-205) do mesmo
arquivo — mesmo padrão de string composta com `dms`/`context`/`schema_json()`/`block_enum()`.

**Padrão do enum de block restrito** (`discovery_prompt_builder.py:204`):
```python
'{"questions":[{"text":"...","block":"' + DISCOVERY_AREA_SET.block_enum() + '"}]}'
```
Para o split por lente, trocar `DISCOVERY_AREA_SET.block_enum()` por
`DISCOVERY_AREA_SET.by_lens(lens).block_enum()` (novo método em `coverage_areas.py`, ver abaixo).

**Contrato JSON do red flag detector a estender com `lens`** (`discovery_prompt_builder.py:147-148`):
```python
'{"red_flags":[{"text":"...","severity":"warning|critical","evidence":"trecho exato da transcrição"}]}'
```
vira:
```python
'{"red_flags":[{"text":"...","severity":"warning|critical","evidence":"...","lens":"produto|dados"}]}'
```

**`build_all` a estender** (`discovery_prompt_builder.py:243-249`):
```python
def build_all(self) -> dict[str, str]:
    return {
        "coverage_classifier": self.build_coverage_classifier(),
        "red_flag_detector": self.build_red_flag_detector(),
        "question_planner": self.build_question_planner(),
        "report_generator": self.build_report_generator(),
    }
```
vira (D-23, dois novos valores de `agent`, sem quebrar os existentes):
```python
def build_all(self) -> dict[str, str]:
    return {
        "coverage_classifier": self.build_coverage_classifier(),
        "red_flag_detector": self.build_red_flag_detector(),
        "question_planner_produto": self.build_question_planner(lens="produto"),
        "question_planner_dados": self.build_question_planner(lens="dados"),
        "report_generator": self.build_report_generator(),
    }
```

**Nota de header do módulo a atualizar** (`discovery_prompt_builder.py:1-28`, docstring cita D-08/D-09/D-10
— acrescentar referência a D-19/D-21 do split por lente, mantendo o estilo de docstring
já usado: "Fase N (Nome) / D-XX: ...").

---

### `backend/app/services/coverage_areas.py` — campo `lens` + `AreaSet.by_lens`

**Analog:** os métodos derivados já existentes sobre `_ordered()` (`coverage_areas.py:38-53`):
```python
@dataclass(frozen=True)
class AreaDefinition:
    key: str
    label: str
    order: int


@dataclass(frozen=True)
class AreaSet:
    name: str
    areas: tuple[AreaDefinition, ...]

    def _ordered(self) -> tuple[AreaDefinition, ...]:
        return tuple(sorted(self.areas, key=lambda a: a.order))

    def keys(self) -> list[str]:
        return [a.key for a in self._ordered()]

    def labels(self) -> dict[str, str]:
        return {a.key: a.label for a in self._ordered()}

    def block_enum(self) -> str:
        return "|".join(self.keys())
```

**Pitfall crítico de ordem de campos (dataclass frozen)** — `lens` DEVE vir por último, com default:
```python
@dataclass(frozen=True)
class AreaDefinition:
    key: str
    label: str
    order: int
    lens: "str | None" = None
```
(campo com default depois dos sem default — senão `TypeError` na importação do módulo, que quebra
`session_state.py`/`llm.py`/`prompt_builder.py`/`discovery_prompt_builder.py` inteiros).

**As 26 instâncias atuais** (`coverage_areas.py:57-100`) — `SALES_AREA_SET` (8 instâncias, linhas
60-67) fica sem 4º argumento (default `None`, satisfaz D-19); `DISCOVERY_AREA_SET` (18 instâncias,
linhas 80-98) ganha `"produto"` nas 8 primeiras (order 0-7) e `"dados"` nas 10 seguintes (order 8-17):
```python
AreaDefinition("gargalo", "Gargalo", 0, "produto"),
...
AreaDefinition("qualidade_fontes", "Fontes e Qualidade dos Dados", 8, "dados"),
...
```

**Novo método `by_lens`** (mesmo estilo dos métodos existentes, retorna `AreaSet` filtrado):
```python
def by_lens(self, lens: str) -> "AreaSet":
    return AreaSet(
        name=f"{self.name}_{lens}",
        areas=tuple(a for a in self._ordered() if a.lens == lens),
    )
```

---

### `backend/app/services/session_state.py` — `lens` em `Question`/`RedFlag` + contador + `coverage_to_dict`

**Analog:** os próprios dataclasses e o campo simples de contador já existente
(`tokens_used`/`cost_usd`, linhas 93-94).

**Dataclasses atuais a estender** (`session_state.py:53-71`):
```python
@dataclass
class RedFlag:
    id: str
    text: str
    severity: str  # warning | critical
    evidence: str
    detected_at: str


@dataclass
class Question:
    id: str
    text: str
    block: str
    source: str  # auto | manual
    status: str  # queued | pinned | dismissed | used
    generated_at: str
    expires_at: str
```
Adicionar `lens: "str | None" = None` como último campo em ambos (mesma regra de ordem de dataclass,
embora aqui não sejam `frozen`).

**Contador — mesmo padrão de campo simples em `SessionState`** (`session_state.py:93-94`):
```python
tokens_used: int = 0
cost_usd: float = 0.0
```
vira, com um campo adicional:
```python
tokens_used: int = 0
cost_usd: float = 0.0
question_trigger_count: int = 0
```

**`coverage_to_dict` atual** (`session_state.py:143-147`):
```python
def coverage_to_dict(self) -> dict:
    return {
        area: {"status": c.status, "score": c.score, "notes": c.notes, "name": c.name}
        for area, c in self.coverage.items()
    }
```
vira (Pattern 5 do RESEARCH.md — lookup no registro estático por `mode`, nunca no `CoverageArea`
runtime):
```python
def coverage_to_dict(self) -> dict:
    area_set = DISCOVERY_AREA_SET if self.mode == "discovery" else SALES_AREA_SET
    lens_by_key = {a.key: a.lens for a in area_set.areas}
    return {
        area: {
            "status": c.status, "score": c.score, "notes": c.notes, "name": c.name,
            "lens": lens_by_key.get(area),
        }
        for area, c in self.coverage.items()
    }
```
(`DISCOVERY_AREA_SET`/`SALES_AREA_SET` já são importados no topo do arquivo — `session_state.py:5-9`.)

---

### `backend/app/services/llm.py` — `lens` no contrato JSON + `max_questions` param

**Analog:** o próprio `generate_questions` (255-314) e o padrão de `system_prompt` opcional já
usado em `detect_red_flags`/`classify_coverage`.

**`detect_red_flags` atual** (`llm.py:82-99`, contrato sales inalterado):
```python
async def detect_red_flags(
    api_key: str, transcript: str, context: str, dms: Optional[int],
    system_prompt: str | None = None,
) -> tuple[list, int, int]:
    dms_str = f"{dms}/5" if dms is not None else "not mapped"
    system = system_prompt or (
        f"You are a RedFlagDetector for a data/tech project diagnostic.\n"
        f"Pre-meeting context: {context or 'none'}. Data Maturity Score: {dms_str}.\n"
        "Identify up to 2 critical risks or red flags in the transcript.\n"
        "Return ONLY valid JSON:\n"
        '{"red_flags":[{"text":"...","severity":"warning|critical","evidence":"..."}]}'
    )
    text, inp, out = await _call(api_key, system, f"Transcrição:\n{transcript}")
    try:
        data = _parse_json(text)
        return data.get("red_flags", []), inp, out
    except Exception:
        return [], inp, out
```
Não precisa mudar a assinatura — quando `system_prompt` vem de `DiscoveryPromptBuilder` (com `lens`
no contrato), o parser em `pipeline.py` já deve usar `.get("lens", "")` (nunca indexação direta) para
não quebrar quando vier do sales sem o campo.

**`generate_questions` atual** (`llm.py:255-314`) — ponto a parametrizar por `max_questions`
(D-20: Produto pede 3, Dados pede 2) e `system_prompt` já é o mecanismo de override:
```python
async def generate_questions(
    api_key: str, transcript: str, coverage: dict, recent_questions: list,
    project_type: str, dms: Optional[int],
    bank_questions: list[dict] | None = None,
    system_prompt: str | None = None,
    pre_meeting_context: str = "",
) -> tuple[list, int, int]:
    ...
    text, inp, out = await _call(api_key, system, user)
    try:
        data = _parse_json(text)
        return data.get("questions", []), inp, out
    except Exception:
        return [], inp, out
```
O corte por `max_questions` (Open Question #1 do RESEARCH.md) deve acontecer no chamador
(`pipeline.py`, `_run_single_planner`), fatiando `questions_data[:max_questions]` antes do laço de
insert — não em `llm.py` (mantém `llm.py` sem lógica de negócio, regra do CLAUDE.md).

---

### `backend/app/models/questions.py` — `lens` na resposta

**Analog:** campo opcional nullable já existente no mesmo schema (`questions.py:12-20`):
```python
class QuestionResponse(BaseModel):
    id: UUID
    session_id: UUID
    text: str
    block: Optional[str] = None
    source: str
    status: str
    generated_at: datetime
    expires_at: Optional[datetime] = None
```
Adicionar `lens: Optional[str] = None` seguindo o mesmo padrão de `block`.

---

### `supabase/migrations/<novo>.sql` — migration aditiva

**Analog:** `supabase/migrations/20260921000000_add_mode_to_projects.sql` (arquivo inteiro, 11 linhas):
```sql
-- Migration: 20260921000000_add_mode_to_projects.sql
-- Adiciona a coluna mode à tabela projects para diferenciar sessões de
-- vendas (comportamento atual, com portfólio comercial CITi) de sessões
-- de discovery (18 áreas Produto+Dados, sem portfólio comercial).
-- Aditiva e idempotente (ADD COLUMN IF NOT EXISTS): projetos existentes
-- recebem 'sales' automaticamente via DEFAULT, sem backfill manual.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS mode text DEFAULT 'sales';

COMMENT ON COLUMN projects.mode IS
    'Modo do projeto: sales (...) | discovery (...). Default sales — linhas existentes ficam sales sem backfill manual.';
```
Mesmo template: comentário de cabeçalho explicando o que/por quê/aditividade, `ALTER TABLE ... ADD
COLUMN IF NOT EXISTS ... text` (nullable, sem `DEFAULT` desta vez — D-18 quer `NULL` explícito no
sales, não um default string), e `COMMENT ON COLUMN` documentando os valores válidos. O RESEARCH.md
já fornece o SQL completo proposto (`Code Examples → Migration proposta`, arquivo sugerido
`20260922000000_add_lens_tagging.sql`) cobrindo `questions.lens`, `red_flags.lens` e o comentário de
`session_prompts.agent` — usar como base.

**Referência do schema-base a não regredir** (`supabase/migrations/20260524000000_initial_schema.sql:139-145`):
```sql
CREATE TABLE IF NOT EXISTS session_prompts (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    agent       text NOT NULL,                      -- enum: coverage_classifier, red_flag_detector, question_planner, diagnostic_agent
    prompt_text text NOT NULL,
    created_at  timestamptz DEFAULT now()
);
```
Confirma que `agent` é `text NOT NULL` sem `CHECK` — nenhuma migration de schema é necessária para
`question_planner_produto`/`question_planner_dados`, só o `COMMENT` precisa ser atualizado.

---

### `backend/tests/test_two_agent_lens.py` (novo) — teste-semente de regressão + SC#1-#5

**Analog 1 (fake DB + monkeypatch):** `backend/tests/test_expire_questions.py` (arquivo inteiro,
125 linhas) — reusar literalmente `_FakeQuery`/`_FakeDB`/`_install_fake_db`:
```python
class _FakeQuery:
    def __init__(self, calls: dict):
        self._calls = calls

    def update(self, payload):
        self._calls["payload"] = payload
        return self

    def in_(self, col, ids):
        self._calls["in_"] = (col, list(ids))
        return self

    def eq(self, col, val):
        self._calls["eq"] = (col, val)
        return self

    def execute(self):
        self._calls["executed"] = True
        return type("R", (), {"data": []})()


class _FakeDB:
    def __init__(self, calls: dict):
        self._calls = calls

    def table(self, name):
        self._calls["table"] = name
        return _FakeQuery(self._calls)


def _install_fake_db(monkeypatch) -> dict:
    calls: dict = {}
    monkeypatch.setattr(pipeline_mod, "get_supabase", lambda: _FakeDB(calls))
    return calls
```
(para inserts em lote — `questions`/`red_flags` — precisa de uma `_FakeQuery.insert(payload)` que
acumula em lista, ver o esqueleto já proposto no RESEARCH.md `Code Examples → Teste-semente de
regressão sales`.)

**Analog 2 (gate por `mode` + golden byte-idêntico):** `backend/tests/test_discovery_mode.py:181-216`
— padrão de "capturar user/system message via monkeypatch e comparar string exata entre
`mode='discovery'` vs `mode='sales'` vs default":
```python
@pytest.mark.asyncio
async def test_generate_report_default_mode_matches_sales_mode(monkeypatch):
    """generate_report(...) com `mode` omitido produz o MESMO texto 'user' que
    mode='sales' — o default preserva 100% das chamadas atuais (SC#4)."""
    user_default = await _capture_report_user(monkeypatch)
    user_sales = await _capture_report_user(monkeypatch, mode="sales")

    assert user_default == user_sales
    assert _expected_citi_block() in user_default
```
Aplicar o mesmo formato para o teste-semente D-24: instanciar `SessionState(mode="sales")`, rodar
`_run_question_planner()`, e comparar contra o comportamento pré-fase (1 insert, sem
`question_trigger_count` incrementado, `lens is None`).

**Esqueleto pronto do RESEARCH.md** (`Code Examples → Teste-semente de regressão sales`, D-24):
```python
async def test_sales_mode_never_creates_dados_counter_or_lens(monkeypatch):
    calls = {}
    monkeypatch.setattr(pipeline_mod, "get_supabase", lambda: _FakeDB(calls))
    monkeypatch.setattr(
        pipeline_mod.llm_service, "generate_questions",
        lambda *a, **kw: _fake_coro([{"text": "Quantas fontes?", "block": "eng_dados"}], 0, 0),
    )
    state = SessionState(session_id="s", mode="sales")
    pipe = SessionPipeline(state)
    pipe._resolve_gemini_key = lambda: "fake-key"

    await pipe._run_question_planner()

    assert state.question_trigger_count == 0
    assert all(q.lens is None for q in state.questions)
    inserted = calls.get("inserts", [[{}]])[-1][0]
    assert inserted.get("lens") is None
```

## Shared Patterns

### Gate por `mode` (sales vs discovery)
**Source:** `backend/app/services/pipeline.py:598-612` (seleção de builder) +
`backend/tests/test_discovery_mode.py:181-216` (golden/gate test)
**Apply to:** `_run_question_planner`, `_run_red_flag_detector` (parcial — lens sem split de
detector), `coverage_to_dict`
```python
mode = project.get("mode") or "sales"
if mode == "discovery":
    builder = DiscoveryPromptBuilder(...)
else:
    builder = PromptBuilder(...)
```
Regra: `self.state.mode == "discovery"` é a ÚNICA condição usada para decidir 2 agentes vs 1,
contador ativo vs inativo, `lens` preenchido vs `None`. Nunca introduzir um segundo flag paralelo
(Don't Hand-Roll do RESEARCH.md).

### Serialização automática via `__dict__` no broadcast WS
**Source:** `backend/app/services/pipeline.py:278-280,342-344`
**Apply to:** `Question`, `RedFlag` — adicionar campo `lens` ao dataclass já propaga sem tocar
`ws_manager`.
```python
await ws_manager.broadcast(self.state.session_id, "question_new", q.__dict__)
await ws_manager.broadcast(self.state.session_id, "red_flag", rf.__dict__)
```

### Registro único de áreas (`AreaSet`/`AreaDefinition`) como fonte de verdade
**Source:** `backend/app/services/coverage_areas.py:23-53`
**Apply to:** qualquer derivação nova sobre áreas (block_enum filtrado por lente, labels, schema) —
nunca hardcodar lista de chaves fora do registro (regra da Fase 1, D-01/D-02, reforçada no "Don't
Hand-Roll" do RESEARCH.md desta fase).

### Fila única com teto de 5 + anti-repeat por texto
**Source:** `backend/app/services/pipeline.py:290-291,294-302,319-321`
**Apply to:** o laço de insert de cada agente (Produto e Dados) deve reusar o MESMO cálculo de
`recent` e o MESMO corte por `queued_count >= 5` — não duplicar a lógica com números diferentes por
lente (D-14: sem cotas rígidas por lente).

### Fake DB de teste (`_FakeQuery`/`_FakeDB`)
**Source:** `backend/tests/test_expire_questions.py:31-64`
**Apply to:** `backend/tests/test_two_agent_lens.py` — copiar/estender (nunca recriar do zero, conforme
Wave 0 Gaps do RESEARCH.md).

## No Analog Found

Nenhum. Todos os 8 arquivos desta fase são extensão direta de código já existente no mesmo módulo —
não há nenhum arquivo verdadeiramente novo de domínio (o único arquivo 100% novo, a migration SQL e
o arquivo de teste, têm analogs exatos de fases anteriores no mesmo repositório, já citados acima).

## Metadata

**Analog search scope:** `backend/app/services/`, `backend/app/models/`, `backend/tests/`,
`supabase/migrations/` (todos dentro do próprio repositório; nenhuma busca externa necessária — fase
100% extensão de código já lido nesta sessão via CONTEXT.md/RESEARCH.md com linhas verificadas).
**Files scanned:** 10 (pipeline.py, discovery_prompt_builder.py, prompt_builder.py, coverage_areas.py,
session_state.py, llm.py, questions.py, test_expire_questions.py, test_discovery_mode.py,
20260921000000_add_mode_to_projects.sql)
**Pattern extraction date:** 2026-09-21
