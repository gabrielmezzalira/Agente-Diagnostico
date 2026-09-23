# Phase 5: Two-Lens Monitoring (Frontend) - Context

**Gathered:** 2026-09-23
**Status:** Ready for planning

<domain>
## Phase Boundary

A tela de monitoramento do **web app do Agente** passa a **separar visualmente as lentes
Produto e Dados** em sessões discovery, **mantém a lista plana** no modo sales (byte-behavior
preservado), e passa a **renderizar as áreas que o backend mandar** — sem lista de áreas
hardcoded no frontend. Além disso, a fase entrega a camada de frontend do **handoff de PRD**:
um botão **"Gerar PRD"** gated por readiness (com barrinha de %) na página do projeto, e a
**UI de status/aprovação** do relatório na sessão encerrada. Para isso, a fase adiciona uma
**rota REST mínima no backend** que expõe o readiness (hoje só existe como função pura, sem
exposição).

**In scope (esta fase):**
- **UI-01 — Agrupamento por lente:** a coluna de cobertura (esquerda, 220px) mostra duas seções
  empilhadas "Produto" e "Dados" no discovery; no sales continua uma lista plana única sem
  cabeçalho (D-43).
- **UI-02 — Badges de lente:** cada card de pergunta e cada linha de red flag exibe uma badge
  de lente (Produto/Dados) como tag principal, com o bloco temático como sub-label; sem badge
  no sales (D-44).
- **UI-03 — Áreas server-driven:** remover a lista de áreas e os labels hardcoded do frontend;
  consumir `name` e `lens` que o backend já manda no payload; os tipos do front ganham `lens`
  (D-45). Estado inicial da cobertura vem do `initial_state`, com placeholder "aguardando…"
  antes da 1ª mensagem (D-46).
- **Handoff de PRD (frontend, honra D-35):** botão "Gerar PRD" gated por readiness + barrinha de
  % + tooltip do que falta, na **página do projeto** (D-41/D-47); UI de status/aprovação
  (Rascunho / Em revisão / Aprovado para build) na **sessão encerrada**, onde "Aprovado" libera
  o import no Precificador (D-48, via `PATCH /sessions/{id}/report` já existente, D-38).
- **Backend aditivo mínimo:** nova rota `GET /sessions/{id}/readiness` (score + sinais baixos)
  para a página do projeto consumir (D-49). É a única mudança de backend da fase.

**Out of scope (esta fase):**
- **Remoção do modo sales** (arrancar CITI_PORTFOLIO / caminho sales) → decisão de milestone à
  parte, **pós-Fase 9** (discovery validado numa call real primeiro). Nesta fase o sales só
  mantém o fallback de lista plana, sem investimento novo. **DECISÃO DE MILESTONE — ver Deferred.**
- **Integração com o Taqciti** (streaming, session binding, aba AGP) → Fases 6–10, no repo do
  Taqciti. Confirmado o Modelo A/C do roadmap (o agente entra no Taqciti via aba AGP; o web app
  do Agente segue como superfície completa). Fase 5 = **só** o web app do Agente.
- **Geração automática do PRD completo** (personas, Gherkin, CSD, KPIs) → já fora de escopo desde
  a Fase 4; o relatório só preenche o que o pipeline captura.
- **Calibração fina dos pesos/limiar do readiness** → default calibrável, ajustar após sessões
  reais (herdado de D-34).

</domain>

<decisions>
## Implementation Decisions

> Numeração continua a partir da Fase 4 (última decisão foi D-40).

### Escopo da fase (Decisão "Honrar D-35")
- **D-41:** A Fase 5 entrega, **além** do monitoramento por lente (UI-01/02/03), a camada de
  frontend do handoff de PRD — botão "Gerar PRD" gated por readiness + UI de status/aprovação —
  honrando **D-35** (Fase 4 dividiu: backend na 4, frontend na 5). O backend correspondente já
  existe (readiness D-33/D-34, coluna `status` D-36, `PATCH` de status D-38, gate no import D-37),
  exceto a **exposição** do readiness (ver D-49). **Follow-up obrigatório:** o texto dos Success
  Criteria da Fase 5 no `.planning/ROADMAP.md` só menciona UI-01/02/03 — precisa ser ampliado
  para incluir o "Gerar PRD" + aprovação (mesmo precedente do D-30/D-12: ajustar texto de SC do
  roadmap). — **Reversibility:** reversible (fronteira de escopo + texto do roadmap).

