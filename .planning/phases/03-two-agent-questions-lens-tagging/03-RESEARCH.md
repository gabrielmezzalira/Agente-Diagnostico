# Phase 3: Two-Agent Questions + Lens Tagging - Research

**Researched:** 2026-09-21
**Domain:** Orquestração de dois agentes LLM (google.genai direto) sobre uma fila compartilhada + migration aditiva Supabase + tag de lente propagada por 3 superfícies (questions, red_flags, coverage areas)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-13:** Contador determinístico para o agente Dados. Em toda sessão discovery, o Produto roda em
  todo gatilho de geração de perguntas; o Dados roda a cada 2º gatilho e só quando o contador fecha o
  ciclo — nunca no 1º gatilho da sessão (ex.: Dados roda nos gatilhos 2, 4, 6…). O contador é estado
  em memória da sessão. Reversibility: reversible.
- **D-14:** Teto da fila continua 5, compartilhado, com o Produto tendo prioridade. Sem cotas rígidas
  por lente e sem aumentar o teto no discovery. Reversibility: reversible.
- **D-20:** Quantidade por agente por run: Produto pede até 3, Dados pede até 2 (soma = 5). Reversibility:
  reversible.
- **D-21:** A lente é autoritária do agente que gerou, não derivada do `block`. O orquestrador
  (`_run_question_planner`) seta `lens="produto"` no laço do planner Produto e `lens="dados"` no do
  Dados — independente de qual `block` o LLM devolveu. `block` continua sendo a área temática
  (informativa); em caso de conflito, a lente vence. Sem código de reconciliação. Reversibility: reversible.
- **D-15:** O detector de red flags continua único (1×), mas passa a classificar a lente por alerta:
  adiciona-se `lens` ao contrato JSON de `detect_red_flags` (`llm.py:82-99`) e a instrução no prompt do
  `build_red_flag_detector` (produto = gargalo/processo/viabilidade; dados = fontes/qualidade/LGPD/métricas).
  Reversibility: costly — muda o contrato JSON que o parser espera.
- **D-22:** Fallback `produto` — se o LLM devolver a lente vazia/ausente/inválida num alerta, o código
  assume `produto`. Reversibility: reversible.
- **D-16:** Execução sequencial Produto → Dados dentro do gatilho. O Produto gera primeiro; o Dados
  recebe as perguntas recém-geradas do Produto no seu contexto de anti-repetição (`recent`, montado em
  `pipeline.py:294-302`). Duas chamadas LLM em série, aceitável porque a geração é por gatilho.
  Reversibility: reversible.
- **D-17:** Dedup em duas camadas: mantém a lista compartilhada "Perguntas recentes (não repetir)" no
  prompt (compartilhada entre as duas lentes) e adiciona no código uma trava de texto normalizado
  (minúsculas/trim): descarta pergunta cujo texto normalizado já exista na fila. Reversibility: reversible.
- **D-18:** Coluna `lens` persistida (nullable) em `questions` e `red_flags`, via migration aditiva;
  `NULL` no sales, `produto`/`dados` no discovery. O campo entra nos dataclasses `Question`/`RedFlag`
  (`session_state.py:53-71`) e, como o broadcast serializa via `__dict__`, propaga automaticamente para
  o WebSocket. Reversibility: one-way (nullable/aditivo protege sales e linhas antigas).
- **D-19:** Campo `lens` explícito em `AreaDefinition` (`coverage_areas.py`). As 18 áreas do
  `DISCOVERY_AREA_SET` ganham `produto` (order 0-7) / `dados` (order 8-17); as 8 do `SALES_AREA_SET`
  ficam com `lens=None`. `coverage_update` passa a emitir a lente por área derivada do registro (não da
  ordem em runtime). Reversibility: costly — vira contrato que a Fase 5 consome; saída sales deve
  permanecer byte-idêntica.
- **D-23:** Gravar os dois prompts de planner separados. Em memória,
  `state.prompts["question_planner_produto"]` e `["question_planner_dados"]`; na tabela
  `session_prompts`, dois valores de `agent` novos (`question_planner_produto`, `question_planner_dados`).
  Implica ampliar o enum `agent` — migration aditiva, no mesmo pacote das colunas `lens`. Reversibility:
  one-way — mas aditivo, não quebra os valores existentes.
- **D-24:** Gate explícito por `mode` + teste-semente. Todo o ramo de dois agentes, contador de Dados e
  preenchimento de `lens` só entra quando `mode=="discovery"`; o sales cai no caminho de um planner de
  hoje, com `lens` vazio. Deixar ao menos 1 teste real provando: sessão sales gera perguntas com um único
  planner, `lens` NULL em questions/red_flags, nenhum contador de Dados criado, e saída de coverage sales
  inalterada. Reversibility: reversible (test/guard).

### Claude's Discretion

- Split dos prompts por lente: como o `DiscoveryPromptBuilder.build_question_planner` vira dois prompts
  escopados (ex.: `build_question_planner(lens="produto"|"dados")` restrito às áreas + tópicos daquela
  lente). Tópicos por lente são o contrato do SC#1.
- Texto exato do enquadramento de cada agente (Produto vs Dados) — proposta do research a validar,
  análogo à discrição de framing da Fase 2 (D-10).
- Localização/forma do contador do Dados (campo em `SessionState` vs no `SessionPipeline`), desde que
  seja estado em memória por sessão e cumpra D-13.
- Formato exato da normalização do texto na trava de dedup (D-17), desde que seja determinística e barata.
- Detalhe da migration (nome/arquivo, `text` nullable vs enum, ordem das colunas), desde que aditiva e
  compatível com o cliente Supabase atual, e que amplie o enum de `session_prompts` (D-23) no mesmo pacote.

### Deferred Ideas (OUT OF SCOPE)

- Badges/agrupamento por lente na UI + render server-driven das áreas → Fase 5 (UI-01/02/03).
- Seção "Métricas para Precificação" + handoff import-from-diagnosis → Fase 4 (REP-01/02).
- Dedup semântico (embeddings/similaridade) entre perguntas → só se a trava de texto não bastar na
  prática; melhoria futura.
- Segundo pipeline de coverage/red-flags (2× por lente) → fora de escopo do milestone.
- Cotas rígidas por lente na fila / aumentar o teto no discovery → descartado agora (D-14).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LENS-01 | Agente "Produto" (primário) gera perguntas de discovery cobrindo gargalo, frente de atuação, impacto no usuário, mapeamento de processos e viabilidade de entrega | Ver "Pattern 1: split de prompt por lente" e "Code Example 1" — `build_question_planner(lens="produto")` restrito às 8 áreas de order 0-7 de `DISCOVERY_AREA_SET` |
| LENS-02 | Agente "Dados" (auxiliar) gera perguntas focadas em dados (fontes, qualidade, métricas, LGPD/segurança, abordagem de solução, quick wins), disparado com menos frequência | Ver "Pattern 3: contador de cadência determinístico" e "Code Example 2" — gate `question_trigger_count % 2 == 0` |
| LENS-03 | Perguntas dos dois agentes aparecem na mesma fila, cada uma com sua lente | Ver "Pattern 2: orquestração sequencial" — `_run_question_planner` insere ambos os lotes em `state.questions`, setando `lens` no laço, não no LLM |
| LENS-04 | Áreas de cobertura e red flags carregam tag de lente | Ver "Pattern 4: lens em red flags" e "Pattern 5: lens em coverage areas" |
| LENS-05 | Nenhuma pergunta duplicada entre os dois agentes (anti-repetição compartilhada) | Ver "Pattern 2" (recent reconstruído após Produto inserir) + "Pattern 6: trava de dedup por texto normalizado" |
</phase_requirements>

