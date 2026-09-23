# Phase 4: Discovery Report + Pricing Handoff - Context

**Gathered:** 2026-09-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Uma sessão **discovery** gera **um único relatório** (Markdown) que segue o **esqueleto do
PRD padrão da CITi** (o entregável pós-Discovery Enterprise — ver `PRD_modelo_em_branco_CITi.pdf`),
preenchendo **apenas** o que o pipeline realmente capturou (cobertura por área com lens, red
flags com lens, perguntas com lens, transcrição). As lentes **Produto** e **Dados** mapeiam em
seções do PRD, e os **sinais de precificação** (backlog+estimativas, faseamento, volumetria)
ficam **nativos** nas seções do PRD. Esse relatório alimenta o **Precificador** pelo fluxo
existente `import-from-diagnosis`, com **trava de aprovação humana**. O relatório **sales**
continua **byte-a-byte idêntico** (REP-03).

**In scope (esta fase — backend):**
- **Relatório discovery = esqueleto do PRD (16 seções, 0-15)**, gerado por um prompt/estrutura
  **separado (irmão)** do relatório sales, escolhido por `mode`. Só preenche seções com insumo;
  seções sem dado ficam marcadas `[a preencher no PRD]`.
- **Conteúdo Produto/Dados híbrido:** o código pré-monta deterministicamente os itens taggeados
  por `lens` (áreas/red-flags/perguntas) e o LLM escreve a análise em cima + transcrição.
- **Duas tabelas de cobertura** (Produto / Dados) com labels do `DISCOVERY_AREA_SET`.
- **Blocos temáticos ampliados** (7 atuais + 5 novos) usados de forma consistente na seção de
  métricas do relatório e nos prompts do Precificador (`import_from_diagnosis` + `suggest_features`).
- **Readiness da geração do PRD:** cálculo (backend) de "insumos suficientes" por **score
  ponderado + limiar** sobre 4 sinais.
- **Status do relatório** (Rascunho / Em revisão / Aprovado para build) + **coluna `status` em
  `reports`** (migration aditiva), só para discovery.
- **Gate no handoff:** `import-from-diagnosis` passa a exigir status `Aprovado` para relatórios
  discovery (lógica de extração inalterada; sales importa como hoje).

**Out of scope (esta fase):**
- **Botão "Gerar PRD" (habilitar/desabilitar) e UI de revisão humana** → **Fase 5** (frontend).
  Esta fase entrega o **cálculo de readiness e o campo de status** (backend); a renderização do
  botão e da tela de aprovação é da Fase 5.
- **PRD completo auto-gerado** (personas, user stories em Gherkin, matriz CSD, catálogo de regras
  de negócio, KPIs com baseline) → descartado nesta fase (risco de alucinação + escopo/tokens).
  Só preenchemos o que o pipeline captura.
- **Adaptar a lógica de extração** do import para focar na seção de métricas → não faremos;
  reusamos o extrator, verificamos com import real, ajustamos só se necessário.
- **Calibração fina** dos pesos/limiar de readiness → default agora, ajustar após sessões reais.

</domain>

<decisions>
## Implementation Decisions

> Numeração continua a partir da Fase 3 (última decisão foi D-24).

### Geração do relatório discovery (Decisão "Relatório irmão")
- **D-25:** **Prompt/estrutura de relatório discovery separado (irmão)**, escolhido por `mode`
  (mesmo padrão do `DiscoveryPromptBuilder` da Fase 2, D-09). `generate_report` (`llm.py:102-195`)
  ramifica por `mode`; o sales cai no caminho atual e permanece byte-idêntico (D-03/D-24, REP-03).
  — **Reversibility:** reversible (novo builder/branch; sales intacto).
- **D-26:** **O relatório segue o esqueleto do PRD da CITi** (16 seções, 0-15, do
  `PRD_modelo_em_branco_CITi.pdf`), preenchendo **apenas** o que o pipeline capturou; seções sem
  insumo ficam marcadas `[a preencher no PRD]`. Não auto-gera todo o PRD. — **Reversibility:**
  reversible (estrutura de prompt/template).

