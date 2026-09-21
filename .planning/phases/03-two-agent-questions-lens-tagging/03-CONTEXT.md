# Phase 3: Two-Agent Questions + Lens Tagging - Context

**Gathered:** 2026-09-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Numa sessão **discovery**, dois planejadores de perguntas — **Produto** (primário) e
**Dados** (auxiliar) — geram perguntas para **uma única fila compartilhada**, e toda
**área de cobertura**, **red flag** e **pergunta** passa a carregar uma tag de lente
(`produto` ou `dados`), sem perguntas duplicadas entre os dois agentes. O modo **sales**
continua **byte-a-byte idêntico** (um único planner, `lens` vazio, sem contador de Dados).

**In scope (esta fase):**
- **Dois agentes na etapa de perguntas** (só discovery): dividir o `_run_question_planner`
  (`pipeline.py:282-344`) em Produto → Dados, cada um com prompt escopado à sua lente,
  vindo do `DiscoveryPromptBuilder`.
- **Cadência do Dados:** contador determinístico — Produto roda em todo gatilho, Dados a
  cada 2º e só a partir do fechamento do contador (D-13).
- **Tag de lente em 3 lugares:** coluna `lens` (nullable) em `questions` e `red_flags`
  (migration aditiva) + campo `lens` explícito em `AreaDefinition` no registro
  (`coverage_areas.py`) para as 18 áreas discovery (D-18, D-19).
- **Lente nos red flags:** o detector único passa a classificar a lente por alerta (novo
  campo no contrato JSON), fallback `produto` (D-15).
- **Dedup compartilhado entre agentes:** ordem sequencial (Dados vê as perguntas frescas do
  Produto) + trava de texto normalizado no código (D-16, D-17).
- **Emissão da lente no WebSocket:** `question_new`, `red_flag` e `coverage_update` passam a
  carregar `lens` no payload (serialização via `__dict__` já propaga o campo novo).

**Out of scope (esta fase):**
- **Badges e agrupamento por lente na UI** (desenhar/agrupar na tela) → **Fase 5** (UI-01/UI-02).
  Esta fase só **emite** `lens`; a validação é por payload/banco, não visual.
- **Render server-driven das áreas no frontend** (remover a cópia de áreas do front) → **Fase 5** (UI-03).
- **Seção "Métricas para Precificação" no relatório + handoff** → **Fase 4** (REP-01/02).
- **Segundo pipeline de coverage ou de red-flags** (dois classificadores/detectores) →
  **fora de escopo do milestone** (coverage e red-flags ficam 1×, decisão travada no PROJECT.md).
- **Dedup semântico** (embeddings/similaridade) → mantém dedup por texto; semântico é
  melhoria futura se a repetição textual não bastar na prática.

</domain>

<decisions>
## Implementation Decisions

> Numeração continua a partir da Fase 2 (última decisão foi D-12).

### Cadência dos dois agentes (Decisão "Cadência do Dados")
- **D-13:** **Contador determinístico** para o agente Dados. Em toda sessão discovery, o
  **Produto** roda em **todo** gatilho de geração de perguntas; o **Dados** roda **a cada 2º
  gatilho** e **só quando o contador fecha o ciclo** — nunca no 1º gatilho da sessão (ex.:
  Dados roda nos gatilhos 2, 4, 6…). Isso cumpre o SC#3 ("Dados em cadência visivelmente mais
  lenta, não em todo ciclo") de forma trivial de provar. O contador é estado em memória da
  sessão. — **Reversibility:** reversible (valor `N=2` e o gate são lógica local em
  `_run_question_planner`; ajustável depois).
- **D-14:** **Teto da fila continua 5, compartilhado**, com o Produto tendo **prioridade**.
  Sem cotas rígidas por lente e **sem** aumentar o teto no discovery. Como o Dados roda em
  sequência depois do Produto e menos vezes, o Produto naturalmente ocupa primeiro; o Dados
  entra no espaço restante. — **Reversibility:** reversible.