## Summary

Esta fase é uma extensão cirúrgica de um pipeline já maduro, não uma reescrita. Toda a infraestrutura
necessária já existe e foi verificada nesta sessão: a fila única de perguntas (`state.questions`), o
anti-repeat por texto (`recent`, `pipeline.py:294-302`), a serialização automática do WebSocket via
`__dict__`, o registro único de áreas (`coverage_areas.py`) já particionado em Produto (order 0-7) /
Dados (order 8-17) desde a Fase 2, e o padrão de builders-irmãos duck-typed (`DiscoveryPromptBuilder`
vs `PromptBuilder`) que isola 100% do comportamento discovery do sales. O trabalho desta fase é (1)
dividir `_run_question_planner` (`pipeline.py:282-344`) em dois laços sequenciais Produto→Dados só
quando `mode=="discovery"`, (2) adicionar um campo `lens` a três dataclasses (`Question`, `RedFlag`,
`AreaDefinition`) e propagá-lo através de inserts Supabase + broadcasts WS já existentes, e (3) uma
migration aditiva única que cobre `questions.lens`, `red_flags.lens` e o comentário do enum `agent` de
`session_prompts`.

Uma descoberta importante desta pesquisa que **muda a natureza da tarefa "ampliar o enum" do D-23**:
`session_prompts.agent` **não é um enum nativo do Postgres** — é uma coluna `text NOT NULL` comum, sem
`CHECK` constraint (`supabase/migrations/20260524000000_initial_schema.sql:139-145`, coluna `agent` sem
`CHECK`). O "enum" mencionado no schema é só documentação em comentário SQL. Isso significa que
`question_planner_produto`/`question_planner_dados` já podem ser gravados **hoje**, sem qualquer
`ALTER TYPE` ou migration adicional — o único artefato de migration necessário para D-23 é **atualizar o
`COMMENT ON COLUMN`** para documentar os dois novos valores (mesmo padrão do `COMMENT` que a migration de
`projects.mode` já usa, `20260921000000_add_mode_to_projects.sql:10-11`). Isso reduz o risco da migration
combinada — ela é puramente aditiva em `questions`/`red_flags` (`ADD COLUMN IF NOT EXISTS lens text`) e
cosmética em `session_prompts` (comentário).

**Recomendação principal:** implemente o split de dois agentes inteiramente dentro de
`_run_question_planner`, gateado por `if self.state.mode == "discovery"`, reaproveitando os mesmos
helpers (`llm_service.generate_questions`, o cálculo de `recent`, o loop de insert+broadcast) em vez de
duplicar código — a diferença entre Produto e Dados é apenas: qual prompt (`state.prompts[...]`), qual
`lens` fixo no insert, e quantas perguntas pedir (D-20). Extraia esse loop de insert em um helper privado
parametrizado por `(questions_data, lens)` para não repetir o bloco de `pipeline.py:318-341` duas vezes
(SOLID — Single Responsibility, evita duplicação entre os dois ramos).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Split de prompt por lente (Produto/Dados) | API / Backend (`discovery_prompt_builder.py`) | — | Prompt building é lógica de composição de string, hoje 100% no builder; nenhuma parte disso toca DOM/UI |
| Orquestração sequencial Produto→Dados + contador de cadência | API / Backend (`pipeline.py`) | — | `_run_question_planner` já é o orquestrador único desta etapa; contador é estado de processo, não de UI |
| Persistência da lente (`lens` em questions/red_flags) | Database / Storage (Supabase) | API / Backend (dataclasses + inserts) | Coluna nova é puramente de armazenamento; o backend é quem escreve/lê, sem lógica de negócio no banco |
| Emissão da lente no WebSocket | API / Backend (broadcast via `__dict__`) | Browser / Client (consumo, fora de escopo nesta fase) | Backend só *emite* o campo; grouping/exibição é Fase 5 — não há trabalho de frontend nesta fase |
| Dedup por texto normalizado | API / Backend (`pipeline.py`, camada de código) | — | É uma trava determinística em memória/Python, não uma constraint de banco nem uma decisão de LLM |
| Classificação de lente em red flags | API / Backend (contrato JSON do LLM) + fallback em código | — | O LLM classifica; o código aplica o fallback `produto` quando o valor vier vazio/inválido — dupla camada, ambas no backend |

## Standard Stack

Nenhuma dependência nova é necessária nesta fase — é uma extensão de código já existente com o mesmo
stack (`google.genai` direto para os agentes discovery, sem LangChain, conforme
`CLAUDE.md §"Regra de frameworks de IA por módulo"` — a regra bloqueia LangChain apenas para o Agente
Diagnóstico, e esta fase só toca o Agente Diagnóstico). `google-genai>=0.8.0` já está em
`backend/requirements.txt` [VERIFIED: backend/requirements.txt] e é o único cliente LLM usado em
`llm.py:5` (`import google.genai as genai`) [VERIFIED: backend/app/services/llm.py:5].

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| google-genai | >=0.8.0 (já instalado) | Chamadas LLM diretas (`_call` em `llm.py:36-59`) | Já é o único cliente usado pelos 3 agentes realtime discovery; nenhuma mudança de cliente nesta fase |
| pytest / pytest-asyncio | já instalado (`asyncio_mode = auto` em `backend/pytest.ini:1-2`) | Testes unitários com `monkeypatch` sobre `llm._call` e `get_supabase` | Padrão já estabelecido nas Fases 1-2 (`test_discovery_mode.py`, `test_expire_questions.py`) |

### Supporting

Nenhuma. Esta fase não introduz nova biblioteca de suporte — é composição de código Python puro
(dataclasses, dict, string normalization) sobre a infraestrutura existente.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Contador em memória (`SessionState`) | Persistir o contador de cadência no Supabase | Rejeitado por D-13 explicitamente ("estado em memória da sessão") — persistir criaria complexidade de sincronização sem benefício, já que o contador reinicia por sessão de qualquer forma |
| Dedup por texto normalizado em código | Dedup semântico via embeddings | Rejeitado nesta fase (Deferred Ideas) — custo de LLM extra sem necessidade comprovada; revisitar só se a trava textual não bastar na prática |

**Installation:** nenhuma — sem novos pacotes.

## Package Legitimacy Audit

