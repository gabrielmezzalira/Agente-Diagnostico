# Phase 2: Discovery Mode + DiscoveryPromptBuilder - Context

**Gathered:** 2026-09-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Um projeto marcado com `mode=discovery` roda o pipeline realtime existente (coverage,
red-flags, questions, report) sobre um **novo conjunto de áreas de discovery** com
**enquadramento de discovery** — sem o portfólio de vendas CITi, mantendo a calibração por
Data Maturity Score (DMS). Projetos `mode=sales` continuam **byte-a-byte idênticos** ao
comportamento atual.

**In scope (esta fase):**
- Backend: nova coluna `mode` em `projects` (enum `sales|discovery`, default `sales`) +
  migration + modelos Pydantic (`ProjectCreate/Update/Response`) + repositório.
- Registry: `DISCOVERY_AREA_SET` (18 áreas) em `coverage_areas.py`, coexistindo com
  `SALES_AREA_SET` (segue o seam D-01/D-02 da Fase 1).
- Prompts: `DiscoveryPromptBuilder` (classe separada) + seleção do builder por `mode` no
  ponto onde os prompts são montados (`llm.py` / `pipeline.py`), injetando
  `CITI_PORTFOLIO/CATALOG/TECH` **apenas** no sales.
- Pipeline/session: `mode` flui do projeto até a inicialização da cobertura; no discovery
  as 18 áreas ficam **sempre ativas** (sem o esquema `critical/optional/inactive` por
  `project_type` do sales).
- Frontend: **toggle mínimo** `sales|discovery` no formulário de projeto existente, para a
  feature ser testável ponta a ponta.

**Out of scope (esta fase):**
- Tags de lente (`produto`/`dados`) em áreas/red-flags/questions → **Fase 3** (LENS-04).
- Dois agentes (Produto + Dados) na geração de perguntas → **Fase 3**.
- UI rica de duas lentes no monitoramento (agrupamento por lente, badges, render
  server-driven) → **Fase 5**.
- Seção "Métricas para Precificação" no relatório + handoff → **Fase 4**.
- Remoção da cópia de áreas do frontend (`useSessionWS.ts`) → **Fase 5** (UI-03).

</domain>

<decisions>
## Implementation Decisions

### Áreas de discovery (Decisão "As 18 áreas de discovery")
- **D-06:** O `DISCOVERY_AREA_SET` tem **18 áreas** (não 11 como no roadmap original — o
  usuário, autoridade de domínio, somou as 11 iniciais com novas disciplinas e o resultado
  foi reduzido de 22 para 18 fundindo duplicatas). Keys em `snake_case` PT, mesmo estilo do
  sales. Ordem: Produto (order 0-7) depois Dados (order 8-17). — **Reversibility:** costly —
  a lista vira o contrato que a Fase 3 (tagueamento de lente) e a Fase 5 (agrupamento na UI)
  consomem; mudar depois obriga a rever esses consumidores e os relatórios já gerados.

  **Produto (8):**
  | order | key | label |
  |-------|-----|-------|
  | 0 | `gargalo` | Gargalo |
  | 1 | `frente_atuacao` | Frente de Atuação |
  | 2 | `impacto_usuario` | Impacto no Usuário |
  | 3 | `mapeamento_processos` | Mapeamento do Fluxo de Processos |
  | 4 | `fluxo_dados` | Fluxo dos Dados |
  | 5 | `desenho_solucao` | Desenho da Solução |
  | 6 | `expectativa_solucao` | Expectativa de Solução |
  | 7 | `viabilidade_solucao` | Viabilidade da Solução |

  **Dados (10):**
  | order | key | label |
  |-------|-----|-------|
  | 8 | `qualidade_fontes` | Fontes e Qualidade dos Dados |
  | 9 | `metricas` | Métricas |
  | 10 | `lgpd_seguranca` | LGPD/Segurança |
  | 11 | `quick_wins` | Quick Wins |
  | 12 | `ciencia_dados` | Ciência de Dados |
  | 13 | `analise_dados` | Análise de Dados |
  | 14 | `engenharia_dados` | Engenharia de Dados |
  | 15 | `machine_learning` | Machine Learning |
  | 16 | `sistemas_nuvem` | Sistemas em Nuvem |
  | 17 | `automacoes` | Automações |