- **D-20:** **Quantidade por agente por run:** Produto pede **até 3** perguntas, Dados pede
  **até 2** (soma = 5, cabe exatamente no teto de D-14 num ciclo em que os dois rodam, sem
  overflow). Mantém "Produto primário" (roda toda vez, pede mais) e garante que quando o
  Dados roda ele consegue aparecer. — **Reversibility:** reversible (números no prompt/params
  de `generate_questions`).

### Lente nas perguntas (autoria) (Decisão "Autoria da lente")
- **D-21:** A **lente é autoritária do agente que gerou**, não derivada do `block`. O
  orquestrador (`_run_question_planner`) seta `lens="produto"` no laço que persiste as
  perguntas do planner Produto e `lens="dados"` no do Dados — independente de qual `block`
  (uma das 18 keys de área) o LLM devolveu. `block` continua sendo a área temática
  (informativa); em caso de conflito, a **lente vence**. Sem código de reconciliação. —
  **Reversibility:** reversible.

### Lente nos red flags (Decisão "Lente RF")
- **D-15:** O detector de red flags continua **único** (1×, travado no PROJECT.md), mas passa
  a **classificar a lente por alerta**: adiciona-se `lens` ao contrato JSON de
  `detect_red_flags` (`llm.py:82-99`) e a instrução no prompt do `build_red_flag_detector`
  (produto = gargalo/processo/viabilidade; dados = fontes/qualidade/LGPD/métricas). —
  **Reversibility:** costly — muda o contrato JSON que o parser de red flags espera; se o
  campo mudar de forma, o parser e as inserções em `red_flags` precisam acompanhar.