**Não aplicável.** Esta fase não instala nenhum pacote novo (nem npm nem pip); todo o trabalho é sobre
código e schema já presentes no repositório. Nenhum verdict SLOP/SUS/OK a reportar.

## Architecture Patterns

### System Architecture Diagram

```
Gatilho de geração de perguntas (WS "generate_questions" | POST /sessions/:id/questions/generate)
    │
    ▼
SessionPipeline.trigger_questions()
    │
    ▼
_run_question_planner()  ──── mode == "sales" ──────────────► [caminho atual, 1 planner, lens=None]
    │
    │ mode == "discovery"
    ▼
state.question_trigger_count += 1
    │
    ├─► SEMPRE: gera lote Produto
    │      1. recent = anti-repeat sobre state.questions (texto)
    │      2. llm_service.generate_questions(prompt=question_planner_produto, max=3)
    │      3. para cada pergunta: normaliza texto → se já na fila (normalizado), descarta
    │      4. insere em state.questions com lens="produto" + insert Supabase + broadcast question_new
    │
    ├─► SE contador par (2,4,6…): gera lote Dados
    │      1. recent RECALCULADO (agora inclui as perguntas do Produto recém-inseridas)
    │      2. llm_service.generate_questions(prompt=question_planner_dados, max=2)
    │      3. mesma trava de dedup normalizado (agora também vê os textos do Produto)
    │      4. insere com lens="dados" + insert Supabase + broadcast question_new
    │
    ▼
Fila única (state.questions) — teto 5 continua respeitado a cada insert individual (D-14)

Em paralelo (task de 15s, já existente, não split):
_run_red_flag_detector() → detect_red_flags() retorna {"text","severity","evidence","lens"}
    → fallback lens="produto" se ausente/vazio/inválido → insert red_flags.lens → broadcast red_flag

Coverage (task de 30s, já existente, não split):
_run_coverage_classifier() → sem mudança de lógica de classificação
    → coverage_to_dict() passa a anexar "lens" por área, LIDO do registro (AreaDefinition.lens),
      não do CoverageArea em runtime → broadcast coverage_update
```

### Recommended Project Structure

Nenhum arquivo novo é necessário — todos os pontos de mudança já existem:

```
backend/app/
  services/
    pipeline.py              # _run_question_planner ganha o split de 2 agentes + contador + dedup
    discovery_prompt_builder.py  # build_question_planner(lens=...) — 2 variantes; build_red_flag_detector ganha instrução de lens
    coverage_areas.py         # AreaDefinition ganha campo lens; AreaSet ganha método by_lens()
    session_state.py          # Question/RedFlag ganham campo lens; SessionState ganha question_trigger_count
    llm.py                    # detect_red_flags: contrato JSON ganha "lens"; generate_questions ganha max_questions
  models/
    questions.py               # QuestionResponse ganha campo lens
supabase/migrations/
  <novo arquivo>.sql          # ADD COLUMN lens em questions/red_flags + COMMENT atualizado em session_prompts.agent
backend/tests/
  test_lens_tagging.py         # novo — testes desta fase (nome sugerido, não canônico)
```

### Pattern 1: Split de prompt por lente (SC#1, discricionário)

**What:** `DiscoveryPromptBuilder.build_question_planner` recebe um parâmetro `lens: str` e retorna um
prompt restrito às áreas + tópicos daquela lente, em vez do prompt único atual.

**When to use:** Toda vez que `_run_question_planner` monta o prompt do planner em modo discovery —
uma chamada com `lens="produto"`, outra com `lens="dados"`.

**Fundamentação:** o prompt atual [VERIFIED: backend/app/services/discovery_prompt_builder.py:181-205]
já usa `DISCOVERY_AREA_SET.block_enum()` para restringir o enum de `block` que o LLM pode devolver:

```
'{"questions":[{"text":"...","block":"' + DISCOVERY_AREA_SET.block_enum() + '"}]}'
```

`AreaSet.block_enum()` [VERIFIED: backend/app/services/coverage_areas.py:52-53] é
`return "|".join(self.keys())` — ou seja, para restringir o enum a um subconjunto de áreas basta um
`AreaSet` cujo `.areas` já venha filtrado. `AreaDefinition` hoje **não tem** campo `lens`
[VERIFIED: backend/app/services/coverage_areas.py:23-27 — `class AreaDefinition: key: str; label: str; order: int` — sem `lens`], então D-19 exige adicioná-lo. Uma vez adicionado, o método natural
(Open/Closed — método novo, não modifica os existentes) é:

```python
# coverage_areas.py — AreaSet ganha um método novo (nenhum método existente muda)
def by_lens(self, lens: str) -> "AreaSet":
    return AreaSet(
        name=f"{self.name}_{lens}",
        areas=tuple(a for a in self._ordered() if a.lens == lens),
    )
```

Como D-06 já particiona `DISCOVERY_AREA_SET` em Produto (order 0-7) / Dados (order 8-17)
[VERIFIED: backend/app/services/coverage_areas.py:79-99 — quote completo abaixo], atribuir
`lens="produto"` às 8 primeiras `AreaDefinition` e `lens="dados"` às 10 seguintes é uma correspondência
direta com uma partição já existente, não uma nova regra de negócio:

```
AreaDefinition("gargalo", "Gargalo", 0),
AreaDefinition("frente_atuacao", "Frente de Atuação", 1),
AreaDefinition("impacto_usuario", "Impacto no Usuário", 2),
AreaDefinition("mapeamento_processos", "Mapeamento do Fluxo de Processos", 3),
AreaDefinition("fluxo_dados", "Fluxo dos Dados", 4),
AreaDefinition("desenho_solucao", "Desenho da Solução", 5),
AreaDefinition("expectativa_solucao", "Expectativa de Solução", 6),
AreaDefinition("viabilidade_solucao", "Viabilidade da Solução", 7),
# Dados (8-17)
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
```
[VERIFIED: backend/app/services/coverage_areas.py:79-99]

**Nota importante para o planner:** os "tópicos" citados no ROADMAP para cada lente (Produto: gargalo,
frente de atuação, impacto no usuário, mapeamento de processos, viabilidade de entrega; Dados: fontes,
qualidade, métricas, LGPD/segurança, abordagem de solução, quick wins) **não mapeiam 1:1** para as 8+10
chaves de área — por exemplo "viabilidade de entrega" (tópico do roadmap) versus as chaves de área
`desenho_solucao`/`expectativa_solucao`/`viabilidade_solucao` (3 chaves Produto que cobrem esse tópico).
"Abordagem de solução" (tópico Dados do roadmap) não corresponde a nenhuma chave de área Dados
explícita — é território coberto de forma difusa por `qualidade_fontes`/`metricas` no registro atual.
Isso é esperado: os tópicos do roadmap são a *narrativa* de cada lente para orientar o enquadramento do
prompt (linguagem natural), enquanto `by_lens("produto"|"dados")` filtra as *chaves formais* de área
usadas no enum JSON. Um Open Question fica registrado abaixo sobre se o texto de "abordagem de solução"
precisa de instrução textual adicional no prompt Dados além do enum de áreas.