### Conteúdo das seções por lente (Decisão "Híbrido")
- **D-27:** **Híbrido código+LLM.** O código agrupa deterministicamente áreas/red-flags/perguntas
  por `lens` (produto/dados) em tabelas/listas; o LLM escreve a análise em cima disso + transcrição.
  Garante que todo item taggeado aparece na seção certa (SC#1) e reduz alucinação. Mapeamento de
  lentes no PRD: **Produto → seções 1-6, 10, 11**; **Dados → seção 7 + partes de 8 (LGPD/observabilidade)
  e 9 (arquitetura/integrações)**. — **Reversibility:** reversible.
- **D-28:** **Duas tabelas de cobertura** (uma na área Produto, outra na Dados), labels vindos do
  `DISCOVERY_AREA_SET` (registro), **não** do `SALES_AREA_SET` (o `generate_report` de hoje usa
  `SALES_AREA_SET.labels()` fixo — precisa passar a usar o set discovery no ramo discovery). —
  **Reversibility:** reversible.

### Métricas para Precificação (Decisão "Métricas nativas")
- **D-29:** **Métricas de precificação nativas no PRD** — ficam nas seções nativas (6.3 backlog +
  estimativas, 11 faseamento, 7.3 volumetria), **sem** criar uma seção nomeada "Métricas para
  Precificação". Prioriza fidelidade ao PRD. — **Reversibility:** reversible.
- **D-30:** **Reformular o SC#1 da Fase 4 no ROADMAP.** Como D-29 não cria a seção nomeada que o
  SC#1 exige textualmente, o texto do SC#1 deve mudar de "plus a 'Métricas para Precificação'
  section" para algo como "as métricas de precificação (backlog+estimativas, faseamento,
  volumetria) estão presentes no PRD e são extraíveis pelo import (REP-02)". Precedente: D-12 da
  Fase 2 (ajuste de texto de SC "11"→"18"). **DECISÃO DO TIME já tomada pelo usuário (autoridade
  de domínio); falta aplicar a edição no `.planning/ROADMAP.md`.** — **Reversibility:** reversible
  (texto do roadmap).

### Handoff / extração no import (Decisão "Reusar extrator")
- **D-31:** **Reusar o extrator do `import-from-diagnosis` como está** — a lógica de extração LLM
  (`llm_pricing_service.py:71-179`, lê o markdown inteiro via `with_structured_output`) **não muda**.
  Verificar com import real (REP-02) e só ajustar se a extração vier ruim. Não toca a estrutura do
  Precificador (LangChain). — **Reversibility:** reversible.
- **D-32:** **Ampliar o vocabulário de blocos temáticos** de 7 para 12, aditivo. Novos: **GenAI/IA
  (LLM, RAG, agentes)**, **Machine Learning**, **Governança & LGPD/Segurança**, **Infra/MLOps/
  Observabilidade**, **Descoberta/Consultoria**. O mesmo acréscimo entra na seção de métricas do
  relatório e nos **dois** prompts do Precificador (`import_from_diagnosis` `:145` e
  `suggest_features` `:259`) para manter consistência. `bloco` é **texto livre** no banco (não é
  enum), então isso é só orientação de prompt. Incluir uma linha curta de desambiguação
  (ML = modelos preditivos clássicos; GenAI = LLM/RAG/agentes; Ciência de Dados = análise/estatística
  exploratória). — **Reversibility:** reversible (texto de prompt; nada no schema).

### Readiness da geração do PRD (Decisão "Readiness por score")
- **D-33:** **Readiness composta pelos 4 sinais:** (1) cobertura mínima por lente, (2) % global de
  cobertura das 18 áreas, (3) perguntas respondidas / transcrição mínima, (4) seções-chave do PRD
  com dado mapeável. — **Reversibility:** reversible.
- **D-34:** **Combinação por score ponderado + limiar.** Cada sinal vira score parcial; a soma
  ponderada precisa passar de um limiar para liberar a geração. O estado de readiness (backend)
  expõe o score e **quais sinais estão baixos** (para a UI da Fase 5 mostrar o que falta).
  **Pesos e limiar exatos = default calibrável** — a definir no planning e ajustar após sessões
  reais (análogo ao TTL=30s). — **Reversibility:** reversible.

### Revisão humana + trava de preço (Decisão "Status + gate")
- **D-35:** **Split de fase.** Backend (cálculo de readiness, geração do relatório, campo `status`,
  gate no import) = **Fase 4**. Frontend (botão "Gerar PRD" habilita/desabilita conforme readiness,
  UI de revisão/aprovação humana) = **Fase 5**. — **Reversibility:** n/a (fronteira de escopo).
- **D-36:** **Campo `status` no relatório** (Rascunho / Em revisão / Aprovado para build — igual ao
  campo Status do próprio PRD). Nova **coluna `status` em `reports`** via migration **aditiva**;
  só discovery usa; sales e linhas antigas ficam intactas (REP-03). — **Reversibility:** one-way —
  coluna nova em tabela do Supabase; reverter exige migration de remoção. Aditiva/nullable protege
  sales e histórico.
- **D-37:** **Gate de aprovação no handoff.** `import-from-diagnosis` ganha a **pré-condição**
  `status == 'Aprovado'` para relatórios discovery, antes de extrair; a **lógica de extração
  continua a mesma** (D-31). Sales importa como hoje (sem gate). — **Reversibility:** costly —
  muda o contrato de comportamento do handoff (REP-02); precisa gatear por `mode`/tipo de relatório
  para não regredir o sales, e o parser/rota do Precificador precisa acompanhar a pré-condição.

### Decisões da pesquisa (D-38 a D-40 — lacunas achadas no RESEARCH.md, resolvidas com o usuário 2026-09-22)
- **D-38:** **Endpoint de transição de `status` entra na Fase 4 (backend).** A pesquisa achou que
  não existe rota para mudar `reports.status` (Rascunho→Aprovado); sem ela, o SC#2/REP-02 ("marcar
  Aprovado, rodar import") só rodaria via UPDATE manual no banco. Incluir um endpoint mínimo (ex.:
  `PATCH /sessions/{session_id}/report` com body `{status}`), validado contra o `Literal` de 3
  valores (Rascunho / Em revisão / Aprovado para build). A UI que chama esse endpoint continua na
  Fase 5 (D-35); esta fase só entrega a rota. — **Reversibility:** reversible (nova rota; sem tocar
  sales). **Decisão do usuário (2026-09-22).**
