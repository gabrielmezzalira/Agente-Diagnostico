# Phase 2: Discovery Mode + DiscoveryPromptBuilder - Research

**Researched:** 2026-09-20
**Domain:** Backend Python/FastAPI — seleção de comportamento por `mode` de projeto (feature flag),
prompts LLM dinâmicos, migration Supabase additive-only.
**Confidence:** HIGH (todos os pontos de fork foram lidos e citados linha-a-linha; a única parte
`[ASSUMED]` é o texto de enquadramento do D-10, que é uma proposta a validar por decisão explícita
do CONTEXT.md).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-06:** `DISCOVERY_AREA_SET` tem **18 áreas** (não 11). Produto (order 0-7): `gargalo`,
  `frente_atuacao`, `impacto_usuario`, `mapeamento_processos`, `fluxo_dados`, `desenho_solucao`,
  `expectativa_solucao`, `viabilidade_solucao`. Dados (order 8-17): `qualidade_fontes`, `metricas`,
  `lgpd_seguranca`, `quick_wins`, `ciencia_dados`, `analise_dados`, `engenharia_dados`,
  `machine_learning`, `sistemas_nuvem`, `automacoes`. Reversibilidade: custosa.
- **D-06a:** proveniência das fusões (`mapeamento_processos`, `viabilidade_solucao`,
  `desenho_solucao`, `qualidade_fontes` vêm de fusões de pares das 11 originais); `metricas`,
  `lgpd_seguranca`, `quick_wins` mantidas de propósito.
- **D-06b:** divisão Produto/Dados é só por **ordem** (0-7 / 8-17) nesta fase; campo `lens`
  explícito é decisão da Fase 3. Reservar um campo `lens` opcional sem usá-lo é discricionário.
- **D-07:** nova coluna `mode` em `projects`, enum `sales|discovery`, **default `sales`**. Linhas
  existentes ficam sales sem backfill manual. Refletir em `ProjectCreate/Update/Response`
  (`Literal["sales","discovery"]`). Reversibilidade: one-way (migration + contrato de API).
- **D-08:** no discovery as 18 áreas ficam **sempre ativas** — sem o esquema
  `critical/optional/inactive` por `project_type`. `project_type` é opcional/ignorado no discovery;
  continua obrigatório-como-hoje no sales. `_init_coverage` e `_area_hint`/`build_coverage_classifier`
  precisam de ramo próprio para discovery, sem quebrar o caminho sales nem o hook `custom_areas`.
- **D-09:** `DiscoveryPromptBuilder` é **classe separada, irmã** de `PromptBuilder` (não subclasse,
  não flag interno), reaproveitando helpers de DMS. Seleção do builder por `mode` no ponto de
  montagem (`llm.py`/`pipeline.py`). `CITI_PORTFOLIO`+`CATALOG`+`TECH_REFERENCE` (hoje em
  `llm.py:114/184`) só no caminho sales. Preferência: mover a decisão para o seam do builder por
  SRP, sem alterar o texto sales (D-03 da Fase 1: saída sales byte-idêntica).
- **D-10:** prompts de discovery **removem** CITI_PORTFOLIO, **mantêm** calibração por DMS,
  **adicionam** enquadramento de facilitador de discovery. Texto exato é discricionário do
  research/planner (proposta a validar). Reversibilidade: reversível (texto de prompt).
- **D-11:** toggle mínimo `sales|discovery` no formulário de projeto existente (create/edit). Sem
  UI de duas lentes no monitoramento (Fase 5).
- **D-12:** atualizar ROADMAP.md §Phase 2 SC#2 e REQUIREMENTS.md DISC-02 de "11" para "18" na
  execução (ajuste de texto, não de escopo).

### Claude's Discretion

- Texto exato do enquadramento de discovery (D-10) e dos hints por área.
- DiscoveryPromptBuilder reaproveita helpers de DMS via composição/import ou duplica — desde que
  D-09 (classe separada) e o comportamento valham.
- Nome/localização da migration e formato do enum no Postgres (`text` + CHECK vs enum nativo),
  desde que default `sales` e compatível com o cliente Supabase atual.
- Reservar ou não um campo `lens` opcional em `AreaDefinition` já nesta fase (D-06b).

### Deferred Ideas (OUT OF SCOPE)

- Tags de lente explícitas (`produto`/`dados`) + dois agentes (Produto/Dados) na geração de
  perguntas → Fase 3 (LENS-01..05).
- Enxugar mais o lado Dados (fundir `ciencia_dados`/`analise_dados`/`machine_learning`) → revisitar
  se a classificação em tempo real ficar diluída/cara.
- Seção "Métricas para Precificação" no relatório + handoff `import-from-diagnosis` → Fase 4.
- UI de duas lentes no monitoramento (agrupamento, badges, render server-driven) e remoção da
  cópia de áreas do frontend (`useSessionWS.ts`) → Fase 5 (UI-01/02/03).
- Áreas de discovery dinâmicas por cliente (`generate_custom_areas`) → DISCF-02, milestone futuro.
- Deletar sales/CITI_PORTFOLIO de vez → decisão de TEAM/ROADMAP, só depois de validar discovery
  ponta a ponta.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DISC-01 | Projeto configurável em modo "discovery" (vs "sales") sem afetar projetos sales existentes | §Arquitetura Patterns (migration additive `mode text DEFAULT 'sales'`, `ProjectCreate/Update/Response.mode`, `PipelineManager.get_or_create` lendo `project.get("mode")`) |
| DISC-02 | Em discovery, classificar cobertura sobre as áreas de discovery (18, Produto+Dados) em vez das 8 sales | §Code Examples (`DISCOVERY_AREA_SET` em `coverage_areas.py`; `_init_coverage` com ramo `mode=="discovery"`) |
| DISC-03 | Prompts de discovery removem CITI_PORTFOLIO mantendo calibração DMS | §Code Examples (`DiscoveryPromptBuilder` sem import de CITI_*; `generate_report(mode=...)` gateando a injeção de `llm.py:184-186`) |

</phase_requirements>

## Summary