**Proposta de enquadramento (texto exato — discricionário, a validar, análogo a D-10):**

Produto (primário) — mantém a abertura atual quase idêntica, adicionando o rótulo de lente:

```python
def build_question_planner(self, lens: str) -> str:
    scoped = DISCOVERY_AREA_SET.by_lens(lens)
    if lens == "produto":
        framing = (
            "Você é o QuestionPlanner de PRODUTO (lente primária) atuando como facilitador de "
            "discovery — suas perguntas mapeiam o gargalo, a frente de atuação, o impacto no "
            "usuário, o mapeamento de processos e a viabilidade de entrega da solução. Você roda "
            "em TODO ciclo de geração desta sessão."
        )
        n_questions = 3
    else:  # lens == "dados"
        framing = (
            "Você é o QuestionPlanner de DADOS (lente auxiliar) atuando como facilitador de "
            "discovery — suas perguntas mapeiam as fontes e a qualidade dos dados, as métricas "
            "relevantes, riscos de LGPD/segurança, a abordagem técnica da solução e possíveis "
            "quick wins. Você roda com menor frequência que o QuestionPlanner de Produto — "
            "aproveite cada ciclo para aprofundar o que ainda não foi perguntado."
        )
        n_questions = 2
    ...
    '{"questions":[{"text":"...","block":"' + scoped.block_enum() + '"}]}'
```

Esta proposta é `[ASSUMED]` — é redação nova, não existe hoje; deve ser validada pelo time (ver
Assumptions Log).

### Pattern 2: Orquestração sequencial Produto → Dados + dedup entre agentes (SC#4/#5, D-16/D-17)

**What:** dentro de `_run_question_planner`, o laço do Produto roda primeiro, insere no
`state.questions` (memória + Supabase + broadcast), e só depois o laço do Dados monta seu contexto
`recent` — que portanto já enxerga os textos do Produto, gerados no mesmo gatilho.

**Fundamentação:** `recent` hoje é montado assim
[VERIFIED: backend/app/services/pipeline.py:294-302]:

```python
recent = list({
    q.text
    for q in self.state.questions
    if q.source == "pre_mapped" or q.status == "dismissed"
} | {
    q.text
    for q in self.state.questions[-6:]
    if q.status in ("queued", "pinned", "used")
})
```

Isso já opera sobre `self.state.questions` inteiro (a lista **compartilhada** entre as duas lentes —
não há fila separada por agente). Ao rodar o Dados **depois** do laço de insert do Produto
(`pipeline.py:318-341`, onde `self.state.questions.append(q)` acontece antes do próximo cálculo de
`recent`), o Dados reconstrói `recent` e automaticamente vê as perguntas do Produto — sem nenhum
código de sincronização adicional. A ordem de execução (não uma estrutura de dados nova) é o
mecanismo de dedup na origem para SC#4/#5.

**Código proposto (esqueleto, `[ASSUMED]` — refatoração ainda não escrita):**

```python
async def _run_question_planner(self) -> None:
    key = self._resolve_gemini_key()
    if not key:
        await ws_manager.broadcast(...)  # inalterado
        return

    if self.state.mode != "discovery":
        await self._run_single_planner(lens=None, prompt_key="question_planner", max_questions=3)
        return

    self.state.question_trigger_count += 1
    await self._run_single_planner(lens="produto", prompt_key="question_planner_produto", max_questions=3)

    if self.state.question_trigger_count % 2 == 0:
        await self._run_single_planner(lens="dados", prompt_key="question_planner_dados", max_questions=2)
```

`_run_single_planner` extrai o corpo hoje duplicado (cálculo de `recent`, chamada a
`llm_service.generate_questions`, laço de insert+broadcast de `pipeline.py:293-344`) num único método
privado parametrizado — evita repetir o bloco duas vezes (SOLID: Single Responsibility / DRY) e é o
único lugar que precisa saber sobre o teto de 5 (D-14), a trava de dedup normalizado (D-17) e o
`lens` fixo do laço (D-21).

### Pattern 3: Contador de cadência determinístico (SC#3, D-13)

**What:** `SessionState` ganha um campo `question_trigger_count: int = 0`; o Dados só roda quando
`question_trigger_count % 2 == 0` (após o incremento no início do laço — logo, 1º gatilho vira
contagem 1 → Produto só; 2º gatilho vira contagem 2 → Produto + Dados; e assim por diante).

**Discretion resolvida (SessionState vs SessionPipeline):** recomenda-se `SessionState`, pelo mesmo
padrão já usado para `tokens_used`, `cost_usd` e (nesta mesma fase) `prompts` — todo estado que precisa
sobreviver entre chamadas de `trigger_questions()` dentro da vida da sessão já vive em `SessionState`
[VERIFIED: backend/app/services/session_state.py:93-95 — `tokens_used: int = 0`, `cost_usd: float = 0.0`
já são campos de `SessionState`, não de `SessionPipeline`]. Isso também facilita testes unitários: os
testes de regressão (D-24) podem instanciar `SessionState(session_id="t", mode="sales")` e checar
diretamente que `question_trigger_count` não é incrementado, sem precisar de um `SessionPipeline` de
verdade. `SessionPipeline` é reconstruído a cada `get_or_create` em memória do processo
[VERIFIED: backend/app/services/pipeline.py:530-538 — `_pipelines: Dict[str, SessionPipeline]`, um por
`session_id`, cache em memória do processo] — colocar o contador lá funcionaria igualmente bem em
runtime, mas colocá-lo em `SessionState` é mais consistente com o padrão estabelecido e mais testável.

**Pitfall:** o contador deve incrementar **mesmo** quando `mode != "discovery"` não incrementa (porque
o ramo sales nunca toca esse código) — nenhum risco aqui, já que D-24 gateia por `mode` antes de tocar
o contador.

### Pattern 4: Lens em red flags (D-15/D-22)

**What:** `detect_red_flags` ganha `"lens":"produto|dados"` no contrato JSON de saída; o prompt do
`build_red_flag_detector` (discovery) instrui o LLM sobre como classificar (produto = gargalo/processo/
viabilidade; dados = fontes/qualidade/LGPD/métricas); o código aplica fallback `produto` quando o valor
vier ausente, vazio, ou fora de `{"produto","dados"}`.

**Contrato atual (sales, inalterado)** [VERIFIED: backend/app/services/llm.py:82-99]:
```python
system = system_prompt or (
    ...
    '{"red_flags":[{"text":"...","severity":"warning|critical","evidence":"..."}]}'
)
```

**Contrato discovery (proposto — `discovery_prompt_builder.build_red_flag_detector`, linha final)**
[VERIFIED texto-base: backend/app/services/discovery_prompt_builder.py:147-148 — hoje devolve
`'{"red_flags":[{"text":"...","severity":"warning|critical","evidence":"trecho exato da transcrição"}]}'`
sem `lens`]:
```python
'{"red_flags":[{"text":"...","severity":"warning|critical","evidence":"...","lens":"produto|dados"}]}'
```

