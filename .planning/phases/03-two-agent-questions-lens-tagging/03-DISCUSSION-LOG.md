# Phase 3: Two-Agent Questions + Lens Tagging - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-21
**Phase:** 3-two-agent-questions-lens-tagging
**Areas discussed:** Cadência do Dados, Lente nos red flags, Orquestração + dedup, Modelo de dados da lente

---

## Cadência do Dados

| Option | Description | Selected |
|--------|-------------|----------|
| Contador (a cada Nº gatilho) | Todo gatilho roda Produto; Dados a cada N gatilhos. Determinístico, trivial no SC#3 | ✓ |
| Throttle por tempo | Dados só se passaram ≥X s desde o último. Depende de relógio, menos previsível | |
| Sob demanda | Dados só quando o usuário pede. Máximo controle, mas manual | |

| Option (teto) | Description | Selected |
|--------|-------------|----------|
| Teto 5 compartilhado, Produto prioridade | Teto 5 total; Dados ocupa o restante | ✓ |
| Cotas por lente | Reserva explícita por lente | |
| Aumentar teto p/ discovery | Sobe teto só no discovery | |

| Option (N) | Description | Selected |
|--------|-------------|----------|
| A cada 3º | Produto ~3x mais frequente | |
| A cada 2º | Dados mais presente, ainda mais lento que Produto | ✓ |
| A cada 4º | Dados bem esporádico | |

| Option (1º gatilho) | Description | Selected |
|--------|-------------|----------|
| Só no Nº | Dados só quando o contador fecha | ✓ |
| Também no 1º | Dados roda já no 1º gatilho | |

**User's choice:** Contador; teto 5 compartilhado com prioridade Produto; N=2; Dados só quando o contador fecha (nunca no 1º).
**Notes:** Cadência medida em gatilhos (geração de perguntas não tem timer). → D-13, D-14.

---

## Lente nos red flags

| Option | Description | Selected |
|--------|-------------|----------|
| LLM classifica por alerta | `lens` no contrato JSON + instrução no prompt do detector único | ✓ |
| Derivar no código | Heurística de texto casando alerta com área | |
| Tudo produto por ora | Nasce tudo produto (viola SC#2 de fato) | |

| Option (fallback) | Description | Selected |
|--------|-------------|----------|
| Default produto | Lente ausente/inválida → produto | ✓ |
| Derivar da evidência | Match leve da evidência contra áreas Dados | |

**User's choice:** LLM classifica a lente por alerta; fallback produto se vier vazio/inválido.
**Notes:** Detector permanece 1× (travado no PROJECT.md). → D-15, D-22.

---

## Orquestração + dedup

| Option | Description | Selected |
|--------|-------------|----------|
| Em sequência (Produto → Dados) | Dados vê perguntas frescas do Produto; zero duplicata na origem | ✓ |
| Em paralelo + pós-filtro | asyncio.gather + filtro de texto depois | |

| Option (dedup) | Description | Selected |
|--------|-------------|----------|
| Trava de texto normalizado | Instrução no prompt + guard de texto normalizado no código | ✓ |
| Só a instrução no prompt | Depende 100% do LLM honrar | |

**User's choice:** Sequencial Produto → Dados + trava de texto normalizado no código.
**Notes:** Anti-repeat compartilhado entre lentes (SC#4/#5). → D-16, D-17.

---

## Modelo de dados da lente

| Option | Description | Selected |
|--------|-------------|----------|
| Coluna `lens` persistida | Coluna nullable em questions/red_flags (migration aditiva) | ✓ |
| Derivar na leitura | Calcula na serialização, sem persistir | |

| Option (área) | Description | Selected |
|--------|-------------|----------|
| Campo `lens` no AreaDefinition | Campo explícito no dataclass; sales = None | ✓ |
| Derivar da ordem (0-7/8-17) | Infere pela posição, sem campo | |

**User's choice:** Coluna `lens` persistida em questions/red_flags + campo `lens` explícito no AreaDefinition.
**Notes:** NULL no sales; migration aditiva (blocker do STATE). → D-18, D-19.

---

## Pontos em aberto detalhados (segunda rodada, decididos pelo usuário)

Após o gate final, o usuário pediu o detalhamento dos itens em aberto e decidiu:

| Item | Opções | Escolha |
|------|--------|---------|
| 1. Autoria da lente na pergunta | (A) lente = agente que gerou / (B) derivar do block / (C) rejeitar conflito | **A** → D-21 |
| 2. Qtd de perguntas por agente | (A) 2-3 cada, teto resolve / (B) reserva pro Dados / (C) Produto até 3, Dados até 2 | **C** → D-20 |
| 3. Persistência dos prompts (`session_prompts`) | (A) gravar os dois com enum novo / (B) um só / (C) não persistir | **A** → D-23 |
| 4. Badges frontend | (fronteira, sem decisão — fica na Fase 5) | — |
| 5. Regressão sales | (A) gate por mode + teste-semente / (B) revisão manual | **A** → D-24 |

## Claude's Discretion

- Split do `build_question_planner` do discovery em dois prompts escopados por lente.
- Texto exato do enquadramento de cada agente (Produto vs Dados).
- Localização/forma do contador do Dados (estado em memória por sessão).
- Formato da normalização do texto na trava de dedup.
- Detalhe da migration (arquivo/tipo/ordem), desde que aditiva e ampliando o enum de `session_prompts`.

## Deferred Ideas

- Badges/agrupamento por lente na UI + render server-driven → Fase 5.
- Seção "Métricas para Precificação" + handoff → Fase 4.
- Dedup semântico (embeddings) → futuro, só se a trava de texto não bastar.
- Segundo pipeline de coverage/red-flags (2×) → fora do milestone.
- Cotas rígidas por lente / aumentar teto no discovery → descartado (D-14), revisitar se necessário.