- **D-06a [informational] (proveniência das fusões — para o planner não "recriar" áreas):** a lista foi
  derivada assim, a partir das 11 originais + adições do usuário: `mapeamento_processo` +
  `mapeamento_processos` → `mapeamento_processos`; `viabilidade_entrega` +
  `fit_solucao_cliente` → `viabilidade_solucao`; `desenho_solucao` + `abordagem_solucao` →
  `desenho_solucao`; `fontes_dados` + `qualidade_dados` → `qualidade_fontes`. `metricas`,
  `lgpd_seguranca` e `quick_wins` foram **mantidas de propósito** (métricas importa para a
  Fase 4; LGPD é preocupação Dados no PROJECT.md).
- **D-06b [informational] (agrupamento Produto/Dados):** a divisão Produto/Dados existe conceitualmente e é
  codificada **pela ordem** (0-7 Produto, 8-17 Dados) nesta fase. O **campo `lens`
  explícito** em `AreaDefinition` é decisão da Fase 3 — não adicionar agora, mas manter a
  ordem agrupada para a Fase 3 aproveitar. (Se o planner quiser já reservar um campo `lens`
  opcional no dataclass sem usá-lo, é discricionário e aceitável, desde que não altere a
  saída do sales — D-03 da Fase 1.)

### Modo do projeto e papel do `project_type` (Decisão "Armazenamento do mode")
- **D-07:** Nova coluna **`mode`** em `projects`, enum `sales|discovery`, **default `sales`**.
  Linhas existentes ficam intactas (continuam sales sem backfill manual). Refletir em
  `ProjectCreate`/`ProjectUpdate`/`ProjectResponse` (Pydantic `Literal["sales","discovery"]`).
  — **Reversibility:** one-way — é uma coluna nova em tabela do Supabase; reverter exige
  migration de remoção e afeta o contrato da API `/projects`. O default `sales` é o que
  garante o SC#4 (nenhuma regressão para projetos existentes).
- **D-08:** No discovery, as **18 áreas ficam sempre ativas** — não há o esquema
  `critical/optional/inactive` por `project_type` que o sales usa (`AREAS_BY_PROJECT_TYPE`).
  Logo `project_type` (bi/ml/…) é **opcional/ignorado** no discovery: não seleciona áreas
  nem calibra hints. Continua obrigatório-como-hoje só no sales.
  **Ponto de atenção para o planner:** `session_state._init_coverage` e o
  `_area_hint`/`build_coverage_classifier` do sales dependem de `AREAS_BY_PROJECT_TYPE`;
  o caminho discovery precisa de um ramo próprio que ative todas as áreas do
  `DISCOVERY_AREA_SET`, sem quebrar o caminho sales (nem o hook `custom_areas`, D-04 da Fase 1).

### Forma do DiscoveryPromptBuilder (Decisão "Forma do builder")
- **D-09:** `DiscoveryPromptBuilder` é uma **classe separada, irmã** de `PromptBuilder`
  (não subclasse, não flag interno), reaproveitando os helpers de DMS (`DMS_LABEL`,
  `DMS_DESCRIPTION`, `_dms_str`, e a lógica de calibração por faixa de DMS). O ponto de
  montagem de prompt (`llm.py` / `pipeline.py`) **seleciona o builder pelo `mode`**. O
  `CITI_PORTFOLIO` + `CITI_SERVICE_CATALOG` + `CITI_TECH_REFERENCE` (hoje importados e
  concatenados em `llm.py:114/184`) são injetados **apenas no caminho sales**. —
  **Reversibility:** costly — a escolha de "classe separada" é o seam Open/Closed do CLAUDE.md;
  trocar por subclasse/flag depois mexe no ponto de seleção e nos dois builders.
  **Ponto de atenção:** hoje a injeção de CITI vive em `llm.py`, não no `PromptBuilder`.
  Decidir com o research se o builder passa a ser o dono do texto CITi (encapsulamento) ou se
  `llm.py` continua injetando só quando `mode==sales`. Preferência: mover para o seam do
  builder para respeitar SRP, mas sem alterar o texto sales (D-03 da Fase 1 vale: saída sales
  byte-idêntica).