**Fallback no código** (em `_run_red_flag_detector`, `pipeline.py:262-268`, hoje monta `RedFlag(...)`
sem `lens`):
```python
raw_lens = str(flag.get("lens", "")).strip().lower()
lens = raw_lens if raw_lens in ("produto", "dados") else "produto"
rf = RedFlag(..., lens=lens)
```
Só aplica quando `self.state.mode == "discovery"`; no sales, `lens=None` sempre (D-24).

**Importante — não tocar o detector sales:** `PromptBuilder.build_red_flag_detector`
[VERIFIED: backend/app/services/prompt_builder.py:341-395] continua devolvendo o contrato sem `lens`;
o parser em `_run_red_flag_detector` deve usar `.get("lens", "")` (não indexação direta) para não
quebrar quando o campo simplesmente não vier — o que é justamente o caso sales.

### Pattern 5: Lens em coverage areas (D-19)

**What:** `coverage_to_dict()` [VERIFIED: backend/app/services/session_state.py:143-147] hoje devolve:
```python
def coverage_to_dict(self) -> dict:
    return {
        area: {"status": c.status, "score": c.score, "notes": c.notes, "name": c.name}
        for area, c in self.coverage.items()
    }
```
`c` é uma instância de `CoverageArea` (estado runtime, sem campo `lens`)
[VERIFIED: backend/app/services/session_state.py:45-50]. A lente **não pode vir daqui** — precisa vir
do registro estático (`AreaDefinition.lens`), consultado pelo `key` da área (`area`, a chave do dict).
Isso exige que `SessionState` (ou o próprio `coverage_to_dict`) tenha acesso a um mapa
`{key: lens}` derivado de `DISCOVERY_AREA_SET`/`SALES_AREA_SET` conforme `self.mode`:

```python
def coverage_to_dict(self) -> dict:
    area_set = DISCOVERY_AREA_SET if self.mode == "discovery" else SALES_AREA_SET
    lens_by_key = {a.key: a.lens for a in area_set.areas}
    return {
        area: {
            "status": c.status, "score": c.score, "notes": c.notes, "name": c.name,
            "lens": lens_by_key.get(area),  # None para custom_areas e para sales (D-19)
        }
        for area, c in self.coverage.items()
    }
```
Áreas custom (`custom_areas`, injetadas fora do registro — `session_state.py:38-41`) não têm
`AreaDefinition` correspondente, então `lens_by_key.get(area)` retorna `None` naturalmente — sem
tratamento especial. Isso preserva o `[SALES_AREA_SET.lens=None]` do D-19 automaticamente, já que
`AreaDefinition("negocio", "Negócio", 0)` etc. no `SALES_AREA_SET`
[VERIFIED: backend/app/services/coverage_areas.py:57-69] não tem hoje campo `lens` — ao adicioná-lo
com default `None`, nenhuma linha existente muda.

**Pitfall verificado:** `AreaSet` é `@dataclass(frozen=True)` e `AreaDefinition` também
[VERIFIED: backend/app/services/coverage_areas.py:23,30] — adicionar um campo com valor default
(`lens: str | None = None`) é seguro em dataclasses frozen desde que venha **depois** dos campos
obrigatórios (`key`, `label`, `order`), senão Python levanta `TypeError: non-default argument follows
default argument`.

### Pattern 6: Trava de dedup por texto normalizado (D-17)

**What:** função pura, sem side effects (`CLAUDE.md` — "funções puras onde possível"):

```python
def _normalize_question_text(text: str) -> str:
    return " ".join(text.strip().lower().split())
```

Aplicada no laço de insert de `_run_single_planner`, mantendo um `set()` de textos normalizados já na
fila (recalculado a cada chamada, a partir de `self.state.questions` — não um cache entre chamadas, para
não vazar estado entre sessões/reruns):

```python
existing_normalized = {_normalize_question_text(q.text) for q in self.state.questions}
for q_data in questions:
    text = q_data.get("text", "")
    norm = _normalize_question_text(text)
    if not text or norm in existing_normalized:
        continue
    existing_normalized.add(norm)  # evita duplicata DENTRO do mesmo lote (2+ perguntas iguais do mesmo LLM call)
    ...
```

**Onde vive:** função no módulo `pipeline.py` (perto de `_run_question_planner`), não em
`session_state.py` nem em `llm.py` — é puramente uma trava de orquestração, não uma responsabilidade do
estado nem do cliente LLM. Isso mantém `llm.py` livre de lógica de negócio (regra do CLAUDE.md —
"Sem lógica de negócio em routers"/"services" aplicada por analogia aos módulos de agente).

**Nota de dedup pré-existente que não deve ser confundida:** red flags já têm um dedup por prefixo de
60 caracteres [VERIFIED: backend/app/services/pipeline.py:254,258 —
`existing_texts = {f.text[:60] for f in self.state.red_flags}` e `if not text or text[:60] in
existing_texts`]. Este mecanismo é **diferente** (por prefixo bruto, não normalizado) e **não** faz
parte do escopo de dedup entre lentes desta fase (red flags não têm o problema de "dois agentes" — o
detector continua único, D-15). Não misturar os dois padrões.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Restringir enum de área por lente no prompt | Uma nova lista hardcoded de chaves por lente dentro do builder | `AreaSet.by_lens(lens)` sobre o registro único já existente | Repete o motivo de existir do `coverage_areas.py` (D-01/D-02, Fase 1) — qualquer lista hardcoded de chaves fora do registro reintroduz a duplicação que a Fase 1 eliminou |
| Detectar duplicata entre agentes | Comparação semântica/embeddings na hora | Trava de texto normalizado (Pattern 6) — já é o padrão travado em D-17 | Dedup semântico é `Deferred Idea` explícita nesta fase; custo de LLM extra sem necessidade comprovada |
| Saber se uma sessão está em discovery ou sales dentro de `pipeline.py` | Um novo enum/flag paralelo a `mode` | `self.state.mode == "discovery"`, já propagado de `projects.mode` (Fase 2, D-07) | `mode` já é a fonte única de verdade para o fork sales/discovery em `pipeline.py:598-612`; introduzir um segundo sinalizador criaria dessincronização possível |

**Key insight:** todo o "novo" comportamento desta fase é composição sobre três primitivas que já
existem (registro de áreas, fila única de perguntas, seleção de builder por `mode`) — o risco real não
é técnico, é de **regressão silenciosa no caminho sales** se o gate por `mode` não cobrir os quatro
pontos de entrada (contador, split de prompt, lens em questions, lens em red flags) de forma consistente.

## Common Pitfalls

### Pitfall 1: Esquecer de gatear o `_run_question_planner` inteiro por `mode`