### Detecção de modo (Decisão "Inferir do payload / project.mode por superfície")
- **D-42:** Na **tela de monitoramento** (`SessionActivePage` + `useSessionWS`), o modo é
  **inferido do payload do WebSocket**: se qualquer área da cobertura vier com `lens != null` →
  discovery (agrupa por lente); se tudo vier `null` → sales (lista plana). O `coverage_to_dict`
  do backend já emite `lens` por área (`session_state.py:193-202`). Zero fetch extra, funciona
  desde o `initial_state`, 100% server-driven (casa com UI-03). **Nuance por superfície:** na
  **página do projeto** (`ProjectDetailPage`), que **não** mantém WebSocket, a detecção usa
  `project.mode` (o tipo `Project` já expõe `mode: 'sales' | 'discovery'` e a página já carrega o
  projeto). — **Reversibility:** reversible.

### Layout do agrupamento (Decisão "Duas seções empilhadas")
- **D-43:** A coluna de cobertura (esquerda, 220px) no discovery ganha **duas seções empilhadas**
  com cabeçalho "Produto" e "Dados", cada uma listando suas áreas (agrupadas por `lens`). No sales
  (`lens` todo `null`) cai numa **lista plana única sem cabeçalho** — idêntica ao comportamento
  atual (D-03/D-24). Mantém a mesma largura de coluna; mudança estrutural mínima. — **Reversibility:**
  reversible.

### Badges de lente + labels (Decisão "Badge principal + bloco sub-label")
- **D-44:** Nos cards de pergunta e nas linhas de red flag, a **badge de lente** (Produto/Dados)
  é a **tag principal** (cumpre UI-02) e o **bloco temático** vira **sub-label** secundário. O
  mapa de blocos do frontend (`blockLabel` em `SessionActivePage.tsx:334-343`, hoje 8 blocos) é
  **estendido para os 12 blocos discovery** (D-32) — vocabulário pequeno e estável, **não** é o
  que o UI-03 quer eliminar (UI-03 é sobre *áreas de cobertura*, não sobre labels de bloco). Sem
  badge quando `lens` é `null` (sales). — **Reversibility:** reversible.

### Áreas server-driven (Decisão "Kill hardcoded, consumir name+lens")
- **D-45:** Remover a lista de áreas hardcoded (`COVERAGE_AREAS` em `useSessionWS.ts:54-57`) e o
  mapa de labels de área hardcoded (`AREA_LABELS` em `SessionActivePage.tsx:27-36`). O frontend
  passa a consumir `name` (label) e `lens` que o backend **já manda** por área no
  `coverage_update`/`initial_state`. Os tipos do front (`CoverageArea`, `RedFlag`, `WSQuestion`
  em `useSessionWS.ts`) ganham o campo `lens`. O estado inicial da cobertura deixa de ser montado
  a partir de lista fixa e passa a vir do `initial_state`. — **Reversibility:** reversible.
- **D-46:** **Empty state** da coluna de cobertura: enquanto o `initial_state` não chega, mostrar
  um **placeholder discreto** ("aguardando classificação…"), **nunca** áreas fixas inventadas
  pelo front. Consequência direta de remover o hardcoded (D-45). — **Reversibility:** reversible.

### Handoff de PRD — Gerar PRD + readiness (Decisão "Botão na página do projeto")
- **D-47:** O botão **"Gerar PRD"** e a **barrinha de readiness** vivem na **página do projeto**
  (`ProjectDetailPage`), associados à sessão de discovery, como o passo antes de ir para a
  precificação (a seção de precificações já vive nessa página). O botão fica **bloqueado** até o
  readiness passar o limiar; a **barrinha mostra a % do readiness**; o "o que falta" aparece via
  **tooltip no botão + um pequeno gráfico de % no próprio botão** (D-34 expõe score + sinais
  baixos). No discovery, esse é o ponto de geração do PRD (o relatório discovery = PRD). A página
  busca o readiness da sessão pela rota nova (D-49). — **Reversibility:** reversible.