### Enquadramento (framing) dos prompts de discovery (Decisão "Framing")
- **D-10:** Os prompts de discovery **removem** o portfólio de vendas CITi, **mantêm** a
  calibração por DMS (tom e profundidade por faixa 1-5) e **adicionam** um enquadramento de
  discovery — o agente age como facilitador que mapeia o gargalo, o fluxo de processos, o
  desenho/expectativa/viabilidade da solução e o estado/abordagem de dados. O texto exato do
  enquadramento é **discricionário do research/planner** (proposta a validar), desde que
  cumpra o SC#3: sem CITI_PORTFOLIO, com DMS. — **Reversibility:** reversible (texto de prompt).

### Frontend
- **D-11:** Esta fase inclui um **toggle mínimo** `sales|discovery` no formulário de projeto
  já existente (create/edit), para a feature ser testável ponta a ponta. **Não** inclui a UI
  de duas lentes no monitoramento (Fase 5). O toggle só grava/edita o campo `mode`.

### Roadmap/Requirements a atualizar (consequência de D-06)
- **D-12 [informational]:** Como a lista virou 18 (não 11), o texto de `ROADMAP.md` (§Phase 2, SC#2) e de
  `REQUIREMENTS.md` (DISC-02) que diz "11 discovery areas" deve ser atualizado para "18" na
  execução, para os documentos não mentirem. Isto é ajuste de texto de planejamento, não
  mudança de escopo. — **Reversibility:** reversible.

### Claude's Discretion
- Texto exato do enquadramento de discovery (D-10) e dos hints por área.
- Se o `DiscoveryPromptBuilder` herda helpers via composição (função utilitária de DMS
  compartilhada) ou os duplica — desde que D-09 (classe separada) e o comportamento valham.
- Nome/localização da migration e formato do enum no Postgres (`text` + CHECK vs enum nativo),
  desde que default `sales` e compatível com o cliente Supabase atual.
- Se reserva ou não um campo `lens` opcional em `AreaDefinition` já nesta fase (D-06b).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Definição da fase & requisitos
- `.planning/ROADMAP.md` §"Phase 2: Discovery Mode + DiscoveryPromptBuilder" — goal + 4
  success criteria. **NOTA:** o texto diz "11 areas"; D-06/D-12 elevam para 18 — atualizar.
- `.planning/REQUIREMENTS.md` → **DISC-01, DISC-02, DISC-03** (e DISC-04 já concluído na Fase 1).

### Decisões & regras do projeto
- `.planning/PROJECT.md` §"Key Decisions" — "Pivot sales → discovery, keep sales behind
  `mode` flag" e "Two agents only at the question stage" e "Single coverage-area registry".
- `CLAUDE.md` §"Idioma das Respostas" (respostas em PT), §"Princípios de Arquitetura de Código"
  (SOLID / Open-Closed — base de D-09), §"Regras de Planejamento de Tasks" (7 seções
  obrigatórias; nunca misturar refactor com mudança de comportamento no mesmo commit).
- `.planning/phases/01-area-set-registry/01-CONTEXT.md` — D-01 (área-sets nomeados), D-02
  (registry absorve labels + `AREAS_BY_PROJECT_TYPE`), D-03 (saída sales byte-idêntica),
  D-04 (não quebrar `custom_areas`), D-05 (frontend fica na Fase 5).

### Código que a fase toca
- `backend/app/services/coverage_areas.py` — `AreaSet`/`AreaDefinition`, `SALES_AREA_SET`,
  `AREAS_BY_PROJECT_TYPE`; adicionar `DISCOVERY_AREA_SET`.
- `backend/app/services/prompt_builder.py` — `PromptBuilder` (linha 222), helpers de DMS
  (`DMS_LABEL` 9, `DMS_DESCRIPTION` 17, `_dms_str` 268), `CITI_PORTFOLIO` (108),
  `CITI_SERVICE_CATALOG` (143), `CITI_TECH_REFERENCE` (192), `_area_hint` (245),
  `build_coverage_classifier` (273), `build_red_flag_detector` (341), `build_question_planner` (401).
- `backend/app/services/llm.py` — importação/concat de CITI (114, 184); é onde o framing
  sales é injetado hoje.
- `backend/app/services/pipeline.py` — instancia `PromptBuilder` (596) e passa
  `project_type`/`data_maturity_score` (363-364, 597-617); ponto onde `mode` precisa fluir.
- `backend/app/services/session_state.py` — `_init_coverage`, merge de `custom_areas`,
  `project_type`, `data_maturity_score`.
- `backend/app/models/projects.py` — `ProjectType`, `ProjectCreate/Update/Response`;
  adicionar `mode`.
- `backend/app/repositories/` + camada Supabase — persistir/ler `mode`; migration da coluna.
- Frontend: formulário de projeto (create/edit) — adicionar toggle `mode` (localizar o
  componente/página de projeto; o planner confirma o caminho exato).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Seam da Fase 1 (D-01/D-02):** adicionar um novo `AreaSet` é edição só do
  `coverage_areas.py`; `keys()`, `labels()`, `schema_json()`, `block_enum()` já geram todas
  as strings derivadas. O `DISCOVERY_AREA_SET` entra por aí, sem tocar os consumidores para o
  schema/labels/enum — exceto onde a **seleção por `mode`** precisa acontecer.
- **Helpers de DMS no `PromptBuilder`:** `DMS_LABEL`, `DMS_DESCRIPTION`, `_dms_str` e a
  calibração por faixa (`dms is None` / `<=2` / `==3` / `4-5`) são o que o
  `DiscoveryPromptBuilder` reaproveita (D-09) — o que muda é o framing, não a calibração.
- **Teste golden da Fase 1:** repetir o padrão para provar o SC#4 — congelar a saída
  sales-mode (coverage/red-flag/question/report) antes e depois e assertar byte-idêntica.

### Established Patterns
- Duas camadas: **máquina mode-agnóstica** (pipeline, session_state, WebSocket, webhook,
  budget) e **conteúdo sales-flavored** (texto de prompt + nomes de área). Discovery adiciona
  um segundo "sabor" de conteúdo; a máquina não muda. É isso que torna o SC#4 factível.
- Prompts em português; identificadores/keys em `snake_case` inglês/PT (o sales usa PT:
  `negocio`, `eng_dados` — discovery segue o mesmo estilo).
- `project_type` hoje é `Optional` no modelo — adicionar `mode` como campo paralelo,
  também tipado por `Literal`.

### Integration Points
- `mode` precisa fluir: `projects` (DB) → `ProjectResponse` → `pipeline`/`session_state` →
  seleção de `AreaSet` (`_init_coverage`) e seleção de builder (`llm.py`/`pipeline`).
- O ramo discovery de `_init_coverage` ativa todas as 18 áreas; o ramo sales continua com
  `AREAS_BY_PROJECT_TYPE` + hook `custom_areas` intactos.
- `coverage_update` (WebSocket) passa a emitir 18 áreas no discovery, 8 no sales — o frontend
  ainda tem cópia própria de áreas (D-05, Fase 5), então nesta fase o discovery é validável
  via a extensão/stream existentes olhando o payload do `coverage_update`.

</code_context>

<specifics>
## Specific Ideas

- Teste golden sales-mode como semente de aceitação do SC#4 (byte-idêntico antes/depois),
  no mesmo espírito da Fase 1 — é o ≥1 teste real que a fase deixa.
- Um teste que prove o SC#3: prompt discovery **não contém** `CITI_PORTFOLIO` mas **contém**
  a string de calibração de DMS.
- Um teste que prove o SC#2: sessão discovery inicializa cobertura com as 18 keys do
  `DISCOVERY_AREA_SET` (e sessão sales com as 8 do `SALES_AREA_SET`).

</specifics>

<deferred>
## Deferred Ideas

- **Tags de lente explícitas (`produto`/`dados`) + dois agentes (Produto/Dados) na geração
  de perguntas:** Fase 3 (LENS-01..05). Nesta fase o agrupamento é só pela ordem (D-06b).
- **Enxugar mais o lado Dados** (fundir `ciencia_dados`/`analise_dados`/`machine_learning`,
  que se sobrepõem): o usuário optou por mantê-los separados nesta fase; revisitar se a
  classificação em tempo real ficar diluída/cara demais na prática.
- **Seção "Métricas para Precificação" no relatório + handoff import-from-diagnosis:** Fase 4.
- **UI de duas lentes no monitoramento (agrupamento, badges, render server-driven) e remoção
  da cópia de áreas do frontend:** Fase 5 (UI-01/02/03).
- **Áreas de discovery dinâmicas por cliente (`generate_custom_areas`):** DISCF-02, milestone
  futuro.
- **Deletar sales / CITI_PORTFOLIO de vez:** decisão de TEAM/ROADMAP, só depois de validar
  discovery ponta a ponta; segue atrás do flag `mode`.

</deferred>

---

*Phase: 2-discovery-mode-discoverypromptbuilder*
*Context gathered: 2026-09-20*