**What goes wrong:** se o split Produto/Dados rodar também no sales (mesmo que "por engano" apenas uma
vez), o sales passa a fazer 2 chamadas LLM por gatilho em vez de 1 — quebra SC#4 (byte-idêntico) e dobra
custo silenciosamente.

**Why it happens:** o ponto de entrada (`_run_question_planner`) é único para os dois modos hoje
[VERIFIED: backend/app/services/pipeline.py:282-344] — é fácil adicionar o split "antes" do check de
`mode` por engano, symmetric ao erro que a Fase 2 já documentou como Pitfall para `generate_report`
(bloco CITi precisava ser condicional por `mode`, não incondicional).

**How to avoid:** replicar o padrão de teste já usado em `test_discovery_mode.py` (linhas 181-216) —
capturar a mensagem/prompt enviado e comparar contra o texto exato esperado para `mode="sales"` (deve
ser idêntico ao pré-fase), e um segundo teste para `mode="discovery"` cobrindo o novo comportamento.

**Warning signs:** teste de regressão sales (D-24) falhando com 2 registros em `session_prompts` para
uma sessão sales, ou `state.questions` recebendo entradas com `lens` não-`None` numa sessão sales.

### Pitfall 2: `AreaSet`/`AreaDefinition` são `frozen=True` — ordem de campos importa

**What goes wrong:** adicionar `lens: str | None = None` **antes** de `order: int` (campo sem default)
levanta `TypeError` na definição da classe, quebrando a importação de `coverage_areas.py` inteira (todo
o backend cai, já que `session_state.py`, `llm.py`, `prompt_builder.py` e
`discovery_prompt_builder.py` importam deste módulo).

**Why it happens:** `@dataclass` exige que campos com valor default venham depois dos sem default.

**How to avoid:** adicionar `lens` como o **último** campo de `AreaDefinition`
(`key, label, order, lens: str | None = None`), e popular todas as 26 instâncias existentes (8 sales +
18 discovery) explicitamente ou deixá-las usar o default `None` (só as 18 discovery precisam do valor
explícito `"produto"`/`"dados"`; as 8 sales ficam com o default `None`, que já é o valor de D-19).

**Warning signs:** `ImportError`/`TypeError` no import de qualquer módulo de `app.services` nos testes.

### Pitfall 3: `coverage_to_dict()` não tem acesso ao registro de áreas hoje