- **D-48:** A **UI de status/aprovação** do relatório (Rascunho / Em revisão / Aprovado para
  build) vive na **tela de sessão encerrada** (`SessionActivePage`, ramo `!isActive`), junto do
  relatório gerado (onde já há "Ver Relatório"/"Regenerar"/"Importar PDF"). A revisão humana
  acontece **pós-call**. Marcar **"Aprovado para build"** é o que libera o import no Precificador
  (gate D-37); a chamada usa o `PATCH /sessions/{id}/report` já existente (D-38, `sessions.py:349`,
  Literal de 3 valores). — **Reversibility:** reversible (consome contrato já existente).

### Exposição do readiness (Decisão "Rota REST aditiva na Fase 5")
- **D-49:** O readiness **não é exposto** por nenhuma rota nem evento hoje — só existe como função
  pura `SessionState.readiness_score()` (`session_state.py:204+`). A Fase 5 adiciona uma **rota
  REST mínima** `GET /sessions/{id}/readiness` que retorna score + sinais baixos, consumida pela
  página do projeto (D-47). É a **única** mudança de backend da fase; aditiva, sem tocar contratos
  existentes. Precedente: D-38 (Fase 4 adicionou o `PATCH` que a UI ia consumir). Isso faz a Fase
  5 — nominalmente "frontend" — encostar no backend de forma controlada. — **Reversibility:**
  reversible (rota nova, aditiva).

### Claude's Discretion
- **Cores/estilo exatos das badges** de lente Produto/Dados (usar as CSS vars existentes do tema
  em `SessionActivePage`), texto exato dos cabeçalhos de seção ("Produto"/"Dados").
- **Forma do helper de inferência de modo** (D-42) — onde mora a função que decide discovery vs
  sales a partir do payload, desde que seja determinística.
- **Os 12 labels de bloco** estendidos (D-44) — texto legível de cada bloco discovery.
- **Forma exata do placeholder** de empty state (D-46) e do **mini-gráfico de % no botão**
  "Gerar PRD" (D-47), desde que mostre a % do readiness e o botão fique bloqueado abaixo do limiar.
- **Posição exata do botão "Gerar PRD"** dentro da `ProjectDetailPage` (por card de sessão vs área
  dedicada antes da seção de precificações), desde que fique associado à sessão de discovery e
  antes do handoff.
- **Shape exato da resposta** de `GET /sessions/{id}/readiness` (D-49), desde que carregue score
  e os sinais baixos que a UI mostra.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Definição da fase & requisitos
- `.planning/ROADMAP.md` §"Phase 5: Two-Lens Monitoring (Frontend)" — goal + 3 success criteria
  (**SC a ampliar — ver D-41:** hoje só cobrem UI-01/02/03; falta incluir Gerar PRD + aprovação).
- `.planning/REQUIREMENTS.md` → **UI-01, UI-02, UI-03**.

### Decisões & regras do projeto
- `.planning/PROJECT.md` §"Key Decisions" — pivot sales→discovery gated por `mode`; sales
  byte-idêntico; registro único de áreas; Taqciti (adotar capture + aba AGP, retirar extensão).
- `CLAUDE.md` §"Idioma das Respostas" (PT), §"Princípios de Arquitetura de Código" (SOLID: pages
  compõem, hooks encapsulam estado, components sem chamada direta a API), §"Regras de Planejamento
  de Tasks" (7 seções obrigatórias; nunca misturar correção com refator; decisões de time param e
  perguntam), §"Segredos — NUNCA ler .env".
- `.planning/phases/03-two-agent-questions-lens-tagging/03-CONTEXT.md` — modelo de `lens`
  (D-18 coluna persistida; D-19 `lens` em `AreaDefinition` e `coverage_update` emite lente por
  área; broadcast via `__dict__` propaga `lens` para questions/red_flags). **Contrato que esta
  fase consome no frontend.**
- `.planning/phases/04-discovery-report-pricing-handoff/04-CONTEXT.md` — D-33/D-34 (readiness puro,
  score + sinais baixos, "UI da Fase 5 consome ready/low_signals"); D-35 (split backend/frontend);
  D-36 (coluna `status`); D-37 (gate no import); D-38 (`PATCH` de status); D-39/D-40.