- **D-39:** **Corrigir `upload_pdf_transcript` para propagar `mode` na Fase 4.** O endpoint
  `POST /{session_id}/transcript/upload` chama `generate_report` sem `mode=` (default `"sales"`),
  então uma sessão discovery importada via PDF geraria relatório sales silenciosamente. Propagar
  `mode=project.mode` (ou equivalente). **Commit separado da feature** (correção ≠ refator/feature,
  regra do CLAUDE.md). — **Reversibility:** reversible (poucas linhas). **Decisão do usuário
  (2026-09-22).**
- **D-40:** **Perguntas particionadas por `lens` na seção 12.4 do PRD ("Dúvidas em aberto").**
  Mudar `questions_used` em `generate_report` de `list[str]` para `list[dict]` com `{text, lens}`
  (mesmo padrão já usado para `red_flags_raw`), para manter a coerência do D-27 (todo item
  taggeado aparece na seção da sua lente) e evitar o LLM alucinar a divisão. Sales continua
  recebendo apenas texto (byte-identidade da saída sales preservada, REP-03). — **Reversibility:**
  reversible (assinatura interna). **Decisão do usuário (2026-09-22).**

### Claude's Discretion
- **Formato exato do esqueleto do PRD em Markdown** (derivar do PDF `PRD_modelo_em_branco_CITi.pdf`
  para uma forma machine-usável que o prompt/código consuma), nomes/marcadores das seções vazias
  (`[a preencher no PRD]`), desde que preserve as 16 seções e o mapeamento de lentes (D-26/D-27).
