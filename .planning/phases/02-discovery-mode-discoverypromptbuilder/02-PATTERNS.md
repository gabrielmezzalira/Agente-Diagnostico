# Fase 2: Discovery Mode + DiscoveryPromptBuilder — Mapa de Padrões

**Mapeado em:** 2026-09-20
**Arquivos analisados:** 9
**Analogs encontrados:** 9 / 9 (todos com match forte — a fase é 100% aditiva sobre seams já existentes)

## File Classification

| Arquivo novo/modificado | Role | Data Flow | Analog mais próximo | Match |
|---|---|---|---|---|
| `backend/app/services/coverage_areas.py` (+`DISCOVERY_AREA_SET`) | model/registry | transform (dados estáticos → strings derivadas) | `SALES_AREA_SET` no mesmo arquivo (linhas 56-69) | exact — mesmo módulo, mesmo dataclass |
| `backend/app/services/discovery_prompt_builder.py` (novo) | service | transform (contexto → texto de prompt) | `PromptBuilder` em `backend/app/services/prompt_builder.py:222` | exact — sibling class, mesmo contrato informal |
| `backend/app/services/llm.py` (`generate_report`, gate CITI) | service | request-response (chamada LLM) | o próprio arquivo, bloco atual em `llm.py:184-186` | exact — edição in-place, não novo arquivo |
| `backend/app/services/pipeline.py` (`PipelineManager.get_or_create`) | service | event-driven (orquestra sessão) | o próprio arquivo, bloco atual em `pipeline.py:596-602` | exact — edição in-place |
| `backend/app/services/session_state.py` (`_init_coverage`) | service/state | CRUD (inicialização de estado em memória) | o próprio arquivo, `_init_coverage` em `session_state.py:16-28` | exact — edição in-place |
| `backend/app/models/projects.py` (+`mode`) | model | request-response (schema Pydantic) | `ProjectType`/`TranscriptSource` no mesmo arquivo (linhas 8-9) | exact — mesmo padrão `Literal` |
| `supabase/migrations/20260921000000_add_mode_to_projects.sql` (novo) | migration | batch (DDL) | `supabase/migrations/20260525000000_add_tunnel_url.sql` | exact — `ALTER TABLE ADD COLUMN IF NOT EXISTS ... DEFAULT` |
| `frontend/src/pages/ProjectFormPage.tsx` (+toggle `mode`) | component | request-response (form) | radio "Fonte de transcrição" no mesmo arquivo (linhas 252-271) | exact — mesmo componente, mesmo padrão de radio |
| `backend/tests/test_discovery_mode.py` (novo) | test | unit | `backend/tests/test_coverage_areas_golden.py` (Fase 1) | exact — mesmo estilo golden/regressão |

## Pattern Assignments

### `backend/app/services/coverage_areas.py` — adicionar `DISCOVERY_AREA_SET`

**Analog:** `SALES_AREA_SET`, definido no mesmo arquivo, linhas 56-69 (confirmado por leitura direta):

```python
# backend/app/services/coverage_areas.py:56-69 (padrão a copiar)
SALES_AREA_SET = AreaSet(
    name="sales",
    areas=(
        AreaDefinition("negocio", "Negócio", 0),
        AreaDefinition("eng_dados", "Eng. de Dados", 1),
        AreaDefinition("visualizacao", "Visualização", 2),
        AreaDefinition("ciencia_dados", "Ciência de Dados", 3),
        AreaDefinition("automacao", "Automação", 4),
        AreaDefinition("integracao", "Integração", 5),
        AreaDefinition("consumo", "Consumo", 6),
        AreaDefinition("parceria", "Parceria", 7),
    ),
)
```

**Como aplicar (D-06):** acrescentar, no mesmo arquivo, logo abaixo de `SALES_AREA_SET`, um segundo
`AreaSet` chamado `DISCOVERY_AREA_SET` com as 18 `AreaDefinition` (Produto order 0-7, Dados order
8-17 — lista completa em CONTEXT.md §D-06 / RESEARCH.md §Code Examples). `AreaSet`/`AreaDefinition`
não mudam — `keys()`, `labels()`, `schema_json()`, `block_enum()` já funcionam para qualquer
instância. Não colidir com `ciencia_dados` do sales: são tuplas independentes dentro do mesmo módulo,
sem namespace compartilhado.