- **D-22:** **Fallback `produto`** — se o LLM devolver a lente vazia/ausente/inválida num
  alerta, o código assume `produto` (a lente primária). Garante que nenhum red flag fique sem
  tag (SC#2), sem heurística de derivação por texto. — **Reversibility:** reversible.

### Orquestração e dedup (Decisão "Orquestração + dedup")
- **D-16:** **Execução sequencial Produto → Dados** dentro do gatilho. O Produto gera
  primeiro; o Dados recebe as perguntas **recém-geradas** do Produto no seu contexto de
  anti-repetição (`recent`, montado em `pipeline.py:294-302`). Isso garante zero duplicata
  **entre agentes na origem** (SC#4/#5). Duas chamadas LLM em série, aceitável porque a
  geração é por gatilho (não é caminho quente de render). — **Reversibility:** reversible.
- **D-17:** **Dedup em duas camadas:** mantém a lista compartilhada "Perguntas recentes (não
  repetir)" no prompt (padrão atual, compartilhada entre as duas lentes) **e** adiciona no
  código uma **trava de texto normalizado** (minúsculas/trim): descarta pergunta cujo texto
  normalizado já exista na fila. Rede de segurança barata para o SC#5, sem custo de LLM. —
  **Reversibility:** reversible.

### Modelo de dados da lente (Decisão "Modelo de dados da lente")
- **D-18:** **Coluna `lens` persistida (nullable)** em `questions` e `red_flags`, via
  **migration aditiva**; `NULL` no sales, `produto`/`dados` no discovery. O campo entra nos
  dataclasses `Question`/`RedFlag` (`session_state.py:53-71`) e, como o broadcast serializa
  via `__dict__`, propaga automaticamente para o WebSocket. Persistir (em vez de derivar) é
  necessário porque o histórico e o relatório da Fase 4 leem a lente gravada, e o red flag não
  tem área para derivar. — **Reversibility:** one-way — colunas novas em tabelas do Supabase;
  reverter exige migration de remoção. Aditiva/nullable garante que sales e linhas antigas
  ficam intactas.
- **D-19:** **Campo `lens` explícito em `AreaDefinition`** (`coverage_areas.py`). As 18 áreas
  do `DISCOVERY_AREA_SET` ganham `produto` (order 0-7) / `dados` (order 8-17); as 8 do
  `SALES_AREA_SET` ficam com `lens=None`. `coverage_update` passa a emitir a lente por área
  **derivada do registro** (não da ordem em runtime). É o campo que a Fase 2 (D-06b) reservou
  para esta fase; torna o agrupamento da Fase 5 trivial. — **Reversibility:** costly — vira o
  contrato que a Fase 5 (agrupamento por lente na UI) consome; a saída sales deve permanecer
  byte-idêntica (lens=None não pode alterar o schema/labels do sales — D-03 da Fase 1).

### Persistência dos prompts gerados (Decisão "session_prompts")
- **D-23:** **Gravar os dois prompts de planner separados.** Em memória,
  `state.prompts["question_planner_produto"]` e `["question_planner_dados"]`; na tabela
  `session_prompts`, dois valores de `agent` novos (`question_planner_produto`,
  `question_planner_dados`). Isso **implica ampliar o enum `agent`** de `session_prompts` —
  **migration aditiva**, no mesmo pacote das colunas `lens` (D-18). Mantém reprodutibilidade/
  debug por lente. — **Reversibility:** one-way — enum novo em tabela Supabase; aditivo, não
  quebra os valores existentes (`coverage_classifier`, `red_flag_detector`, `question_planner`).

### Regressão sales (Decisão "Regressão sales")
- **D-24:** **Gate explícito por `mode` + teste-semente.** Todo o ramo de dois agentes,
  contador de Dados e preenchimento de `lens` só entra quando `mode=="discovery"`; o sales cai
  no caminho de **um** planner de hoje, com `lens` vazio. Deixar **ao menos 1 teste real**
  provando: sessão sales gera perguntas com um único planner, `lens` NULL em questions/red_flags,
  nenhum contador de Dados criado, e saída de coverage sales inalterada. É o análogo do golden
  test das Fases 1 e 2. — **Reversibility:** reversible (test/guard).

### Claude's Discretion
- **Split dos prompts por lente:** como o `DiscoveryPromptBuilder.build_question_planner` vira
  dois prompts escopados (ex.: `build_question_planner(lens="produto"|"dados")` restrito às
  áreas + tópicos daquela lente). Tópicos por lente são o contrato do SC#1 (ver Canonical Refs).
- **Texto exato do enquadramento** de cada agente (Produto vs Dados) — proposta do research a
  validar, análogo à discrição de framing da Fase 2 (D-10).
- **Localização/forma do contador do Dados** (campo em `SessionState` vs no `SessionPipeline`),
  desde que seja estado em memória por sessão e cumpra D-13.
- **Formato exato da normalização** do texto na trava de dedup (D-17), desde que seja
  determinística e barata.
- **Detalhe da migration** (nome/arquivo, `text` nullable vs enum, ordem das colunas), desde que
  aditiva e compatível com o cliente Supabase atual, e que amplie o enum de `session_prompts`
  (D-23) no mesmo pacote.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Definição da fase & requisitos
- `.planning/ROADMAP.md` §"Phase 3: Two-Agent Questions + Lens Tagging" — goal + 4 success
  criteria (define os tópicos de cada lente: Produto = gargalo, frente de atuação, impacto no
  usuário, mapeamento de processos, viabilidade de entrega; Dados = fontes, qualidade, métricas,
  LGPD/segurança, abordagem de solução, quick wins).
- `.planning/REQUIREMENTS.md` → **LENS-01, LENS-02, LENS-03, LENS-04, LENS-05**.

### Decisões & regras do projeto
- `.planning/PROJECT.md` §"Key Decisions" — "Two agents only at the question stage (coverage +
  red-flags stay 1×)" (trava o escopo: não criar 2º classificador/detector).