O sistema já tem os dois seams que esta fase precisa: o registro de áreas da Fase 1
(`coverage_areas.py`, `AreaSet`/`AreaDefinition`) e um `PromptBuilder` cujos métodos por-agente já
são funções puras de `(dms, project_type, contexto)` — nenhum deles depende de estado de sessão
além do que é passado no construtor. Isso torna o fork por `mode` mecânico em quase todos os pontos:
`DISCOVERY_AREA_SET` entra em `coverage_areas.py` do mesmo jeito que `SALES_AREA_SET` (D-01/D-02 já
resolvido pela Fase 1); `DiscoveryPromptBuilder` é uma classe nova que nunca importa
`CITI_PORTFOLIO`/`CATALOG`/`TECH_REFERENCE` — então SC#3 fica automaticamente satisfeito para os
três agentes de tempo real (`coverage_classifier`, `red_flag_detector`, `question_planner`), porque
nenhum deles referencia texto CITi hoje.

O único ponto realmente arriscado é o **relatório**: a injeção de `CITI_PORTFOLIO`/`CATALOG`/
`TECH_REFERENCE` não vive no `system_prompt` gerado pelo builder — vive **hardcoded na mensagem
`user`** de `llm.generate_report()` (`backend/app/services/llm.py:184-186`), e acontece
**incondicionalmente**, mesmo quando um `system_prompt` customizado já foi passado. Para satisfazer
SC#3 sem tocar no caminho sales, a forma mais segura é adicionar um parâmetro `mode` a
`generate_report()` e envolver exatamente essas 3 linhas em `if mode == "sales":` — a chamada sales
continua executando o mesmo código, nos mesmos bytes, e só o discovery pula o bloco.

O segundo ponto de atenção é a assinatura de `_init_coverage(project_type, custom_areas=None)`
(`backend/app/services/session_state.py:16-18`) — quatro testes existentes chamam
`_init_coverage("bi")` posicionalmente. Qualquer redesenho que promova `mode` para o primeiro
parâmetro quebra silenciosamente esses testes (passariam `"bi"` como `mode`). A extensão segura é
manter `project_type` como primeiro parâmetro posicional e adicionar `mode: str = "sales"` como
novo parâmetro com default — os quatro testes continuam verdes sem alteração.

**Primary recommendation:** adicionar `DISCOVERY_AREA_SET` em `coverage_areas.py`; criar
`backend/app/services/discovery_prompt_builder.py` com uma classe irmã `DiscoveryPromptBuilder`
(importando só `DMS_LABEL`/`DMS_DESCRIPTION` de `prompt_builder.py`, e `DISCOVERY_AREA_SET` de
`coverage_areas.py` — zero import cycle); fazer `mode` fluir por `SessionState.mode` (novo campo
com default `"sales"`) e por um parâmetro `mode` em `generate_report()`; e escolher builder/area-set
num único ponto — `PipelineManager.get_or_create` (`pipeline.py:596-602`) para o builder,
`SessionState.__post_init__`→`_init_coverage` (`session_state.py:84-86`) para o area-set.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Armazenar `mode` do projeto | Database / Storage (Supabase `projects.mode`) | API/Backend (Pydantic `Literal`) | Fonte de verdade é a linha do projeto; a API só valida o enum na borda |
| Selecionar `AreaSet` (8 vs 18 áreas) | API/Backend (`session_state._init_coverage`) | — | Puro cálculo em memória, sem I/O; decide o shape do `coverage_update` que a UI só renderiza |
| Selecionar builder de prompt (sales vs discovery) | API/Backend (`pipeline.py` `PipelineManager.get_or_create`) | — | Ponto único onde o projeto (linha do banco) já foi lido; builder é escolhido uma vez por sessão e cacheado em `SessionState.prompts` |
| Omitir CITI_PORTFOLIO no relatório discovery | API/Backend (`llm.generate_report`) | — | A injeção hoje vive na mensagem `user`, não no `system_prompt` do builder — o builder não controla essa parte da mensagem |
| Toggle `sales/discovery` no formulário | Browser/Client (`ProjectFormPage.tsx`) | API/Backend (`ProjectCreate/Update.mode`) | UI só grava um campo; validação de enum fica no Pydantic model, não no cliente |
| Exibir 18 vs 8 áreas no monitoramento | Browser/Client (fora de escopo nesta fase — `useSessionWS.ts` ainda tem `COVERAGE_AREAS` hardcoded) | API/Backend (`coverage_update` já emite o dict certo) | D-05 (Fase 1) e UI-03 (Fase 5) — o backend já manda o payload certo; o frontend só consome via WS, sem inicializar localmente (ver Pitfall 6) |

## Standard Stack

Esta fase **não introduz nenhuma dependência nova**. Tudo já está no `requirements.txt`/
`package.json` atuais: FastAPI + Pydantic v2 (`Literal`, `field_validator` — já usados em
`backend/app/models/projects.py:1-8` `[VERIFIED: backend/app/models/projects.py:6,8]`
`from pydantic import BaseModel, field_validator` / `ProjectType = Literal[...]`), `supabase-py`
(cliente já usado em todos os routers), `pytest` + `pytest-asyncio` (`asyncio_mode = auto`
`[VERIFIED: backend/pytest.ini:1-3]` conteúdo lido: `[pytest]` / `asyncio_mode = auto`), React 18 +
TypeScript no frontend.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Coluna Postgres `text DEFAULT 'sales'` (sem CHECK) | Enum nativo Postgres (`CREATE TYPE project_mode AS ENUM (...)`) ou `text` + `CHECK (mode IN (...))` | Nenhuma migration existente no repo usa `CHECK` ou enum nativo para colunas enum-like (`project_type`, `source`, `status`, `severity` são todas `text` sem `CHECK` — `[VERIFIED: supabase/migrations/20260524000000_initial_schema.sql:40,46,64-65]`: `project_type text` / `source text DEFAULT 'taqtic'` / `status text DEFAULT 'active'`). Seguir o padrão existente é mais consistente; enum nativo exigiria `ALTER TYPE` a cada novo modo futuro. Validação de enum já é 100% responsabilidade do Pydantic `Literal` hoje — manter assim. |
| `DiscoveryPromptBuilder` como arquivo novo (`discovery_prompt_builder.py`) | Colocar a classe dentro de `prompt_builder.py` | `prompt_builder.py` já tem 583 linhas `[VERIFIED: backend/app/services/prompt_builder.py]` (arquivo lido por completo, última linha `583`) — muito acima do limite de 200 linhas do CLAUDE.md ("Um arquivo, uma responsabilidade... >200 linhas é sinal de que está fazendo coisas demais"). Um arquivo novo também deixa D-09 (classe separada/seam Open-Closed) mais explícito no nível de módulo, não só de classe. |