### Código que a fase toca (com âncoras do scout)
- `frontend/src/lib/useSessionWS.ts` — `COVERAGE_AREAS` hardcoded (54-57) e `INITIAL_COVERAGE`
  (59-61) → remover (D-45); interfaces `CoverageArea` (4-8), `RedFlag` (10-16), `WSQuestion`
  (18-26) → adicionar `lens` (D-45); `ws.onmessage` handlers de `initial_state`/`coverage_update`/
  `question_new`/`red_flag` (114-159) — já propagam o payload cru, só faltam os campos nos tipos.
- `frontend/src/pages/SessionActivePage.tsx` — `AREA_LABELS` hardcoded (27-36) → remover, usar
  `name` do payload (D-45); `CoveragePanel` (68-147) → agrupar por lente (D-43); `blockLabel`
  (334-343) → estender 8→12 + badge de lente no `QuestionCard` (323-384) (D-44); badge de lente
  nas linhas de red flag em `TranscriptPanel` (204-279) (D-44); ramo `!isActive` (747-885) →
  UI de status/aprovação (D-48); botão "Relatório" na topbar (941-949) — no discovery o caminho
  de geração migra para a página do projeto (D-47), avaliar o que fica na topbar.
- `frontend/src/pages/ProjectDetailPage.tsx` — carrega `project` (tem `mode`), lista `sessions`
  (250-...) e `pricings` (325-...); é onde entram o botão "Gerar PRD" + barrinha de readiness
  (D-47), buscando o readiness da sessão de discovery.
- `frontend/src/lib/api.ts` — tipos `Project` (tem `mode: 'sales' | 'discovery'`), `Session`
  (hoje **sem** `mode`), `Report`; client `api.sessions.*` / `api.pricings.*` → adicionar o
  método que chama `GET /sessions/{id}/readiness` (D-49) e o `PATCH` de status (D-48).
- `backend/app/services/session_state.py` — `coverage_to_dict` (185-202) já emite `name`+`lens`
  por área (base do server-driven, D-45); `readiness_score()` (204+) é a função pura a expor (D-49).
- `backend/app/routers/sessions.py` — rotas existentes (`GET`/`POST`/`PATCH /{id}/report` em
  310-380); ponto de inserção da nova `GET /{id}/readiness` (D-49).
- `backend/app/services/coverage_areas.py` — `DISCOVERY_AREA_SET` (18 áreas com `lens` produto
  0-7 / dados 8-17) e `SALES_AREA_SET` (`lens=None`); fonte de verdade dos labels/lentes que o
  backend serializa.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Backend já é server-driven de graça:** `coverage_to_dict` emite `status/score/notes/name/lens`
  por área (`session_state.py:193-202`); `question_new`/`red_flag` já carregam `lens` via `__dict__`
  (Fase 3). O frontend só **ignora** esses campos hoje — UI-02 e UI-03 não exigem mudança de
  backend, apenas parar de hardcodar e passar a consumir o payload.
- **Contrato de status pronto:** `PATCH /sessions/{id}/report` (`sessions.py:349`) com Literal de
  3 valores + gate de "Aprovado para build" no import (`llm_pricing_service.py:105-122`) + default
  "Rascunho" no discovery (`pipeline.py:475`, `sessions.py:528`). A UI de aprovação (D-48) só
  consome isso.
- **`project.mode` já disponível na página do projeto** — detecção discovery/sales ali é direta,
  sem WebSocket (D-42, nuance de superfície).
- **Componentes de painel já isolados** em `SessionActivePage` (`CoveragePanel`, `QuestionCard`,
  `TranscriptPanel`, `QuestionsPanel`) — bons pontos de extensão sem reescrever a página.

### Established Patterns
- **Sales byte-idêntico** (D-03/D-24): todo comportamento discovery é gated; o caminho sales
  (lens `null` → lista plana, sem badge) deve permanecer indistinguível do atual. Deixar ao menos
  **1 teste real** provando a regressão sales (análogo aos golden das Fases 1-4).
- **Tooltip via `title`** já é o padrão da topbar (botão de budget em `SessionActivePage:944`) —
  reusar para o "o que falta" do readiness (D-47).