- `CLAUDE.md` §"Idioma das Respostas" (PT), §"Princípios de Arquitetura de Código" (SOLID /
  Open-Closed — base do split de builders por lente), §"Regras de Planejamento de Tasks" (7
  seções obrigatórias; nunca misturar refactor com mudança de comportamento no mesmo commit).
- `.planning/phases/02-discovery-mode-discoverypromptbuilder/02-CONTEXT.md` — D-06 (18 áreas,
  ordem 0-7 Produto / 8-17 Dados), **D-06b (reserva do campo `lens` em `AreaDefinition` para
  esta fase)**, D-07 (coluna `mode`), D-09 (`DiscoveryPromptBuilder` é classe irmã duck-typed),
  D-08 (discovery ativa todas as áreas).
- `.planning/phases/01-area-set-registry/01-CONTEXT.md` — D-01/D-02 (registry gera schema/labels),
  **D-03 (saída sales byte-idêntica)**, D-04 (não quebrar `custom_areas`).

### Código que a fase toca (com âncoras do scout)
- `backend/app/services/pipeline.py` — `_run_question_planner` (282-344, ponto do split de dois
  agentes + contador + `lens`), `trigger_questions` (95-96), cap de 5 (290-291, 319-321),
  montagem de `recent`/anti-repeat (294-302), inserts em `questions` (322-341),
  `_run_red_flag_detector` (244-280) + inserts em `red_flags` (269-277), broadcast
  `question_new` (342-344) / `red_flag` (278-280) / `coverage_update` (238-242), seleção de
  builder por `mode` (598-612).
- `backend/app/services/discovery_prompt_builder.py` — `build_question_planner` (155-205, vira
  split por lente), `build_red_flag_detector` (100-149, ganha instrução de `lens`), `build_all`
  (243-249, passa a montar prompts por lente).
- `backend/app/services/prompt_builder.py` — `build_question_planner` (401-454) e
  `build_red_flag_detector` (341-395) do **sales** (não mudar comportamento; só o discovery ganha
  a lente).
- `backend/app/services/llm.py` — `generate_questions` (255-314, `recent_text` 271, user msg
  302-308) e `detect_red_flags` (82-99, contrato JSON ganha `lens`).
- `backend/app/services/coverage_areas.py` — `AreaDefinition` (ganha campo `lens`),
  `DISCOVERY_AREA_SET` (76-100), `SALES_AREA_SET` (`lens=None`), `block_enum()`.
- `backend/app/services/session_state.py` — dataclasses `Question` (62-71), `RedFlag` (53-59),
  `CoverageArea` (45-50, `coverage_to_dict` 143-147 emite lente por área), `mode` (78).
- `backend/app/models/questions.py` — `QuestionResponse` (12-20) ganha `lens`.
- `supabase/migrations/` — nova migration aditiva: `questions.lens`, `red_flags.lens` (nullable),
  e ampliação do enum `agent` de `session_prompts` (schema inicial em
  `20260524000000_initial_schema.sql:76-98,139-145`).
- `backend/app/routers/ws.py` (45-79) e `routers/sessions.py` (300-307) — gatilhos de geração
  (não precisam mudar de contrato; só passam pelo novo `_run_question_planner`).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Fila única já existe:** `state.questions: List[Question]` (`session_state.py:91`) — o cap de
  5 e o anti-repeat já operam sobre essa lista única, então "dois agentes → uma fila" encaixa na
  estrutura atual sem nova estrutura de dados.
- **Serialização automática:** o broadcast usa `__dict__` (`question_new` = `q.__dict__`,
  `red_flag` = `rf.__dict__`) — adicionar `lens` ao dataclass já propaga para o WebSocket sem
  tocar no `ws_manager`.
- **Seam de seleção por `mode`** (`pipeline.py:598-612`) — o mesmo ponto que escolhe
  `DiscoveryPromptBuilder` vs `PromptBuilder` é onde o comportamento de dois agentes deve ser
  gated. Sales cai no caminho de um planner.