**Instalação:** nenhuma (`pip install` / `npm install` não é necessário nesta fase).

## Package Legitimacy Audit

**Não aplicável.** Esta fase não instala nenhum pacote externo novo — apenas adiciona uma coluna
Supabase, dataclasses Python e um componente React reaproveitando dependências já presentes no
projeto. O Package Legitimacy Gate é pulado por não haver `pip install`/`npm install` para auditar.

## Architecture Patterns

### System Architecture Diagram

```
Requisição HTTP (POST/PUT /projects, com campo "mode")
    → ProjectCreate/ProjectUpdate (Pydantic Literal["sales","discovery"], default "sales")
    → db.table("projects").insert/update(row)   [routers/projects.py — sem repository layer, ver Pitfall 5]
    → Supabase Postgres: projects.mode (text DEFAULT 'sales', migration additive)

Sessão iniciada (WS connect / PipelineManager.get_or_create)
    → SELECT * FROM sessions JOIN projects   (pipeline.py:539-551)
    → project["mode"] lido da linha
    → SE mode == "discovery":
          builder = DiscoveryPromptBuilder(dms, pre_meeting_context, structured_context)
          area_set = DISCOVERY_AREA_SET   (18 chaves, sempre ativas — sem AREAS_BY_PROJECT_TYPE)
      SENÃO (mode == "sales", comportamento atual intacto):
          builder = PromptBuilder(dms, pre_meeting_context, project_type, custom_areas, structured_context)
          area_set = SALES_AREA_SET filtrado por AREAS_BY_PROJECT_TYPE[project_type]
    → prompts = builder.build_all()          → SessionState.prompts (persistido em session_prompts)
    → SessionState(mode=..., ...).coverage = _init_coverage(project_type, mode=mode, custom_areas=...)

Loop de sessão (tasks assíncronas — inalterado por esta fase)
    → _coverage_task / _red_flag_task usam SessionState.prompts[agent] como system_prompt
    → coverage_update no WebSocket carrega as chaves de area_set (8 ou 18) — consumido cru pelo
      frontend (D-05: useSessionWS ainda tem cópia própria de área — fora de escopo aqui)

Geração de relatório (trigger_report → _run_report_generator)
    → llm.generate_report(..., mode=state.mode)
    → SE mode == "sales": injeta CITI_PORTFOLIO/CATALOG/TECH_REFERENCE na mensagem "user" (como hoje)
    → SE mode == "discovery": pula esse bloco — relatório sem portfólio comercial
```

### Recommended Project Structure

```
backend/app/
  services/
    coverage_areas.py            # + DISCOVERY_AREA_SET (edição aditiva, D-01/D-02 seam da Fase 1)
    prompt_builder.py             # INTOCADO no conteúdo (garante D-03: sales byte-idêntico)
    discovery_prompt_builder.py   # NOVO — classe irmã DiscoveryPromptBuilder (D-09)
    llm.py                        # generate_report(mode=...) — gateia CITI_* só no bloco de 3 linhas
    pipeline.py                   # PipelineManager.get_or_create escolhe builder por mode
    session_state.py              # SessionState.mode (novo campo); _init_coverage(mode=...) (novo kwarg)
  models/
    projects.py                   # + mode: Literal["sales","discovery"] em Create/Update/Response
supabase/migrations/
  20260921000000_add_mode_to_projects.sql   # ALTER TABLE ... ADD COLUMN IF NOT EXISTS mode ...
frontend/src/
  pages/ProjectFormPage.tsx       # + radio "Modo do projeto" (mesmo padrão do radio "Fonte de transcrição")
  lib/api.ts                      # + mode em Project / ProjectCreate
backend/tests/
  test_discovery_mode.py          # NOVO — golden tests do fork (SC#2, SC#3, SC#4)
```

### Pattern 1: Sibling builder selecionado por `mode` (D-09, Open/Closed)

**What:** `PromptBuilder` e `DiscoveryPromptBuilder` implementam o mesmo contrato informal
(`build_coverage_classifier`, `build_red_flag_detector`, `build_question_planner`,
`build_report_generator`, `build_all`) sem herança nem ABC — o mesmo padrão de duck-typing já usado
no projeto para `structured_context` (comentário explícito no código:
`[VERIFIED: backend/app/services/prompt_builder.py:237]`
`# StructuredContext | None — duck typing, sem import em runtime`).

**When to use:** quando dois "sabores" de conteúdo (sales vs discovery) precisam response idêntico
em forma mas divergente em texto, sem arriscar o comportamento do primeiro ao adicionar o segundo.

**Example (ponto de seleção, `pipeline.py`):**
```python
# Source: backend/app/services/pipeline.py:596-602 (ANTES — só sales)
builder = PromptBuilder(
    dms=project.get("data_maturity_score"),
    pre_meeting_context=pre_meeting_context,
    project_type=project_type,
    structured_context=structured_ctx,
)
prompts = builder.build_all()

# DEPOIS — seleção por mode (novo import: discovery_prompt_builder.DiscoveryPromptBuilder)
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
O ramo `else` é **texto idêntico** ao código atual — nenhuma linha do caminho sales muda.

### Pattern 2: Fork do area-set em `_init_coverage`, sem mudar a assinatura visível aos testes

**What:** `_init_coverage` hoje (`[VERIFIED: backend/app/services/session_state.py:16-28]`):
```python
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
Quatro testes chamam isso posicionalmente com só `project_type`
(`[VERIFIED: backend/tests/test_session_state_custom_areas.py:21,32,42,51-53]`:
`_init_coverage("bi")`, `_init_coverage("bi", custom_areas=[{"key": "custom_x", "name": "X"}])`,
`_init_coverage("bi", custom_areas=[{"key": "negocio", "name": "Y"}])`,
`_init_coverage("bi", custom_areas=None)` / `_init_coverage("bi", custom_areas=[])`).

**Extensão segura — `mode` como novo kwarg com default, `project_type` continua primeiro
posicional:**
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
Os 4 testes existentes continuam passando sem edição (`mode` default `"sales"` reproduz o `else`
idêntico ao código atual). `SessionState.__post_init__` (`session_state.py:84-86`) passa a chamar
`_init_coverage(self.project_type, mode=self.mode, custom_areas=self.custom_areas)`.