**What goes wrong:** tentar ler `c.lens` (onde `c` é uma `CoverageArea` runtime) sempre retorna
`AttributeError` — `CoverageArea` [VERIFIED: backend/app/services/session_state.py:45-50] não tem e não
deve ganhar campo `lens` (a lente é do registro estático, não do estado runtime, por D-19: "campo que
a Fase 2 reservou... `coverage_update` passa a emitir a lente por área **derivada do registro**").

**Why it happens:** é tentador colocar `lens` direto no `CoverageArea` runtime por simetria com
`Question`/`RedFlag` — mas as áreas de cobertura são fixas por sessão (vêm do registro, nunca mudam
depois de `_init_coverage`), enquanto perguntas/red-flags são geradas dinamicamente pelo LLM.

**How to avoid:** implementar a busca de lens em `coverage_to_dict()` via lookup em
`DISCOVERY_AREA_SET`/`SALES_AREA_SET` por `mode`, não em `CoverageArea` (ver Pattern 5).

**Warning signs:** teste tentando instanciar `CoverageArea(lens="produto")` e falhando com
`TypeError: unexpected keyword argument`.

### Pitfall 4: Confundir `lens` (D-21, autoritário do agente) com derivação por `block`

**What goes wrong:** implementar `lens = "produto" if block in PRODUTO_KEYS else "dados"` como forma de
"economizar" o parâmetro explícito — isso quebra D-21 explicitamente, porque o LLM pode devolver um
`block` de uma lente diferente da que foi solicitada (ex.: o QuestionPlanner de Dados, por erro do
modelo, devolve `block="gargalo"` que é uma chave Produto) — e nesse caso a lente **deve continuar**
"dados" porque foi aquele laço/prompt que gerou a pergunta.

**Why it happens:** parece redundante ter um campo separado quando já existe `block`, mas os dois têm
fontes de verdade diferentes (LLM decide `block`; orquestrador decide `lens`).

**How to avoid:** setar `lens` como uma constante fixa no laço de insert de cada agente
(`lens="produto"` no laço Produto, `lens="dados"` no laço Dados), nunca lendo `q_data.get("lens")` do
retorno do LLM para perguntas (diferente de red flags, onde o LLM *é* a fonte da lente, D-15).

**Warning signs:** teste que gera uma pergunta com `block` de uma lente e espera `lens` da lente
oposta (deve passar) — se falhar, há derivação por `block` no código.

### Pitfall 5: `recent` reconstruído incorretamente antes/depois do insert do Produto

**What goes wrong:** se `_run_single_planner("dados", ...)` calcular `recent` **antes** de
`_run_single_planner("produto", ...)` terminar seus inserts (ex.: paralelismo acidental com
`asyncio.gather` em vez de `await` sequencial), o Dados não vê as perguntas do Produto e SC#4/#5 falha
silenciosamente (só a trava de texto normalizado global pega o caso, mas ela não usa o LLM como
primeira linha de defesa).

**Why it happens:** é tentador "otimizar" rodando os dois `await` em paralelo via `asyncio.gather` para
reduzir latência — mas isso quebra exatamente a garantia que D-16 pede.

**How to avoid:** usar `await` sequencial simples (não `asyncio.gather`) entre a chamada Produto e a
chamada Dados dentro de `_run_question_planner`, exatamente como está no esqueleto do Pattern 2.

**Warning signs:** teste que injeta uma pergunta do Produto e verifica que ela aparece na string
`recent_text` enviada ao LLM do Dados (via `monkeypatch` de `llm_service.generate_questions`, capturando
o argumento `recent_questions`) — se a lista vier vazia, a ordem está errada.

## Code Examples

### Migration proposta (aditiva, mesmo padrão de `20260921000000_add_mode_to_projects.sql`)

```sql
-- Migration: 20260922000000_add_lens_tagging.sql
-- Adiciona a coluna lens (nullable) a questions e red_flags para a Fase 3
-- (Two-Agent Questions + Lens Tagging). NULL no modo sales (comportamento
-- atual inalterado); 'produto' | 'dados' no modo discovery.
-- Aditiva e idempotente (ADD COLUMN IF NOT EXISTS): linhas existentes ficam
-- com lens NULL, sem backfill manual.

ALTER TABLE questions ADD COLUMN IF NOT EXISTS lens text;
ALTER TABLE red_flags ADD COLUMN IF NOT EXISTS lens text;

COMMENT ON COLUMN questions.lens IS
    'Lente de origem (discovery apenas): produto | dados. NULL no modo sales.';
COMMENT ON COLUMN red_flags.lens IS
    'Lente classificada pelo RedFlagDetector (discovery apenas): produto | dados. NULL no modo sales.';

-- session_prompts.agent NÃO é um enum nativo do Postgres — é `text NOT NULL`
-- sem CHECK constraint (ver initial_schema.sql:139-145). Nenhuma migration de
-- schema é necessária para os novos valores question_planner_produto /
-- question_planner_dados; apenas o comentário é atualizado para documentação.
COMMENT ON COLUMN session_prompts.agent IS
    'Nome do agente: coverage_classifier, red_flag_detector, question_planner (sales), question_planner_produto, question_planner_dados (discovery), diagnostic_agent.';
```

`[VERIFIED: supabase/migrations/20260524000000_initial_schema.sql:139-145]` confirma que a definição
atual de `session_prompts` é:
```
CREATE TABLE IF NOT EXISTS session_prompts (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    agent       text NOT NULL,                      -- enum: coverage_classifier, red_flag_detector, question_planner, diagnostic_agent
    prompt_text text NOT NULL,
    created_at  timestamptz DEFAULT now()
);
```
— sem `CHECK`, confirmando que "enum" ali é comentário, não constraint de banco.

### Teste-semente de regressão sales (D-24) — esqueleto seguindo o padrão de `test_expire_questions.py`

```python
# backend/tests/test_lens_tagging.py (nome sugerido)
from app.services import pipeline as pipeline_mod
from app.services.pipeline import SessionPipeline
from app.services.session_state import SessionState

class _FakeQuery:
    def __init__(self, calls): self._calls = calls
    def insert(self, payload):
        self._calls.setdefault("inserts", []).append(payload)
        return self
    def execute(self):
        return type("R", (), {"data": []})()

class _FakeDB:
    def __init__(self, calls): self._calls = calls
    def table(self, name):
        self._calls["table"] = name
        return _FakeQuery(self._calls)

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

    assert state.question_trigger_count == 0  # contador nunca incrementado no sales
    assert all(q.lens is None for q in state.questions)
    inserted = calls.get("inserts", [[{}]])[-1][0]
    assert inserted.get("lens") is None
```

Este esqueleto é `[ASSUMED]` (ainda não escrito) mas segue byte-a-byte o padrão de fake DB já
verificado em `test_expire_questions.py:31-64` — reutilizar essa fixture, não inventar uma nova.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Texto exato do enquadramento/framing dos prompts Produto e Dados (Pattern 1) | Architecture Patterns → Pattern 1 | Baixo — é só prosa do system prompt; fácil de ajustar depois sem tocar contrato JSON. Precisa validação do time de negócio antes de "travar" como no D-10 da Fase 2 |
| A2 | Extrair `_run_single_planner(lens, prompt_key, max_questions)` como helper único compartilhado entre Produto/Dados/sales (em vez de 3 métodos separados) | Summary + Pattern 2 | Médio — é uma decisão de design do plano, não uma decisão travada em CONTEXT.md; o planner pode optar por manter métodos separados se achar mais claro, desde que não duplique o teto de 5 / dedup / lens-fixo em 3 lugares divergentes |
| A3 | Nome do arquivo de migration (`20260922000000_add_lens_tagging.sql`) e agrupamento das 3 mudanças (questions.lens, red_flags.lens, comment de session_prompts.agent) num único arquivo | Code Examples → Migration proposta | Baixo — CONTEXT.md deixa "detalhe da migration" como discrição explícita; qualquer nome/agrupamento aditivo é reversível |
| A4 | "Abordagem de solução" (tópico Dados do roadmap) não tem chave de área 1:1 — pode precisar de instrução textual adicional além do `block_enum` filtrado | Pattern 1 (nota) | Médio — se o time achar que o LLM Dados não está cobrindo esse tópico na prática, a mitigação é textual (mais uma frase no prompt), não estrutural |
| A5 | `AreaSet.by_lens()` como novo método (em vez de filtrar inline em `discovery_prompt_builder.py`) | Pattern 1 | Baixo — escolha de organização de código (Open/Closed); reversível, não muda contrato externo |

## Open Questions

1. **O `max_questions` deve ser reforçado no parser, ou só pedido no prompt?**
   - What we know: hoje `generate_questions` sempre pede "exatamente 3" no texto do prompt
     [VERIFIED: backend/app/services/llm.py:288], mas o laço de insert já corta no teto de 5
     (`pipeline.py:319-321`) — não há corte por-agente hoje.
   - What's unclear: se o LLM Produto devolver 5 perguntas em vez de 3 (ignorando a instrução), D-14
     ("Produto tendo prioridade") ficaria comprometido só pela ordem de insert, sem um corte explícito
     por `max_questions` no código.
   - Recommendation: o planner deve decidir se `_run_single_planner` corta a lista de `questions_data`
     em `[:max_questions]` antes do laço de insert (defesa em profundidade, barata) — recomendado, dado
     que o padrão já existe para o teto global de 5.

2. **`question_trigger_count` reseta ao reconectar/reload de sessão (`_send_initial_state`)?**
   - What we know: `_send_initial_state` [VERIFIED: backend/app/services/pipeline.py:391-497] recarrega
     `transcript_chunks`, `coverage`, `red_flags` e `questions` do banco, mas não haveria nada a
     recarregar para o contador (ele nunca é persistido, por design D-13).
   - What's unclear: se o processo do backend reiniciar no meio de uma sessão ativa (deploy, crash), o
     contador reseta a 0 e o Dados "perde" posição no ciclo par/ímpar — isso é aceitável dado D-13
     ("estado em memória da sessão", reversível), mas vale confirmar que o time aceita esse
     comportamento (o pior caso é o Dados rodar 1 gatilho "adiantado" ou "atrasado" após um restart raro).
   - Recommendation: aceitar como está (consistente com a decisão travada); não é bloqueador.

## Environment Availability

Não aplicável de forma extensa — nenhuma dependência externa nova. Dois pontos herdados de fases
anteriores continuam valendo e devem ser reconfirmados no plano:

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase (SQL Editor manual) | Aplicar a migration aditiva desta fase | Depende do ambiente do executor — a Fase 2 aplicou a migration anterior via SQL Editor manual, não CLI automatizado ([VERIFIED: .planning/STATE.md linha "RESOLVIDO (2026-09-21): Task 3 aplicada — migration ... executada no Supabase (SQL Editor)"]) | — | Nenhum — é um passo humano (`checkpoint:human-verify` ou `checkpoint:decision`), não pode ser pulado |
| `GEMINI_API_KEY` / chave por projeto | Testes que exercitam `llm_service.generate_questions` de ponta a ponta (fora do unit test com monkeypatch) | Não verificado nesta sessão (não é necessário para os testes unitários propostos, que usam monkeypatch) | — | Testes unitários com `monkeypatch` sobre `llm._call`/`generate_questions` não precisam da chave real — é o padrão já usado em toda a suíte |

**Missing dependencies with no fallback:** aplicar a migration continua sendo um passo manual no
Supabase SQL Editor (mesma limitação já registrada na Fase 2) — o plano deve incluir isso como
checkpoint explícito, não como task automatizável.

**Missing dependencies with fallback:** nenhum outro.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest >=8.0.0 + pytest-asyncio >=0.23.0 [VERIFIED: backend/requirements.txt] |
| Config file | `backend/pytest.ini` — `testpaths = tests`, `asyncio_mode = auto` [VERIFIED: backend/pytest.ini:1-2] |
| Quick run command | `cd backend && python -m pytest tests/test_lens_tagging.py -q` (nome de arquivo sugerido para esta fase) |
| Full suite command | `cd backend && python -m pytest -q` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LENS-01 | Prompt Produto restrito às 8 áreas order 0-7, texto de framing presente | unit | `pytest tests/test_lens_tagging.py::test_build_question_planner_produto_scoped -x` | ❌ Wave 0 |
| LENS-02 | Prompt Dados restrito às 10 áreas order 8-17; Dados só roda em gatilhos pares | unit | `pytest tests/test_lens_tagging.py::test_dados_agent_runs_every_second_trigger -x` | ❌ Wave 0 |
| LENS-03 | Perguntas de ambos os agentes na mesma `state.questions`, cada uma com `lens` correto | unit | `pytest tests/test_lens_tagging.py::test_both_lenses_land_in_shared_queue -x` | ❌ Wave 0 |
| LENS-04 | `coverage_to_dict()` e `RedFlag` carregam `lens`; sales continua com `lens=None` em ambos | unit | `pytest tests/test_lens_tagging.py::test_coverage_and_red_flags_carry_lens -x` | ❌ Wave 0 |
| LENS-05 | Nenhuma dupla de texto normalizado na fila, mesmo entre agentes | unit | `pytest tests/test_lens_tagging.py::test_no_duplicate_normalized_text_across_agents -x` | ❌ Wave 0 |
| (D-24) | Regressão sales: 1 planner, `lens` NULL, sem contador Dados, coverage sales inalterada | unit | `pytest tests/test_lens_tagging.py::test_sales_mode_regression -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd backend && python -m pytest tests/test_lens_tagging.py tests/test_discovery_mode.py -q`
  (roda o novo arquivo + a suíte de regressão discovery/sales já existente da Fase 2, que cobre os
  mesmos pontos de gate por `mode`)
- **Per wave merge:** `cd backend && python -m pytest -q` (suíte completa)
- **Phase gate:** suíte completa verde antes de `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `backend/tests/test_lens_tagging.py` — cobre LENS-01 a LENS-05 + regressão sales (D-24)
- [ ] Nenhuma fixture compartilhada nova necessária — reutilizar o padrão `_FakeDB`/`_FakeQuery` já
      presente em `test_expire_questions.py` (copiar/estender, não recriar do zero)
- [ ] Framework install: nenhum — pytest/pytest-asyncio já instalados

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | não | Fora de escopo desta fase — nenhuma mudança em autenticação |
| V3 Session Management | não | Fora de escopo — `session_id` já existe, sem mudança de ciclo de vida |
| V4 Access Control | não | Fora de escopo — nenhum novo endpoint, nenhuma nova permissão |
| V5 Input Validation | sim | O campo `lens` retornado pelo LLM em `detect_red_flags` **não é confiável por padrão** — deve ser validado contra o conjunto fechado `{"produto", "dados"}` antes de persistir (D-22, fallback `produto`); nunca inserir o valor bruto do LLM sem essa validação, para não permitir que uma resposta malformada do modelo grave um valor arbitrário na coluna `lens` |
| V6 Cryptography | não | Fora de escopo — nenhuma chave/segredo novo nesta fase |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| LLM devolve `lens` fora do enum esperado (ex.: string arbitrária, injeção de valor via prompt do usuário refletido na transcrição) | Tampering | Allowlist estrita em código (`raw_lens if raw_lens in ("produto","dados") else "produto"`, Pattern 4) — nunca um `.get()` cru inserido direto no banco |
| Migration aditiva aplicada parcialmente (ex.: só `questions.lens` sem `red_flags.lens`) deixa o código quebrando ao tentar gravar coluna inexistente | Denial of Service (indireto — sessão discovery para de funcionar) | Migration única cobrindo as 3 mudanças juntas (D-23 explicita isso: "no mesmo pacote das colunas lens") — nunca dividir em migrations separadas aplicadas fora de ordem |

## Sources

### Primary (HIGH confidence — lido diretamente nesta sessão)

- `backend/app/services/pipeline.py` — `_run_question_planner`, `_run_red_flag_detector`,
  `_run_coverage_classifier`, `PipelineManager.get_or_create` (seleção de builder por `mode`)
- `backend/app/services/discovery_prompt_builder.py` — `build_question_planner`,
  `build_red_flag_detector`, `build_all`
- `backend/app/services/prompt_builder.py` — versões sales dos mesmos métodos (para confirmar
  não-regressão)
- `backend/app/services/llm.py` — `detect_red_flags`, `generate_questions`, `_call`
- `backend/app/services/coverage_areas.py` — `AreaDefinition`, `AreaSet`, `SALES_AREA_SET`,
  `DISCOVERY_AREA_SET`
- `backend/app/services/session_state.py` — `CoverageArea`, `RedFlag`, `Question`, `SessionState`,
  `coverage_to_dict`
- `backend/app/models/questions.py` — `QuestionResponse`
- `backend/app/routers/ws.py`, `backend/app/routers/sessions.py` (trecho 280-320)
- `supabase/migrations/20260524000000_initial_schema.sql` (linhas 60-160)
- `supabase/migrations/20260921000000_add_mode_to_projects.sql`
- `backend/tests/test_discovery_mode.py`, `test_coverage_areas_golden.py`, `test_expire_questions.py`,
  `test_report_cost.py`, `conftest.py`
- `backend/pytest.ini`, `backend/requirements.txt`
- `.planning/phases/03-two-agent-questions-lens-tagging/03-CONTEXT.md`
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/config.json`
- `CLAUDE.md` (regras de SOLID, idioma, planejamento de tasks, regra de frameworks LLM por módulo)

### Secondary (MEDIUM confidence)

- Nenhuma — esta fase não exigiu busca externa (WebSearch/Context7); é 100% extensão de código já
  presente no repositório, com decisões já travadas em CONTEXT.md.

### Tertiary (LOW confidence)

- Nenhuma.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — nenhuma lib nova, tudo já instalado e em uso
- Architecture: HIGH — todos os pontos de extensão foram lidos e citados com linha; os padrões
  propostos (split de prompt, orquestração sequencial, dedup) são composições diretas de mecanismos
  já existentes, não inovação arquitetural
- Pitfalls: HIGH — derivados de comportamento observado no código (dataclasses frozen, gate por mode
  já usado em 3 lugares na Fase 2, dedup por prefixo pré-existente que não deve ser confundido)

**Research date:** 2026-09-21
**Valid until:** 30 dias (sem dependência de API externa instável; o único fator de expiração é o
próprio código-fonte mudar antes do plano ser executado)