**Docstring do módulo (linhas 1-17):** já documenta o papel de "registro único" e o motivo de
`AreaDefinition` não se chamar `CoverageArea` — reaproveitar o mesmo tom ao comentar o novo
`DISCOVERY_AREA_SET`, sem reescrever a docstring do módulo.

---

### `backend/app/services/discovery_prompt_builder.py` (novo arquivo) — classe irmã `DiscoveryPromptBuilder`

**Analog:** `PromptBuilder`, `backend/app/services/prompt_builder.py:222` em diante. Os helpers
reaproveitáveis por import (não por herança, D-09):

- `DMS_LABEL` (linha 9), `DMS_DESCRIPTION` (linha 17) — dicts de calibração por faixa de DMS.
- `_dms_str` (linha 268) — pode ser duplicado (decisão discricionária) ou importado; nesta fase,
  como `DiscoveryPromptBuilder` não deve herdar de `PromptBuilder` (D-09 proíbe subclasse), a forma
  mais simples é **duplicar o método** `_dms_str` (poucas linhas) e **importar** apenas os dicts
  `DMS_LABEL`/`DMS_DESCRIPTION`.

**Import a evitar (ponto crítico do SC#3):** `PromptBuilder` importa `CITI_PORTFOLIO` (linha 108),
`CITI_SERVICE_CATALOG` (linha 143), `CITI_TECH_REFERENCE` (linha 192) no topo do módulo — dentro do
mesmo arquivo `prompt_builder.py`. `discovery_prompt_builder.py` **nunca** deve importar essas três
constantes; isso por si só garante SC#3 para os três agentes de tempo real.

**Core pattern (contrato dos 4 métodos por-agente):**

```python
# Esqueleto do novo módulo — Source: RESEARCH.md §Code Examples
from app.services.coverage_areas import DISCOVERY_AREA_SET
from app.services.prompt_builder import DMS_LABEL, DMS_DESCRIPTION  # import, não duplicação

class DiscoveryPromptBuilder:
    def __init__(self, dms, pre_meeting_context="", structured_context=None):
        self.dms = max(1, min(5, dms)) if dms is not None else None
        self.context = pre_meeting_context or "não fornecido"
        self.dms_label = DMS_LABEL[self.dms] if self.dms is not None else "Não mapeado"
        self.dms_desc = DMS_DESCRIPTION[self.dms] if self.dms is not None else (
            "maturidade de dados ainda não avaliada para este cliente"
        )
        self.sc = structured_context if (structured_context and not structured_context.is_empty()) else None

    def _dms_str(self) -> str: ...  # duplicado de PromptBuilder._dms_str

    def build_coverage_classifier(self) -> str:
        return (
            "Você é um CoverageClassifier atuando como facilitador de discovery ...\n"
            f"Perfil do cliente — Data Maturity Score: {self._dms_str()}.\n"
            f"Contexto pré-reunião: {self.context}\n\n"
            "Retorne APENAS JSON válido (sem markdown fences):\n"
            + DISCOVERY_AREA_SET.schema_json(include_not_applicable=False)
        )
    # build_red_flag_detector / build_question_planner / build_report_generator / build_all
    # seguem a mesma forma, todos usando DISCOVERY_AREA_SET (nunca AREAS_BY_PROJECT_TYPE, D-08).
```

**Ponto de atenção do `structured_context` (duck typing):** `prompt_builder.py:237` traz o
comentário `# StructuredContext | None — duck typing, sem import em runtime` — reproduzir o mesmo
padrão em `DiscoveryPromptBuilder` (não importar o tipo `StructuredContext`, só chamar
`.is_empty()`).

---

### `backend/app/services/llm.py` — gate de `CITI_*` por `mode` em `generate_report`

**Analog:** o próprio bloco atual (`llm.py:114` import, `184-186` injeção incondicional):

```python
# ANTES (llm.py:184-186 — hoje, incondicional)
user = (
    ...
    f"## Portfólio CITi (referência comercial)\n{CITI_PORTFOLIO}\n\n"
    f"## Catálogo de serviços CITi (referência para sprints)\n{CITI_SERVICE_CATALOG}\n\n"
    f"## Referência de tecnologias\n{CITI_TECH_REFERENCE}\n\n"
    f"## Transcrição completa\n{transcript}"
)
```

**Padrão a aplicar** (novo parâmetro `mode: str = "sales"` em `generate_report`, default preserva
byte-a-byte o caminho sales — D-03/SC#4):

```python
citi_block = (
    f"## Portfólio CITi (referência comercial)\n{CITI_PORTFOLIO}\n\n"
    f"## Catálogo de serviços CITi (referência para sprints)\n{CITI_SERVICE_CATALOG}\n\n"
    f"## Referência de tecnologias\n{CITI_TECH_REFERENCE}\n\n"
) if mode == "sales" else ""

user = (
    f"Tipo de projeto: {project_type or 'não especificado'}\n"
    f"Data Maturity Score: {dms_str}\n"
    f"{context_block}"
    f"## Cobertura final\n{coverage_table}\n\n"
    f"## Alertas detectados\n{flags_text}\n\n"
    f"{citi_block}"
    f"## Transcrição completa\n{transcript}"
)
```

**Regra de não-regressão:** não mover `CITI_*` para o `system_prompt` do `PromptBuilder` sales
(anti-pattern documentado no RESEARCH.md — mudaria `user`→`system` no payload do Gemini, arriscando
SC#4). Manter a injeção exatamente onde está hoje, só envolvida em `if mode == "sales":`.

**Chamador a ajustar:** `pipeline.py` (`_run_report_generator`, linhas 357-368) passa
`mode=self.state.mode` na chamada a `llm.generate_report(...)`.

---

### `backend/app/services/pipeline.py` — seleção de builder por `mode` em `PipelineManager.get_or_create`

**Analog:** o próprio bloco atual, `pipeline.py:596-602` (instancia só `PromptBuilder`):

```python
# ANTES — pipeline.py:596-602
builder = PromptBuilder(
    dms=project.get("data_maturity_score"),
    pre_meeting_context=pre_meeting_context,
    project_type=project_type,
    structured_context=structured_ctx,
)
prompts = builder.build_all()
```

**Padrão a aplicar (Sibling builder, D-09):**

```python
mode = project.get("mode") or "sales"
if mode == "discovery":
    builder = DiscoveryPromptBuilder(
        dms=project.get("data_maturity_score"),
        pre_meeting_context=pre_meeting_context,
        structured_context=structured_ctx,
    )
else:
    builder = PromptBuilder(
        dms=project.get("data_maturity_score"),
        pre_meeting_context=pre_meeting_context,
        project_type=project_type,
        structured_context=structured_ctx,
    )
prompts = builder.build_all()
```

O ramo `else` deve ficar **texto idêntico** ao bloco atual — nenhuma linha do caminho sales muda
(D-03/SC#4). O mesmo `mode` também é lido em `project_type`/`data_maturity_score` (linhas 363-364,
597-617) e precisa fluir para `SessionState(mode=..., ...)`.

---

### `backend/app/services/session_state.py` — `_init_coverage` com ramo `mode`

**Analog:** a própria função hoje, `session_state.py:16-28`:

```python
# ANTES
def _init_coverage(
    project_type: str, custom_areas: "Optional[List[dict]]" = None
) -> "Dict[str, CoverageArea]":
    inactive = set(AREAS_BY_PROJECT_TYPE.get(project_type, {}).get("inactive", []))
    coverage = {
        a: CoverageArea(status="not_applicable") if a in inactive else CoverageArea()
        for a in SALES_AREA_SET.keys()
    }
    for area in custom_areas or []:
        key = area.get("key")
        if key:
            coverage[key] = CoverageArea(name=area.get("name", ""))
    return coverage
```

**Padrão a aplicar** (extensão segura — `project_type` continua 1º posicional; `mode` é novo kwarg
com default, para não quebrar os 4 testes existentes em
`backend/tests/test_session_state_custom_areas.py:21,32,42,51-53` que chamam
`_init_coverage("bi")` posicionalmente):

```python
def _init_coverage(
    project_type: str,
    mode: str = "sales",
    custom_areas: "Optional[List[dict]]" = None,
) -> "Dict[str, CoverageArea]":
    if mode == "discovery":
        coverage = {a: CoverageArea() for a in DISCOVERY_AREA_SET.keys()}
    else:
        inactive = set(AREAS_BY_PROJECT_TYPE.get(project_type, {}).get("inactive", []))
        coverage = {
            a: CoverageArea(status="not_applicable") if a in inactive else CoverageArea()
            for a in SALES_AREA_SET.keys()
        }
    for area in custom_areas or []:
        key = area.get("key")
        if key:
            coverage[key] = CoverageArea(name=area.get("name", ""))
    return coverage
```

**Chamador a ajustar:** `SessionState.__post_init__` (`session_state.py:84-86`) passa a chamar
`_init_coverage(self.project_type, mode=self.mode, custom_areas=self.custom_areas)` — `SessionState`
precisa de um novo campo `mode: str = "sales"`.

**Anti-pattern (não fazer):** promover `mode` a 1º parâmetro posicional — quebra silenciosamente os
testes existentes (Pitfall 2 do RESEARCH.md).

---

### `backend/app/models/projects.py` — campo `mode`

**Analog:** `ProjectType`/`TranscriptSource`, mesmo arquivo, linhas 8-9:

```python
# backend/app/models/projects.py:8-9 (padrão confirmado por leitura)
ProjectType = Literal["bi", "ml", "data_engineering", "automation", "integration", "science"]
TranscriptSource = Literal["extension", "recall"]
```

**Padrão a aplicar:**

```python
ProjectMode = Literal["sales", "discovery"]

class ProjectCreate(BaseModel):
    ...
    mode: ProjectMode = "sales"

class ProjectUpdate(BaseModel):
    ...
    mode: Optional[ProjectMode] = None   # None ⇒ exclude_none no router não altera a coluna

class ProjectResponse(BaseModel):
    ...
    mode: ProjectMode   # sempre presente — coluna tem DEFAULT 'sales'
```

**Nota (Pitfall 5):** não existe `ProjectRepository` — `backend/app/routers/projects.py` chama
`db.table("projects")...` direto (ex. linha 62: `db.table("projects").insert(row)`). Não introduzir
uma camada de repository nesta fase só para "consertar" isso — seria refactor não solicitado
misturado com a feature (regra do CLAUDE.md contra misturar refactor com mudança de comportamento).
O campo `mode` funciona sem nenhuma camada nova porque `payload.model_dump(mode="json", ...)`
(linhas 56, 93-95 de `projects.py`) já inclui `mode` automaticamente.

---

### `supabase/migrations/20260921000000_add_mode_to_projects.sql` (novo)

**Analog:** `supabase/migrations/20260525000000_add_tunnel_url.sql` (e
`20260525000001_add_recall_bot_id.sql`), ambas `ADD COLUMN IF NOT EXISTS ... DEFAULT` sem backfill:

```sql
-- Migration: 20260921000000_add_mode_to_projects.sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS mode text DEFAULT 'sales';

COMMENT ON COLUMN projects.mode IS
    'Modo do projeto: sales (comportamento atual, portfólio CITi) | discovery (18 áreas Produto+Dados, sem portfólio comercial). Default sales — linhas existentes ficam sales sem backfill manual.';
```

Padrão do repo: nenhuma migration usa `CHECK` ou enum nativo Postgres para colunas enum-like
(`project_type`, `source`, `status`, `severity` são todas `text` sem `CHECK`) — seguir o mesmo estilo,
validação de enum fica 100% no Pydantic `Literal`.

---

### `frontend/src/pages/ProjectFormPage.tsx` — toggle `mode`

**Analog:** radio "Fonte de transcrição", mesmo arquivo, linhas 252-271:

```tsx
// Source: mesmo padrão do radio "Fonte de transcrição" (ProjectFormPage.tsx:252-271)
<Field label="Modo do projeto" required>
  <div className="flex gap-5 mt-0.5">
    {([
      { value: 'sales', label: 'Vendas' },
      { value: 'discovery', label: 'Discovery' },
    ] as const).map(({ value, label }) => (
      <label key={value} className="flex items-center gap-2 cursor-pointer">
        <input
          type="radio"
          name="mode"
          value={value}
          checked={form.mode === value}
          onChange={() => set('mode', value)}
          className="accent-[var(--color-accent)]"
        />
        <span className="text-sm">{label}</span>
      </label>
    ))}
  </div>
</Field>
```

**Arquivos correlatos a editar:**
- `frontend/src/lib/api.ts` — adicionar `mode: 'sales' | 'discovery'` a `Project` e `ProjectCreate`.
- `ProjectFormPage.tsx` — `mode: 'sales'` em `DEFAULT_FORM`; no `useEffect` de carregamento, seguir o
  padrão defensivo já usado para `source` (linha 80): `mode: (p.mode === 'discovery' ? 'discovery' : 'sales')`.

---

### `backend/tests/test_discovery_mode.py` (novo)

**Analog:** `backend/tests/test_coverage_areas_golden.py` (Fase 1, 9 testes, golden/regressão) e
`backend/tests/test_session_state_custom_areas.py` (fixa a assinatura de `_init_coverage`).

**Testes a espelhar (per RESEARCH.md §Validation Architecture):**
- `test_project_mode_default_and_validation` — `ProjectCreate`/`ProjectResponse` aceitam `mode` com
  default `"sales"`; valor fora do enum rejeitado com 422.
- `test_init_coverage_discovery_mode` — `_init_coverage("", mode="discovery")` retorna as 18 chaves
  de `DISCOVERY_AREA_SET` sem `not_applicable`.
- `test_discovery_prompts_omit_citi_keep_dms` — `DiscoveryPromptBuilder.build_*()` contém string de
  calibração DMS e NÃO contém `"CITi"`/`"PORTFÓLIO CITi"`.
- `test_generate_report_citi_gated_by_mode` — captura a mensagem `user` via monkeypatch de `llm._call`
  (não o `system_prompt`, ver Pitfall 1): `mode="discovery"` não contém `CITI_PORTFOLIO`;
  `mode="sales"` contém, byte-idêntico ao golden da Fase 1.

**Comando de regressão obrigatório (não editar os testes da Fase 1):**
```
cd backend && pytest tests/test_discovery_mode.py tests/test_coverage_areas_golden.py tests/test_session_state_custom_areas.py -x
```

## Shared Patterns

### Seam Open/Closed do registry (Fase 1)
**Fonte:** `backend/app/services/coverage_areas.py:20-51` (`AreaDefinition`/`AreaSet` e seus métodos
`keys()`/`labels()`/`schema_json()`/`block_enum()`).
**Aplica-se a:** `DISCOVERY_AREA_SET` e a qualquer consumidor que precise das 18 chaves/labels/schema
— nenhum desses métodos precisa mudar; só uma nova instância de `AreaSet` é somada.

### Sibling builder por `mode` (D-09)
**Fonte:** `backend/app/services/prompt_builder.py:222` (`PromptBuilder`) + novo
`discovery_prompt_builder.py`.
**Aplica-se a:** `pipeline.py` (seleção do builder), `llm.py` (fallbacks — não tocar, Pitfall 4),
qualquer teste que exercite `build_all()`.

### Gate por `mode`, nunca reescrita do caminho sales (D-03/SC#4)
**Fonte:** `llm.py:184-186` (padrão `if mode == "sales": ...`), `_init_coverage` (padrão
`if mode == "discovery": ... else: <código atual intacto>`), `pipeline.py:596-602` (mesmo padrão
if/else).
**Aplica-se a:** todos os pontos de fork desta fase — a regra é sempre "o ramo sales é texto
idêntico ao atual", nunca refatorado "de brinde".

### Migration additive sem backfill
**Fonte:** `supabase/migrations/20260525000000_add_tunnel_url.sql`,
`20260525000001_add_recall_bot_id.sql`.
**Aplica-se a:** `20260921000000_add_mode_to_projects.sql`.

## No Analog Found

Nenhum arquivo desta fase ficou sem analog — todos os 9 têm match exact por já existir um seam
homólogo no mesmo módulo (sales) ou no mesmo repositório (migrations, testes golden da Fase 1).

## Open Items para o planner (não resolver nesta fase, ver RESEARCH.md Open Questions)

- `structured_context.py:17,250-254` (`_EXTRACTOR_SYSTEM`) continua hardcoded para
  `SALES_AREA_SET.keys()` mesmo em projetos discovery — fora do escopo D-06..D-12; documentar como
  limitação conhecida, não corrigir aqui.
- Fallbacks sem `system_prompt` em `llm.py` (`classify_coverage`/`detect_red_flags`/
  `generate_questions`, linhas 67/87/280) continuam citando só `SALES_AREA_SET` — nunca exercitados
  pelo pipeline real; não mudar nesta fase.

## Metadata

**Analog search scope:** `backend/app/services/`, `backend/app/models/`, `backend/tests/`,
`supabase/migrations/`, `frontend/src/pages/`, `frontend/src/lib/`.
**Files scanned:** `coverage_areas.py`, `prompt_builder.py`, `llm.py`, `pipeline.py`,
`session_state.py`, `structured_context.py`, `projects.py` (models e routers),
`test_coverage_areas_golden.py`, `test_session_state_custom_areas.py`, `test_projects.py`,
`ProjectFormPage.tsx`, `api.ts`, `useSessionWS.ts`, todas as 9 migrations existentes.
**Pattern extraction date:** 2026-09-20