### Pattern 3: Gate da injeção CITi por `mode`, sem mover a injeção de lugar

**What:** hoje `llm.generate_report()` injeta o texto comercial incondicionalmente na mensagem
`user`, **independente do `system_prompt`** já ter sido fornecido pelo builder
(`[VERIFIED: backend/app/services/llm.py:114,184-186]`):
```python
from app.services.prompt_builder import CITI_PORTFOLIO, CITI_SERVICE_CATALOG, CITI_TECH_REFERENCE
...
user = (
    ...
    f"## Portfólio CITi (referência comercial)\n{CITI_PORTFOLIO}\n\n"
    f"## Catálogo de serviços CITi (referência para sprints)\n{CITI_SERVICE_CATALOG}\n\n"
    f"## Referência de tecnologias\n{CITI_TECH_REFERENCE}\n\n"
    f"## Transcrição completa\n{transcript}"
)
```
**Extensão segura:** adicionar `mode: str = "sales"` como novo parâmetro keyword de
`generate_report()`, e envolver **só** as 3 linhas de `## Portfólio.../## Catálogo.../## Referência`
num `if mode == "sales": ...`. `pipeline.py:_run_report_generator` (linha 357-368) passa
`mode=self.state.mode`. Nenhuma outra linha de `generate_report` muda — a chamada sales continua
executando exatamente o mesmo bloco, nos mesmos bytes (D-03/SC#4).

### Anti-Patterns to Avoid

- **Mover CITI_PORTFOLIO para dentro do `system_prompt` do `PromptBuilder` sales:** parece "mais
  limpo" (builder dono do próprio conteúdo), mas muda a estrutura da mensagem enviada ao Gemini
  (de `user` para `system`) mesmo mantendo o texto idêntico — isso é uma mudança de comportamento
  potencial (LLMs são sensíveis a `system` vs `user`), violando SC#4 ("sessão sales... sem
  regressão"). Ficar apenas com o `if mode == "sales":` no lugar onde já está (Pattern 3) é a opção
  que não arrisca a saída sales.
- **Promover `mode` a primeiro parâmetro posicional de `_init_coverage`:** quebra silenciosamente
  os 4 testes existentes que chamam `_init_coverage("bi")` (passariam `"bi"` como `mode`, resultando
  em `else`/sales de qualquer forma neste caso específico, mas quebra a semântica e qualquer chamada
  futura só com dois posicionais viraria bug silencioso). Ver Pattern 2.
- **`DiscoveryPromptBuilder(PromptBuilder)` (subclasse):** explicitamente proibido por D-09 — mistura
  os dois "sabores" na mesma hierarquia, tornando `isinstance`/`super()` um ponto de acoplamento que
  o CONTEXT.md quer evitar (seam Open/Closed do CLAUDE.md).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Validar que `mode` só aceita `"sales"`/`"discovery"` | `if mode not in (...): raise ValueError(...)` manual em cada endpoint | `Literal["sales", "discovery"]` no Pydantic model (mesmo padrão de `ProjectType`/`TranscriptSource` já em `backend/app/models/projects.py:8-9`) | Pydantic já rejeita valores fora do enum na borda da API (422), sem código extra e com mensagem de erro consistente com o resto do projeto |
| Gerar a string de schema JSON das 18 áreas de discovery | Montar a string `'{"areas":{"gargalo":{...}...}}'` manualmente dentro de `discovery_prompt_builder.py` | `DISCOVERY_AREA_SET.schema_json(include_not_applicable=False)` (método já existe em `AreaSet`, Fase 1) | O método já foi escrito e testado (golden test da Fase 1) para gerar exatamente esse formato a partir da lista ordenada — reescrever a string à mão reintroduz o risco que a Fase 1 eliminou |
| Migration idempotente | `DROP COLUMN` + `ADD COLUMN` ou lógica condicional em Python no startup | `ALTER TABLE projects ADD COLUMN IF NOT EXISTS mode text DEFAULT 'sales';` (mesmo padrão de `20260525000000_add_tunnel_url.sql` e `20260719000000_precificador_schema.sql`) | `IF NOT EXISTS` já é o padrão idempotente usado em 100% das migrations aditivas do repo — reaplica sem erro em qualquer ambiente |

**Key insight:** a Fase 1 já pagou o custo de construir o registry (`AreaSet`); esta fase só precisa
somar uma segunda instância dele. O maior risco não é "hand-rolling" de novo código, é **duplicar
sem querer** um comportamento sales que já existe em 4 lugares diferentes (schema, labels, hints,
CITI injection) e esquecer um deles no fork — daí a importância do golden test (Validation
Architecture, abaixo).

## Runtime State Inventory

**Não aplicável.** Esta fase é aditiva (nova coluna, nova classe, novo dataclass field) — não é uma
fase de rename/refactor/migração de dados. Não há string renomeada em produção, não há coleção/
chave de datastore para migrar, não há registro de OS/serviço externo tocado. A única mudança de
schema é `ALTER TABLE projects ADD COLUMN IF NOT EXISTS mode text DEFAULT 'sales'`, que por design
do Postgres já preenche as linhas existentes com `'sales'` sem exigir UPDATE manual (confirmado pelo
padrão idêntico em `20260525000000_add_tunnel_url.sql` e `20260525000001_add_recall_bot_id.sql`,
ambos `ADD COLUMN IF NOT EXISTS` sem UPDATE de backfill — `[VERIFIED:
supabase/migrations/20260525000000_add_tunnel_url.sql:5, 20260525000001_add_recall_bot_id.sql:4]`).

## Common Pitfalls

### Pitfall 1: CITI_PORTFOLIO está na mensagem `user`, não no `system_prompt` — fácil esquecer
**What goes wrong:** um desenvolvedor tenta satisfazer SC#3 só criando `DiscoveryPromptBuilder` sem
tocar `llm.py`. Os 3 agentes de tempo real (`coverage_classifier`/`red_flag_detector`/
`question_planner`) ficam corretos (nunca importaram CITI), mas o **relatório final** de uma sessão
discovery ainda recebe `CITI_PORTFOLIO`/`CATALOG`/`TECH_REFERENCE` porque `llm.py:184-186` injeta
isso incondicionalmente na mensagem `user`, ignorando qual builder gerou o `system_prompt`.
**Why it happens:** a injeção não está encapsulada no builder — está espalhada em `llm.py`, fora do
seam D-09.
**How to avoid:** adicionar `mode` a `generate_report()` e gatear as 3 linhas (Pattern 3). Testar
com um teste que capture a mensagem `user` (não o `system`) via monkeypatch de `llm._call`.
**Warning signs:** teste que só verifica `system_prompt` (como os testes golden da Fase 1) não pega
esse bug — é preciso capturar e inspecionar `user` também.

### Pitfall 2: `_init_coverage("bi")` quebra se `mode` virar o 1º parâmetro
**What goes wrong:** ver Pattern 2 — reordenar parâmetros quebra `test_session_state_custom_areas.py`
silenciosamente (o teste passaria a executar com `mode="bi"`, cai no `else`/sales por não ser
`"discovery"`, e o teste ainda passaria "por acidente" hoje porque `"bi"` != `"discovery"" cai no
mesmo ramo sales — mas deixa de testar o que o nome do teste diz, e quebra de verdade na primeira
chamada real com dois posicionais em ordem diferente).
**Why it happens:** `mode` parece "mais importante" que `project_type`, tentador colocar primeiro.
**How to avoid:** manter `project_type` como primeiro posicional; `mode` só como kwarg com default.
**Warning signs:** qualquer teste novo que chame `_init_coverage(<valor>, <valor>)` sem nomear os
kwargs.

### Pitfall 3: `structured_context.py` tem seu próprio hardcode de áreas sales, fora do escopo listado no CONTEXT.md
**What goes wrong:** `_EXTRACTOR_SYSTEM` (usado por `extract_structured_context`, chamado
incondicionalmente em `pipeline.py:586-594` para **qualquer** projeto com `pre_meeting_context`,
sales ou discovery) restringe `recommended_questions` aos blocos de `SALES_AREA_SET.keys()`
(`[VERIFIED: backend/app/services/structured_context.py:17,250-254]`:
`from app.services.coverage_areas import SALES_AREA_SET` ... `_EXTRACTOR_SYSTEM = (_EXTRACTOR_SYSTEM_PREFIX + "  " + " | ".join(SALES_AREA_SET.keys()) + "\n" + _EXTRACTOR_SYSTEM_SUFFIX)`).
Num projeto discovery, as perguntas pré-mapeadas extraídas do contexto pré-reunião virão rotuladas
com blocos sales (`negocio`, `eng_dados`, ...) em vez dos 18 blocos de discovery — não quebra
(o campo `block` de `Question` é texto livre, sem validação), mas produz dado semanticamente errado.
**Why it happens:** este arquivo não está listado em `canonical_refs` do CONTEXT.md — é fácil não
olhar para ele.
**How to avoid:** **não corrigir nesta fase** (fora do escopo explícito D-06..D-12; consertar aqui
seria decisão de escopo que o CONTEXT.md não autorizou). Registrar como Open Question para o
planner decidir se cria um follow-up ou aceita a limitação até a Fase 3 (quando `lens` for
formalizado).
**Warning signs:** um teste manual de discovery com `pre_meeting_context` preenchido mostrando
perguntas pinned rotuladas com blocos sales.

### Pitfall 4: fallbacks "sem `system_prompt`" em `llm.py` ficam mortos mas continuam citando só sales
**What goes wrong:** `classify_coverage`, `detect_red_flags` e `generate_questions` têm um texto de
`system` default usado **somente quando `system_prompt is None`**
(`[VERIFIED: backend/app/services/llm.py:67,87,280]`). Como `pipeline.py` **sempre** passa
`system_prompt=self.state.prompts.get(...)` (preenchido por `build_all()` de qualquer um dos dois
builders), esses fallbacks nunca são exercitados em produção — mas continuam referenciando
`SALES_AREA_SET.schema_json()`/`block_enum()` explicitamente. Se algum código futuro chamar essas
funções sem `system_prompt` num contexto discovery, herda silenciosamente o schema sales de 8 áreas.
**Why it happens:** os fallbacks existem para chamadas diretas/testes sem pipeline completo.
**How to avoid:** não é bloqueador para esta fase (pipeline sempre fornece `system_prompt`); apenas
documentar a limitação (ver Open Questions) — não vale reescrever esses fallbacks sem necessidade
concreta (evita mudar comportamento não solicitado em código que já funciona para sales).
**Warning signs:** um teste que chama `llm.classify_coverage(..., dms=None)` **sem** `system_prompt`
esperando o schema de 18 áreas — vai falhar, e é esperado falhar hoje.

### Pitfall 5: não existe repository layer para `projects` — o router fala direto com Supabase
**What goes wrong:** o CONTEXT.md cita "`backend/app/repositories/` + camada Supabase — persistir/
ler mode" como código que a fase toca, mas **não existe `ProjectRepository`** hoje — só existe
`backend/app/repositories/pricing_repository.py` (módulo Precificador). `backend/app/routers/
projects.py` chama `db.table("projects")...` diretamente em todos os endpoints
(`[VERIFIED: backend/app/routers/projects.py:1-140]`, ex. linha 62: `db.table("projects").insert(row)`).
**Why it happens:** débito arquitetural pré-existente do módulo Diagnóstico (o CLAUDE.md exige
routers→services→repositories, mas `projects.py` nunca foi migrado para esse padrão).
**How to avoid:** **não introduzir um `ProjectRepository` nesta fase** só para "consertar" isso —
seria um refactor não solicitado misturado com a feature `mode` (viola a regra do CLAUDE.md de nunca
misturar refactor com mudança de comportamento no mesmo commit). O campo `mode` funciona hoje sem
nenhuma camada nova: `ProjectCreate.model_dump(mode="json", ...)` já inclui `mode` automaticamente
no dict inserido, e `_to_response()` já espalha todas as colunas da linha (exceto as de vault) no
dict de resposta — zero código de router precisa mudar além dos models.
**Warning signs:** um plano que adiciona `ProjectRepository` "de brinde" nesta fase — é escopo
extra não pedido pelo CONTEXT.md; se o time quiser, deve ser um plano/commit separado.

### Pitfall 6: nome do parâmetro `mode="json"` do Pydantic colide visualmente com o campo `mode`
**What goes wrong:** `payload.model_dump(mode="json", exclude={...})` já existe hoje em
`create_project`/`update_project` (`[VERIFIED: backend/app/routers/projects.py:56,93-95]`). Depois
desta fase, o mesmo objeto `payload` também terá um **campo de modelo** chamado `mode`
(`payload.mode == "discovery"`). São namespaces diferentes (kwarg do método vs atributo do objeto)
e não há bug funcional, mas é fácil confundir na leitura/revisão de código ("por que `mode="json"` e
`payload.mode` na mesma linha?").
**Why it happens:** coincidência de nomes entre o parâmetro de serialização do Pydantic v2 e o novo
campo de domínio.
**How to avoid:** ao revisar o diff desta fase, não interpretar `model_dump(mode="json")` como
relacionado ao campo `mode` do projeto — são coisas diferentes. Não precisa renomear nada.
**Warning signs:** um comentário de code review perguntando "o `mode=` aqui é o modo do projeto?".

## Code Examples

### `coverage_areas.py` — adicionar `DISCOVERY_AREA_SET` (edição aditiva, mesmo módulo da Fase 1)
```python
# Source: extensão de backend/app/services/coverage_areas.py (padrão de SALES_AREA_SET, linhas 57-69)
DISCOVERY_AREA_SET = AreaSet(
    name="discovery",
    areas=(
        # Produto (0-7) — D-06
        AreaDefinition("gargalo", "Gargalo", 0),
        AreaDefinition("frente_atuacao", "Frente de Atuação", 1),
        AreaDefinition("impacto_usuario", "Impacto no Usuário", 2),
        AreaDefinition("mapeamento_processos", "Mapeamento do Fluxo de Processos", 3),
        AreaDefinition("fluxo_dados", "Fluxo dos Dados", 4),
        AreaDefinition("desenho_solucao", "Desenho da Solução", 5),
        AreaDefinition("expectativa_solucao", "Expectativa de Solução", 6),
        AreaDefinition("viabilidade_solucao", "Viabilidade da Solução", 7),
        # Dados (8-17) — D-06
        AreaDefinition("qualidade_fontes", "Fontes e Qualidade dos Dados", 8),
        AreaDefinition("metricas", "Métricas", 9),
        AreaDefinition("lgpd_seguranca", "LGPD/Segurança", 10),
        AreaDefinition("quick_wins", "Quick Wins", 11),
        AreaDefinition("ciencia_dados", "Ciência de Dados", 12),
        AreaDefinition("analise_dados", "Análise de Dados", 13),
        AreaDefinition("engenharia_dados", "Engenharia de Dados", 14),
        AreaDefinition("machine_learning", "Machine Learning", 15),
        AreaDefinition("sistemas_nuvem", "Sistemas em Nuvem", 16),
        AreaDefinition("automacoes", "Automações", 17),
    ),
)
```
Note: `ciencia_dados` já existe como key em `SALES_AREA_SET` — são registries independentes
(dicts/tuplas separados dentro do mesmo módulo), então não há colisão de namespace Python; a colisão
só apareceria se algum consumidor futuro misturasse os dois `AreaSet` no mesmo dict de cobertura, o
que esta fase não faz (D-08: são exclusivos por `mode`).

### `discovery_prompt_builder.py` — esqueleto da classe irmã (D-09)
```python
# Source: novo módulo, sibling de backend/app/services/prompt_builder.py
from app.services.coverage_areas import DISCOVERY_AREA_SET
from app.services.prompt_builder import DMS_LABEL, DMS_DESCRIPTION  # import, não duplicação

class DiscoveryPromptBuilder:
    def __init__(
        self,
        dms: "int | None",
        pre_meeting_context: str = "",
        structured_context: "object | None" = None,
    ):
        self.dms = max(1, min(5, dms)) if dms is not None else None
        self.context = pre_meeting_context or "não fornecido"
        self.dms_label = DMS_LABEL[self.dms] if self.dms is not None else "Não mapeado"
        self.dms_desc = DMS_DESCRIPTION[self.dms] if self.dms is not None else (
            "maturidade de dados ainda não avaliada para este cliente"
        )
        self.sc = structured_context if (structured_context and not structured_context.is_empty()) else None

    def _dms_str(self) -> str:  # duplicado de PromptBuilder._dms_str por decisão discricionária
        if self.dms is None:
            return f"Não mapeado ({self.dms_label}): {self.dms_desc}"
        return f"{self.dms}/5 ({self.dms_label}): {self.dms_desc}"

    def build_coverage_classifier(self) -> str:
        # Sem CITI_*, sem _area_hint/AREAS_BY_PROJECT_TYPE (D-08: 18 áreas sempre ativas).
        # Framing de discovery (D-10, proposta [ASSUMED] — ver Assumptions Log).
        return (
            "Você é um CoverageClassifier atuando como facilitador de discovery para "
            "diagnóstico de bottleneck e desenho de solução.\n"
            f"Perfil do cliente — Data Maturity Score: {self._dms_str()}.\n"
            f"Contexto pré-reunião: {self.context}\n\n"
            "Analise a transcrição e classifique a cobertura de cada área.\n"
            "Retorne APENAS JSON válido (sem markdown fences):\n"
            + DISCOVERY_AREA_SET.schema_json(include_not_applicable=False)
        )

    # build_red_flag_detector / build_question_planner / build_report_generator / build_all
    # seguem a mesma forma: mesmo _dms_str(), sem CITI_*, block_enum() de DISCOVERY_AREA_SET.
```

### `llm.py` — gate de CITi por `mode` (Pattern 3)
```python
# Source: edição em backend/app/services/llm.py:102-190
async def generate_report(
    api_key: str,
    transcript: str,
    coverage: dict,
    red_flags: list,
    questions_used: list[str],
    project_type: str,
    dms: Optional[int],
    pre_meeting_context: str = "",
    system_prompt: str | None = None,
    structured_context: Any = None,
    mode: str = "sales",          # NOVO parâmetro, default preserva comportamento atual
) -> tuple[str, int, int]:
    ...
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

### Migration Supabase (D-07)
```sql
-- Source: padrão de supabase/migrations/20260525000000_add_tunnel_url.sql
-- Migration: 20260921000000_add_mode_to_projects.sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS mode text DEFAULT 'sales';

COMMENT ON COLUMN projects.mode IS
    'Modo do projeto: sales (comportamento atual, portfólio CITi) | discovery (18 áreas Produto+Dados, sem portfólio comercial). Default sales — linhas existentes ficam sales sem backfill manual.';
```

### `models/projects.py` — campo `mode`
```python
# Source: extensão de backend/app/models/projects.py:8-9 (mesmo padrão de ProjectType/TranscriptSource)
ProjectMode = Literal["sales", "discovery"]

class ProjectCreate(BaseModel):
    ...
    mode: ProjectMode = "sales"

class ProjectUpdate(BaseModel):
    ...
    mode: Optional[ProjectMode] = None   # None ⇒ exclude_none no router não altera a coluna

class ProjectResponse(BaseModel):
    ...
    mode: ProjectMode   # sempre presente — coluna tem DEFAULT 'sales', nunca NULL após a migration
```

### Frontend — toggle mínimo (D-11)
```tsx
// Source: mesmo padrão do radio "Fonte de transcrição" em
// frontend/src/pages/ProjectFormPage.tsx:252-271
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
E em `frontend/src/lib/api.ts`: adicionar `mode: 'sales' | 'discovery'` a `Project` e
`ProjectCreate`; em `ProjectFormPage.tsx`: adicionar `mode: 'sales'` a `DEFAULT_FORM` e
`mode: (p.mode === 'discovery' ? 'discovery' : 'sales')` no `useEffect` de carregamento (mesmo
padrão defensivo já usado para `source` na linha 80).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Prompts fixos por constante (`SYSTEM_PROMPT`/`CLASSIFIER_SYSTEM_PROMPT` da v1, `diagnostico/`) | `PromptBuilder` dinâmico por `(dms, project_type, contexto)` (v2, F3 do SDD) | v2.0 (2026) | Já implementado — esta fase só adiciona um segundo builder, não reintroduz prompts fixos |
| 8 áreas hardcoded em 6 arquivos | Registry único `coverage_areas.py` (Fase 1, D-01/D-02) | 2026-09-20 (Fase 1 desta milestone) | Esta fase é o primeiro consumidor real do registry para um segundo `AreaSet` — valida que o design da Fase 1 generaliza |

Nada está "deprecated" nesta fase — é 100% aditivo.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Texto exato do enquadramento de discovery (system prompts do `DiscoveryPromptBuilder`, ex. "facilitador de discovery") — D-10 marca isso como discricionário/proposta a validar | Code Examples, `discovery_prompt_builder.py` | Baixo — é texto de prompt, reversível (D-10 é explicitamente "reversible" no CONTEXT.md); pior caso é o tom do LLM ficar diferente do esperado, corrigível sem migration |
| A2 | Import direção `discovery_prompt_builder.py → prompt_builder.py` (para reaproveitar `DMS_LABEL`/`DMS_DESCRIPTION`) é a opção recomendada em vez de duplicar os dois dicts | Standard Stack / Alternatives Considered | Baixo — CONTEXT.md deixa a decisão (composição vs duplicação) explicitamente a critério do planner; se o time preferir duplicar por isolamento total entre os dois builders, também satisfaz D-09 |
| A3 | Nenhum `CHECK` constraint na coluna `mode` (só Pydantic `Literal` na borda) — segue o padrão de `project_type`/`source`/`status` já existentes no schema | Code Examples, migration SQL | Baixo — um insert direto no Supabase (fora da API, ex. SQL editor) poderia gravar um valor de `mode` fora do enum; mesmo risco já existe hoje para `project_type`/`source`, então não é uma regressão de postura de segurança |

## Open Questions

1. **`structured_context._EXTRACTOR_SYSTEM` continua restrito a `SALES_AREA_SET.keys()` mesmo para projetos discovery (Pitfall 3)**
   - What we know: o extrator de contexto pré-reunião roda para qualquer projeto com
     `pre_meeting_context` preenchido, sales ou discovery, e hardcoda os blocos de
     `recommended_questions` como os 8 blocos sales.
   - What's unclear: se o time considera isso um defeito aceitável até a Fase 3 (quando `lens`
     for formalizado) ou se quer um ajuste mínimo já nesta fase.
   - Recommendation: não corrigir nesta fase (fora do escopo D-06..D-12 do CONTEXT.md); documentar
     como limitação conhecida no plano e deixar a decisão explícita para o time (não decidir por
     conta própria, por regra do CLAUDE.md).

2. **Fallbacks de `llm.py` sem `system_prompt` continuam hardcoded para `SALES_AREA_SET` (Pitfall 4)**
   - What we know: nunca são exercitados pelo pipeline real (que sempre passa `system_prompt`).
   - What's unclear: se algum teste futuro ou endpoint direto vai chamar essas funções sem
     `system_prompt` num contexto discovery.
   - Recommendation: não mudar agora; se aparecer essa necessidade, resolver como parte da Fase 3
     (quando o tagueamento de lens force revisitar esses fallbacks de qualquer forma).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI / acesso ao projeto Supabase | Aplicar a migration `mode` | Não verificável nesta sessão de research (sem execução de comandos externos ao repo) | — | Migration pode ser aplicada manualmente via SQL editor do dashboard Supabase, como já documentado nas migrations existentes |
| `pytest` + `pytest-asyncio` | Testes novos de `test_discovery_mode.py` | ✓ `[VERIFIED: backend/pytest.ini:1-3]` | `asyncio_mode = auto` configurado | — |
| `google.genai` | `DiscoveryPromptBuilder`/`llm.py` (sem chamada real nos testes — sempre monkeypatched) | ✓ já usado em `llm.py:5-6` | — | — |

**Missing dependencies with no fallback:** nenhuma.
**Missing dependencies with fallback:** aplicação manual da migration via dashboard Supabase, caso
o CLI/CI de migrations não esteja configurado neste ambiente (mesmo fallback que todas as migrations
anteriores já assumem implicitamente).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `pytest` + `pytest-asyncio` (`asyncio_mode = auto`) `[VERIFIED: backend/pytest.ini:1-3]` |
| Config file | `backend/pytest.ini` |
| Quick run command | `cd backend && pytest tests/test_discovery_mode.py tests/test_coverage_areas_golden.py tests/test_session_state_custom_areas.py -x` |
| Full suite command | `cd backend && pytest` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DISC-01 | `ProjectCreate`/`ProjectResponse` aceitam `mode` com default `"sales"`; valor inválido rejeitado (422) | unit (Pydantic) | `pytest tests/test_discovery_mode.py::test_project_mode_default_and_validation -x` | ❌ Wave 0 |
| DISC-02 | `_init_coverage("", mode="discovery")` retorna as 18 chaves de `DISCOVERY_AREA_SET`, sem `not_applicable`; `_init_coverage("bi")` (sem `mode`) continua idêntico ao golden atual | unit | `pytest tests/test_discovery_mode.py::test_init_coverage_discovery_mode -x` + regressão de `test_session_state_custom_areas.py` (já existente, deve continuar verde sem edição) | ❌ Wave 0 (novo) / ✅ (regressão) |
| DISC-03 | `DiscoveryPromptBuilder.build_coverage_classifier()`/`build_red_flag_detector()`/`build_question_planner()` contêm string de calibração DMS e NÃO contêm `"CITi"`/`"PORTFÓLIO CITi"`; `llm.generate_report(..., mode="discovery")` — mensagem `user` capturada via monkeypatch NÃO contém `CITI_PORTFOLIO`; mesma chamada com `mode="sales"` (ou omitido) CONTÉM, byte-idêntico ao golden da Fase 1 | unit | `pytest tests/test_discovery_mode.py::test_discovery_prompts_omit_citi_keep_dms tests/test_discovery_mode.py::test_generate_report_citi_gated_by_mode -x` | ❌ Wave 0 |
| SC#4 (regressão sales) | Suite golden da Fase 1 (`test_coverage_areas_golden.py`, 9 testes) continua 100% verde sem edição após esta fase | unit (regressão) | `pytest tests/test_coverage_areas_golden.py -v` | ✅ (já existe — só precisa continuar passando) |

### Sampling Rate
- **Per task commit:** `pytest tests/test_discovery_mode.py tests/test_coverage_areas_golden.py -x`
- **Per wave merge:** `pytest` (suite completa do backend)
- **Phase gate:** suite completa verde, incluindo os 9 testes golden da Fase 1 sem nenhuma edição
  neles, antes de `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `backend/tests/test_discovery_mode.py` — cobre DISC-01/02/03 acima (novo arquivo).
- [ ] Fixture opcional `backend/tests/fixtures/discovery_area_keys.txt` (lista das 18 chaves na
  ordem D-06) para espelhar o padrão de `tests/fixtures/*.txt` já usado pelo golden test da Fase 1
  — não é estritamente necessário (as 18 chaves podem ficar inline no teste), mas mantém o mesmo
  estilo de "literal congelado em arquivo" se o planner preferir.
- [ ] Nenhum framework novo a instalar — `pytest-asyncio` já configurado.

## Security Domain

`security_enforcement` não está definido em `.planning/config.json` como `false`
(`[VERIFIED: .planning/config.json:1-18]`, chave ausente) — tratado como habilitado.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | não | Fase não toca autenticação |
| V3 Session Management | não | Fase não toca sessão de usuário HTTP (a "session" do domínio, `sessions` table, não é afetada em auth) |
| V4 Access Control | não | Sem mudança de RBAC/RLS nesta fase |
| V5 Input Validation | sim | `Literal["sales","discovery"]` no Pydantic (mesmo padrão de `ProjectType`/`TranscriptSource` já existentes) — rejeita qualquer valor fora do enum na borda da API com 422 |
| V6 Cryptography | não | `mode` não é secreto; não interage com o fluxo de Vault (`gemini_api_key_secret_id`) |

### Known Threat Patterns for este stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Valor de `mode` fora do enum inserido diretamente no Postgres (bypass da API) | Tampering | Já mitigado da mesma forma que `project_type`/`source` hoje: a aplicação sempre lê/escreve via Pydantic `Literal`; um insert manual fora da API é um risco pré-existente idêntico, não uma regressão introduzida por esta fase |
| Confusão de `mode` com `project_type` levando a lógica de calibração errada (ex. aplicar `AREAS_BY_PROJECT_TYPE` num projeto discovery) | Tampering (lógica) | D-08 resolve isso explicitamente: o ramo `mode == "discovery"` em `_init_coverage` ignora `AREAS_BY_PROJECT_TYPE` por construção — não há caminho de código que misture os dois |

## Sources

### Primary (HIGH confidence)
- Leitura direta do código-fonte nesta sessão — `backend/app/services/coverage_areas.py`,
  `prompt_builder.py`, `llm.py`, `pipeline.py`, `session_state.py`, `structured_context.py`,
  `backend/app/models/projects.py`, `backend/app/routers/projects.py`, `backend/app/database.py`,
  `backend/tests/test_coverage_areas_golden.py`, `test_session_state_custom_areas.py`,
  `test_projects.py`, `backend/pytest.ini`, `supabase/migrations/*.sql` (todas as 9 migrations
  existentes), `frontend/src/pages/ProjectFormPage.tsx`, `frontend/src/lib/api.ts`,
  `frontend/src/lib/useSessionWS.ts`.
- `.planning/phases/02-discovery-mode-discoverypromptbuilder/02-CONTEXT.md` — decisões D-06..D-12
  do usuário (autoridade de domínio via `/gsd-discuss-phase`).
- `.planning/phases/01-area-set-registry/01-CONTEXT.md` — D-01..D-05, o seam que esta fase consome.

### Secondary (MEDIUM confidence)
- Nenhuma fonte externa (WebSearch/docs) foi necessária — todo o trabalho desta fase é interno ao
  repositório; não há biblioteca nova a documentar.

### Tertiary (LOW confidence)
- Nenhuma.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — nenhuma dependência nova, tudo confirmado por leitura direta do código.
- Architecture: HIGH — todos os pontos de fork (`_init_coverage`, seleção de builder, injeção CITI)
  foram lidos linha-a-linha e citados.
- Pitfalls: HIGH — os 6 pitfalls vêm de comportamento observado no código atual (não de suposição),
  incluindo os 4 testes existentes que fixam a assinatura de `_init_coverage`.
- Framing de discovery (D-10): LOW/ASSUMED — é uma proposta de texto, explicitamente marcada pelo
  CONTEXT.md como discricionária/a validar.

**Research date:** 2026-09-20
**Valid until:** 2026-10-20 (30 dias — código interno estável, sem dependência de API externa
sujeita a mudança rápida)