- **Anti-repeat compartilhável:** `recent` (`pipeline.py:294-302`) já é uma lista de texto sobre
  a fila inteira — na execução sequencial, o Dados a reconstrói **depois** do Produto inserir, então
  enxerga as perguntas frescas de graça.
- **Padrão golden/gate das Fases 1-2:** repetir para o SC de regressão sales (D-24).

### Established Patterns
- **Builders duck-typed irmãos** (não subclasse) — `DiscoveryPromptBuilder` e `PromptBuilder`
  compartilham o contrato informal de `build_all()`/`build_question_planner()` sem base comum
  (docstring `discovery_prompt_builder.py:5-10`). O split por lente deve seguir esse estilo (novo
  método/param no builder discovery), sem mexer no sales.
- **`block` é a única categorização hoje** — `lens` é ortogonal a `block`; não substitui.
- **Geração de perguntas é só por gatilho** (não tem timer, ao contrário de coverage 30s / red-flag
  15s). "Cadência do Dados" (D-13) é medida em **gatilhos**, não em segundos.
- **Dedup de red flags já existe por prefixo de 60 chars** (`pipeline.py:254,258`) — a lente não
  interfere nesse dedup; é campo adicional.

### Integration Points
- **`lens` flui:** planner (Produto/Dados) → `_run_question_planner` seta `lens` → dataclass
  `Question`/`RedFlag` → insert no Supabase + broadcast WS. Para áreas: registro
  (`AreaDefinition.lens`) → `coverage_to_dict` → `coverage_update`.
- **Contador do Dados:** vive em memória por sessão (não persistido); reinicia a cada sessão.
- **Migration aditiva** deve tocar 3 coisas juntas: `questions.lens`, `red_flags.lens`, enum
  `agent` de `session_prompts` (D-23) — nullable/aditivo, sales e linhas antigas intactas.

</code_context>

<specifics>
## Specific Ideas

- **Teste-semente de regressão sales (D-24):** sessão sales → 1 planner, `lens` NULL em
  questions/red_flags, sem contador Dados, coverage sales inalterada. Análogo ao golden test das
  Fases 1-2 — é o ≥1 teste real que a fase deixa.
- **Teste do SC#1:** sessão discovery, disparar geração; perguntas do Produto saem com
  `lens=produto` e do Dados com `lens=dados`, ambas na mesma fila.
- **Teste do SC#2:** todo `coverage_update` de discovery traz `lens` por área (produto/dados) e
  todo `red_flag` traz `lens`.
- **Teste do SC#3:** ao longo de N gatilhos, o Dados só dispara nos pares (2, 4, 6…) e o Produto
  em todos.
- **Teste do SC#5:** nenhuma dupla de perguntas na fila tem o mesmo texto normalizado, mesmo
  vindo de agentes diferentes (a trava de código pega o caso em que o LLM ignora a instrução).

</specifics>

<deferred>
## Deferred Ideas

- **Badges/agrupamento por lente na UI + render server-driven das áreas:** Fase 5 (UI-01/02/03).
  Esta fase só emite `lens`; validação por payload/banco.
- **Seção "Métricas para Precificação" + handoff import-from-diagnosis:** Fase 4 (REP-01/02).
- **Dedup semântico (embeddings/similaridade)** entre perguntas: só se a trava de texto (D-17)
  não bastar na prática; melhoria futura, não escopo desta fase.
- **Segundo pipeline de coverage/red-flags (2× por lente):** fora de escopo do milestone —
  coverage e red-flags ficam 1× (PROJECT.md).
- **Cotas rígidas por lente na fila / aumentar o teto no discovery:** descartado agora (D-14);
  revisitar só se o Dados ficar invisível na prática.

None — discussion stayed within phase scope (as ideias acima são fronteiras conhecidas de outras
fases, não scope creep levantado nesta discussão).

</deferred>

---

*Phase: 3-two-agent-questions-lens-tagging*
*Context gathered: 2026-09-21*