- **Pesos e limiar do score de readiness** (D-34) — default, calibrável.
- **Formato de pré-montagem determinística** das tabelas/listas por lens (D-27), desde que todo
  item taggeado apareça na seção da sua lente.
- **Detalhe da migration do `status`** (nome/arquivo, `text` nullable vs enum, default), desde que
  aditiva e compatível com o cliente Supabase, e que não altere o comportamento sales.
- **Texto exato de desambiguação** dos blocos ML / GenAI / Ciência de Dados (D-32).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Definição da fase & requisitos
- `.planning/ROADMAP.md` §"Phase 4: Discovery Report + Pricing Handoff" — goal + 3 success criteria
  (**SC#1 a reformular — ver D-30**).
- `.planning/REQUIREMENTS.md` → **REP-01, REP-02, REP-03**.

### Template obrigatório do entregável
- `PRD_modelo_em_branco_CITi.pdf` (raiz do projeto) — **estrutura de referência obrigatória** do
  relatório discovery: PRD padrão da subárea de Produto (16 seções, 0-15; negócio 1-5, técnico 6-13,
  apoio 0/14/15; campo Status = Rascunho/Em revisão/Aprovado para build). O relatório segue este
  esqueleto (D-26).

### Decisões & regras do projeto
- `.planning/PROJECT.md` §"Key Decisions" — pivot sales→discovery gated por `mode`; "Two agents only
  at question stage (coverage + red-flags 1×)"; registro único de áreas.
- `CLAUDE.md` §"Idioma das Respostas" (PT), §"Princípios de Arquitetura de Código" (SOLID /
  Open-Closed — base do relatório irmão e do gate por mode), §"Regras de Planejamento de Tasks"
  (7 seções obrigatórias; nunca misturar correção com refator; decisões de time param e perguntam),
  §"Segredos — NUNCA ler .env".
- `.planning/phases/03-two-agent-questions-lens-tagging/03-CONTEXT.md` — modelo de `lens`
  (D-18 coluna persistida em questions/red_flags; D-19 `lens` em `AreaDefinition`; D-21 lente
  autoritária do agente).
- `.planning/phases/02-discovery-mode-discoverypromptbuilder/02-CONTEXT.md` — `DiscoveryPromptBuilder`
  irmão (D-09), coluna `mode` (D-07), 18 áreas ordem 0-7 produto / 8-17 dados (D-06).

### Código que a fase toca (com âncoras do scout)
- `backend/app/services/llm.py` — `generate_report` (102-195): recebe `mode`, gate do bloco CITi
  por mode (179-183), usa `SALES_AREA_SET.labels()` fixo (121) → precisa do set discovery no ramo
  discovery; system prompt sales-shaped (146-169) → prompt irmão discovery.
- `backend/app/services/llm_pricing_service.py` — `import_from_diagnosis` (71-179): já aceita
  `session_id`, usa `get_session_report`, grava `pricings.session_id` (98-119); prompt de blocos
  (145); `suggest_features` prompt de blocos (259). **Extração inalterada (D-31); só amplia blocos
  (D-32) e ganha pré-condição de status (D-37).**
- `backend/app/repositories/pricing_repository.py` — `get_session_report`, `get_project_reports`
  (149-186), leitura da tabela `reports` (170-186).
- `backend/app/routers/sessions.py` — endpoints de report (310-345): `GET /{id}/report`,
  `POST /{id}/report` → `pipeline.trigger_report`; ponto onde o `status` inicial e o readiness são
  expostos.
- `backend/app/routers/pricings.py` — `import_from_diagnosis` (207-217): ponto do gate de status.
- `backend/app/services/coverage_areas.py` — `DISCOVERY_AREA_SET` (18 áreas, `lens`), `labels()`.
- `backend/app/services/session_state.py` — coverage/red_flags/questions com `lens`; base do cálculo
  de readiness (sinais 1-3).
- `supabase/migrations/` — nova migration **aditiva**: coluna `status` em `reports` (D-36).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`import-from-diagnosis` já pronto para sessão única:** aceita `session_id`, usa só o relatório
  daquela sessão e grava `pricings.session_id` (`llm_pricing_service.py:98-119`) — boa parte do
  REP-02 já existe; falta o relatório discovery alimentá-lo + o gate de status.
- **`generate_report` já recebe `mode`** (`llm.py:113`) e já gateia o bloco CITi por mode
  (179-183) — o seam de ramificação sales/discovery já existe.
- **`bloco` é texto livre** (não enum) em `pricing_features` — ampliar blocos é só orientação de
  prompt, sem migration.
- **Registro de áreas com `lens`** (`coverage_areas.py`) — dá o agrupamento determinístico das
  tabelas Produto/Dados de graça (D-27/D-28).

### Established Patterns
- **Builders/estruturas irmãs duck-typed** (Fase 2, D-09) — o relatório discovery segue esse estilo
  (prompt/estrutura irmã), sem mexer no sales.
- **Gate por `mode`** (seam em `pipeline.py:598-612` para builder; `generate_report` mode branch) —
  todo comportamento discovery é gated; sales byte-idêntico (D-03/D-24).
- **Migration aditiva/nullable** (Fases 2-3) — o `status` em `reports` segue o mesmo padrão para não
  regredir sales/histórico.

### Integration Points
- **Relatório:** `pipeline.trigger_report` → `generate_report(mode=...)` → prompt irmão + tabelas por
  lens + esqueleto do PRD → grava em `reports` (+`status` inicial).
- **Readiness:** cobertura/red-flags/perguntas/transcrição em `session_state` → score ponderado
  (backend) → exposto no report endpoint (consumido pela UI da Fase 5).
- **Handoff:** `POST /pricings/{id}/import-from-diagnosis` → checa `status=='Aprovado'` (discovery) →
  extrator atual → features + `pricings.session_id`.

</code_context>

<specifics>
## Specific Ideas

- **Template real do entregável:** `PRD_modelo_em_branco_CITi.pdf` (colocado na raiz pelo usuário) —
  o relatório discovery deve espelhar suas 16 seções. Mapa de origem do próprio PDF (pág. 2) ajuda a
  ligar artefatos de discovery → seções do PRD.
- **Verificação REP-02 (semente):** gerar um relatório discovery de uma sessão, marcá-lo `Aprovado`,
  rodar `import-from-diagnosis` com `session_id` e provar: ≥1 feature extraída + `pricings.session_id`
  vinculado. É o teste real que a fase deixa.
- **Verificação REP-03 (regressão sales):** sessão sales gera o relatório atual byte-idêntico, sem
  `status`-gate no import. Análogo ao golden test das Fases 1-3.
- **Readiness bloqueado:** com insumos abaixo do limiar, o backend reporta readiness incompleto e
  quais sinais faltam (a UI da Fase 5 desabilita o botão e mostra o motivo).

</specifics>

<deferred>
## Deferred Ideas

- **Botão "Gerar PRD" (habilitar/desabilitar) + UI de revisão/aprovação humana** → **Fase 5**
  (frontend). Fase 4 entrega readiness + `status` no backend.
- **PRD completo auto-gerado** (personas, user stories Gherkin, CSD, catálogo de regras, KPIs) →
  fora desta fase; só preenchemos o que o pipeline captura. Revisitar se o time quiser um gerador de
  PRD completo depois.
- **Adaptar o extrator para focar na seção de métricas / gatear por tipo de relatório** → só se a
  verificação REP-02 mostrar extração ruim (D-31).
- **Calibração fina dos pesos/limiar de readiness** → após sessões reais (D-34).
- **Aplicar a reformulação do SC#1 no `.planning/ROADMAP.md`** (D-30) → editar o texto do SC no
  roadmap (via planning ou `/gsd-phase`); decisão já tomada, falta a edição.

None — discussion stayed within phase scope (os itens acima são fronteiras conhecidas de outras
fases/itens de follow-up, não scope creep levantado nesta discussão).

</deferred>

---

*Phase: 4-discovery-report-pricing-handoff*
*Context gathered: 2026-09-22*