- **SOLID/organização (CLAUDE.md):** lógica stateful em hooks (`useSessionWS`), pages só compõem,
  components sem chamada direta a API. A inferência de modo (D-42) e o fetch de readiness (D-49)
  seguem esse corte.

### Integration Points
- **Server-driven:** `coverage_update`/`initial_state` (payload com `name`+`lens`) → `useSessionWS`
  (tipos ganham `lens`, sem `COVERAGE_AREAS`) → `CoveragePanel` agrupa por `lens` (D-43/D-45).
- **Badges:** `question_new`/`red_flag` (payload com `lens`) → `QuestionCard`/`TranscriptPanel`
  renderizam badge (D-44).
- **Gerar PRD:** `ProjectDetailPage` → `GET /sessions/{id}/readiness` (nova, D-49) → botão gated +
  barrinha (D-47) → `POST /sessions/{id}/report` gera o rascunho.
- **Aprovação:** sessão encerrada → seletor de status → `PATCH /sessions/{id}/report` (D-48) →
  "Aprovado para build" destrava `import-from-diagnosis` no Precificador (D-37).

</code_context>

<specifics>
## Specific Ideas

- **Barrinha de readiness "à la budget bar":** o usuário imagina o botão "Gerar PRD" bloqueado com
  uma barrinha de % subindo conforme os insumos, e um mini-gráfico de % no próprio botão + tooltip
  do que falta. Referência visual próxima da `BudgetBar` já existente (`SessionActivePage:153-198`).
- **Verificação UI-01 (semente):** abrir o monitoramento de uma sessão discovery mostra cobertura
  em duas seções (Produto/Dados); abrir de uma sessão sales mostra a mesma lista plana de hoje.
- **Verificação UI-02:** todo card de pergunta e toda linha de red flag em discovery exibem a
  badge de lente; em sales, nenhuma badge.
- **Verificação UI-03:** `useSessionWS`/`SessionActivePage` renderizam o conjunto de áreas que o
  backend mandar, sem nenhuma lista de áreas hardcoded no front.
- **Verificação handoff:** com readiness abaixo do limiar, "Gerar PRD" fica bloqueado e mostra o
  que falta; ao passar do limiar, gera; na sessão encerrada, marcar "Aprovado para build" libera o
  import no Precificador.

</specifics>

<deferred>
## Deferred Ideas

- **Remoção do modo sales (aposentar CITI_PORTFOLIO / caminho sales):** **DECISÃO DE MILESTONE.**
  O usuário quer o produto 100% discovery enterprise, mantendo só recursos úteis já discutidos. Mas
  remover o sales é irreversível e a arquitetura toda foi construída sobre "sales byte-idêntico até
  o discovery ser validado" — o roadmap só valida discovery ponta-a-ponta na **Fase 9** (call real).
  Decisão: **não arrancar agora**; revisitar como iniciativa própria (decisão de time + possível
  fase de remoção) **depois da Fase 9**. Na Fase 5, sales só mantém o fallback de lista plana.
- **Integração Taqciti (streaming / session binding / aba AGP):** Fases 6–10, repo do Taqciti.
  Confirmado o **Modelo A/C** do roadmap (agente entra no Taqciti via aba AGP; Taqciti alimenta o
  backend; web app do Agente coexiste como superfície completa). Fase 5 = só o web app do Agente.
- **Editar o texto dos Success Criteria da Fase 5 no `.planning/ROADMAP.md`** para incluir o
  "Gerar PRD" + aprovação (D-41) → follow-up de planning/roadmap; decisão já tomada, falta a edição
  (precedente D-30/D-12).
- **Calibração fina dos pesos/limiar de readiness** → após sessões reais (herdado de D-34).
- **Label de bloco server-driven** (backend mandar o texto do bloco no payload) → descartado agora
  (D-44 estende o mapa no front); revisitar só se o vocabulário de blocos ficar volátil.

None — a discussão trouxe dois temas de milestone (sales, Taqciti) que foram **resolvidos como
decisões de time acima** e redirecionados para fora da Fase 5; o restante ficou dentro do escopo.

</deferred>

---

*Phase: 5-two-lens-monitoring-frontend*
*Context gathered: 2026-09-23*
</content>
</invoke>
