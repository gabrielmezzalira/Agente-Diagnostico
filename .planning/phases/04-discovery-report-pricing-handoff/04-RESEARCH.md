# Phase 4: Discovery Report + Pricing Handoff - Research

**Researched:** 2026-09-22
**Domain:** Backend Python/FastAPI — geração de relatório LLM (sibling prompt), migration aditiva Supabase, gate de handoff no Precificador (LangChain)
**Confidence:** HIGH (código lido diretamente nesta sessão; PDF do PRD lido integralmente)

## Summary

A Fase 4 é essencialmente um trabalho de **costura de seams já existentes**, não de construção do
zero. O gate por `mode` (`generate_report`, `pipeline.py`), o registro de áreas com `lens`
(`DISCOVERY_AREA_SET`), o builder-irmão (`DiscoveryPromptBuilder`) e o import de sessão única
(`import_from_diagnosis` já aceita `session_id`) já foram construídos nas Fases 1-3. O trabalho da
Fase 4 é: (1) trocar o esqueleto do relatório discovery de "resumo executivo simplificado" (o que
`DiscoveryPromptBuilder.build_report_generator()` gera hoje) para o **esqueleto do PRD de 16
seções** (0-15) — cujo texto completo foi extraído do PDF nesta pesquisa e está reproduzido abaixo;
(2) trocar `SALES_AREA_SET.labels()` fixo em `llm.py:121` pelo set correto por `mode`, dividido em
duas tabelas por lens; (3) adicionar a coluna `status` (aditiva/nullable) em `reports` e um caminho
para transicioná-la (Rascunho → Em revisão → Aprovado); (4) inserir a pré-condição de status no
`import_from_diagnosis`; (5) calcular o readiness score a partir dos dados já presentes em
`SessionState`.

**Achado crítico não previsto no CONTEXT:** não existe hoje **nenhum endpoint** para mudar o
`status` de um relatório. Sem ele, o gate do item (4) nunca pode ser satisfeito — nenhuma sessão
jamais chegaria a "Aprovado". A Fase 4 precisa entregar, no mínimo, um endpoint/método de serviço
para essa transição (mesmo que o botão da UI seja da Fase 5), ou a verificação-semente do REP-02
("marcá-lo Aprovado") não tem como ser executada sem UPDATE manual direto no Supabase — o que
contradiz a separação de camadas do projeto (SOLID / CLAUDE.md).

**Primary recommendation:** implementar o relatório discovery como um prompt/estrutura irmã (D-25),
seguindo o esqueleto machine-usable derivado do PDF (seção "PRD Skeleton" abaixo); usar
`DISCOVERY_AREA_SET.by_lens("produto"|"dados")` para as duas tabelas de cobertura (D-28); adicionar
`reports.status` como coluna `text` nullable sem `DEFAULT` (mesmo padrão de `lens`, não do `mode`);
gatear o import apenas quando `status` não for `None` e não for `'Aprovado'` (isso faz o gate ser
automaticamente no-op para sales, sem precisar consultar `projects.mode`); calcular readiness em
`SessionState`/`session_state.py` reaproveitando os dados que já existem (`coverage`, `red_flags`,
`questions`, `transcript_chunks`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Geração do relatório discovery (PRD skeleton) | API/Backend (`llm.py::generate_report`) | — | LLM call server-side; frontend só exibe o Markdown pronto |
| Duas tabelas de cobertura por lens | API/Backend (`llm.py`, `coverage_areas.py`) | — | Pré-montagem determinística no backend antes de enviar ao LLM (D-27) |
| Readiness score | API/Backend (`session_state.py` ou novo módulo) | — | Depende só de estado já em memória da sessão; expõe via endpoint de sessão/report |
| Campo `status` do relatório | Database/Storage (migration) + API/Backend (endpoint de transição) | — | Persistência aditiva + lógica de transição de estado |
| Gate de aprovação no handoff | API/Backend (`LLMPricingService.import_from_diagnosis`) | — | Pré-condição de negócio antes de uma chamada LLM cara — não é validação de schema (fica fora do router) |
| Vocabulário de blocos ampliado | API/Backend (prompts em `llm.py` + `llm_pricing_service.py`) | — | `bloco` é texto livre; é só orientação de prompt, não schema |
| Botão "Gerar PRD" / UI de aprovação | Browser/Client | — | **Fora de escopo — Fase 5** (D-35) |

## User Constraints (from CONTEXT.md)

<user_constraints>

### Locked Decisions (D-25 a D-37 — ver `04-CONTEXT.md` para o texto completo com rationale)

- **D-25:** Prompt/estrutura de relatório discovery separado (irmão), escolhido por `mode`.
  `generate_report` (`llm.py:102-195`) ramifica por `mode`; sales permanece byte-idêntico.
- **D-26:** O relatório segue o esqueleto do PRD da CITi (16 seções, 0-15), preenchendo apenas o
  que o pipeline capturou; seções sem insumo ficam `[a preencher no PRD]`. Não auto-gera o PRD
  inteiro.
- **D-27:** Híbrido código+LLM — o código agrupa deterministicamente áreas/red-flags/perguntas por
  `lens` em tabelas/listas; o LLM escreve a análise em cima + transcrição. Mapeamento: Produto →
  seções 1-6, 10, 11; Dados → seção 7 + partes de 8 (LGPD/observabilidade) e 9
  (arquitetura/integrações).
- **D-28:** Duas tabelas de cobertura (Produto / Dados), labels do `DISCOVERY_AREA_SET`, não do
  `SALES_AREA_SET`.
- **D-29:** Métricas de precificação nativas no PRD (6.3 backlog+estimativas, 11 faseamento, 7.3
  volumetria) — sem seção nomeada "Métricas para Precificação".
- **D-30:** Reformular o SC#1 da Fase 4 no ROADMAP (texto atual: `"a single Markdown report with
  distinct Produto and Dados sections plus a 'Métricas para Precificação' section"` — precisa
  virar algo como "as métricas de precificação estão presentes no PRD e são extraíveis pelo
  import"). **Decisão já tomada pelo usuário — falta aplicar a edição.**
- **D-31:** Reusar o extrator de `import_from_diagnosis` (`llm_pricing_service.py:71-179`) como
  está. Verificar com import real; só ajustar se a extração vier ruim.
- **D-32:** Ampliar blocos temáticos de 7 para 12 (aditivo): GenAI/IA, Machine Learning, Governança
  & LGPD/Segurança, Infra/MLOps/Observabilidade, Descoberta/Consultoria. Aplicar nos dois prompts
  do Precificador e na seção de métricas do relatório. `bloco` é texto livre — sem migration.
- **D-33:** Readiness composta por 4 sinais: (1) cobertura mínima por lente, (2) % global das 18
  áreas, (3) perguntas respondidas / transcrição mínima, (4) seções-chave do PRD com dado mapeável.
- **D-34:** Combinação por score ponderado + limiar. Pesos/limiar = default calibrável (Claude's
  discretion).
- **D-35:** Split de fase — backend (readiness, relatório, `status`, gate) = Fase 4; frontend
  (botão + UI de revisão) = Fase 5.
- **D-36:** Campo `status` em `reports` (Rascunho / Em revisão / Aprovado para build), migration
  aditiva; só discovery usa.
- **D-37:** Gate de aprovação — `import-from-diagnosis` exige `status == 'Aprovado'` para
  relatórios discovery antes de extrair; extração inalterada; sales sem gate.

### Claude's Discretion

- Formato exato do esqueleto do PRD em Markdown (nomes/marcadores das seções vazias), desde que
  preserve as 16 seções e o mapeamento de lentes.
- Pesos e limiar do score de readiness (D-34) — default calibrável.
- Formato de pré-montagem determinística das tabelas/listas por lens (D-27).
- Detalhe da migration do `status` (nome/arquivo, `text` nullable vs enum, default).
- Texto exato de desambiguação dos blocos ML / GenAI / Ciência de Dados (D-32).

### Deferred Ideas (OUT OF SCOPE)

- Botão "Gerar PRD" + UI de revisão/aprovação humana → Fase 5.
- PRD completo auto-gerado (personas, user stories Gherkin, CSD, catálogo de regras, KPIs) → fora
  desta fase.
- Adaptar o extrator do import para focar na seção de métricas → só se REP-02 mostrar extração
  ruim.
- Calibração fina dos pesos/limiar de readiness → após sessões reais.
- Aplicar a reformulação do SC#1 no `.planning/ROADMAP.md` (D-30) → edição de texto pendente.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REP-01 | Sessão discovery produz um único relatório com seções Produto + Dados (+ métricas de precificação nativas, D-29/D-30) | Ver "PRD Skeleton (16 seções)" e "Architecture Patterns" — esqueleto completo extraído do PDF, mapeamento de lens por seção, formato de pré-montagem híbrida |
| REP-02 | O relatório discovery alimenta o Precificador via `import-from-diagnosis` (≥1 feature extraída; `pricings.session_id` vinculado) | Ver "Integration Points" e "Common Pitfalls" — `import_from_diagnosis` já aceita `session_id`/já grava `pricings.session_id`; falta status inicial + endpoint de transição + gate |
| REP-03 | Geração do relatório sales continua funcionando sem mudança | Ver "Golden test pattern" em Validation Architecture — padrão de fixture congelada já usado nas Fases 1-3, mesma técnica se aplica aqui |
</phase_requirements>

## Standard Stack

Nenhuma biblioteca nova é necessária nesta fase. Todo o trabalho usa o stack já instalado:
`google.genai` (relatório), `langchain_core`/LangChain (Precificador, inalterado), `FastAPI`,
`supabase-py`, `pytest`/`pytest-asyncio` (testes). Não há `pip install` a fazer.

### Package Legitimacy Audit

**Não aplicável** — esta fase não introduz nenhum pacote externo novo. Nenhum `npm install` /
`pip install` necessário. Seção de auditoria de pacotes omitida por não haver o que auditar.

## Architecture Patterns

### System Architecture Diagram

```
[Sessão discovery ao vivo]
        |
        v
 SessionState (session_state.py)
   - coverage: {area_key: {status, score, notes, lens}}   <- já traz "lens" (D-19)
   - red_flags: [{text, severity, evidence, lens}]         <- já traz "lens" (D-22)
   - questions: [{text, status, lens}]                     <- já traz "lens" (D-21) — MAS
                                                                generate_report só recebe
                                                                questions_used: list[str] (SEM lens)
   - transcript_chunks
        |
        | pipeline.trigger_report() -> _run_report_generator()
        v
 llm.generate_report(mode="discovery", coverage=..., red_flags=..., questions_used=..., ...)
   1. Pré-montagem determinística (D-27, NOVO):
        - agrupar coverage por lens -> 2 tabelas (Produto / Dados) usando
          DISCOVERY_AREA_SET.by_lens("produto"|"dados").labels()
        - agrupar red_flags por lens -> 2 listas
        - (gap) agrupar questions por lens -> precisa de refactor de assinatura (ver Pitfall 1)
   2. system prompt = esqueleto PRD (16 seções) via novo builder/branch (D-25/D-26)
   3. user message = tabelas pré-montadas + transcrição + contexto estruturado
        |
        v
 INSERT reports (markdown_content, cost_usd, status='Rascunho' se mode=='discovery' senão NULL)
        |
        v
 [FALTA: endpoint/service para transicionar status Rascunho -> Em revisão -> Aprovado]
        |
        v
 POST /pricings/{id}/import-from-diagnosis {session_id}
        |
        v
 LLMPricingService.import_from_diagnosis()
   1. report = repo.get_session_report(session_id)   <- precisa "status" no SELECT (hoje só
                                                          seleciona id, markdown_content, generated_at)
   2. NOVO: gate — se report.status not in (None, "Aprovado") -> 422
   3. extração inalterada (with_structured_output, ExtractedFeatureList) — blocos ampliados (D-32)
   4. bulk_insert_features + update_pricing({"session_id": session_id})  <- já existe
```

### PRD Skeleton (16 seções, 0-15) — extraído de `PRD_modelo_em_branco_CITi.pdf`

Fonte: leitura integral do PDF nesta sessão (22 páginas). Reprodução fiel dos títulos e
subsecões — é a base para o esqueleto Markdown do relatório discovery (D-26). Texto de instrução
azul e blocos "Exemplo" do PDF **não** entram no relatório gerado (são só guia de preenchimento
para quem edita o PRD manualmente depois); o relatório automático usa apenas os títulos/subtítulos
como esqueleto e preenche com o que o pipeline capturou.

```
0. Controle do documento                              [apoio — não preenchível pelo pipeline]
   0.1 Histórico de versões
   0.2 Aprovações (sign-off)
   0.3 Referências
1. Sumário executivo                                   [Produto]
   (Problema / Solução proposta / Valor esperado / Escopo do MVP em uma frase)
2. Contexto & problema                                  [Produto]
   2.1 Contexto de negócio
   2.2 Problema central
   2.3 Situação atual (AS-IS) e dores
   2.4 Insights-chave do discovery (CSD)
3. Objetivos & métricas de sucesso                      [Produto]
   3.1 Objetivos de negócio
   3.2 Métrica North Star
   3.3 KPIs e metas
4. Público & jornadas                                   [Produto]
   4.1 Personas
   4.2 Perfis de acesso (papéis)
   4.3 Jornada TO-BE (fluxo desejado)
5. Escopo (É / Não É)                                   [Produto]
   5.1 No escopo (É)
   5.2 Fora do escopo (Não É)
   5.3 Escopo futuro (backlog / próximos ciclos)
   5.4 Premissas de escopo
6. Requisitos funcionais & user stories                 [Produto]  <- 6.3 = sinal nativo de precificação
   6.1 Visão de épicos
   6.2 Detalhamento dos requisitos (US-000 modelo: história/regras/critérios de aceite Gherkin)
   6.3 Backlog consolidado de user stories (ID | Épico | User story | Prio. | Est. | Depende de)
   6.4 Catálogo de regras de negócio
7. Requisitos de dados                                  [Dados]    <- 7.3 = sinal nativo de precificação
   7.1 Entidades principais (modelo conceitual)
   7.2 Fontes e integrações de dados
   7.3 Volumetria e crescimento (volume inicial / crescimento / retenção)
   7.4 Qualidade de dados
   7.5 Dados pessoais & LGPD
   7.6 Analytics & BI
   7.7 Migração de dados
8. Requisitos não-funcionais                            [parte Dados: LGPD/observabilidade]
   (tabela: Performance | Disponibilidade/SLA | Escalabilidade | Segurança |
    Usabilidade/Acessibilidade | Compatibilidade | Compliance/LGPD | Observabilidade |
    Backup & recuperação)
9. Arquitetura, integrações & restrições técnicas        [parte Dados: arquitetura/integrações]
   9.1 Sistemas e integrações externas
   9.2 Restrições técnicas conhecidas
   9.3 Ambientes
   9.4 Diagrama de contexto
10. Design & protótipos                                 [Produto]
    10.1 Protótipos
    10.2 Design system / identidade
    10.3 Telas principais e mapeamento com requisitos
11. Priorização & faseamento                            [Produto]  <- sinal nativo de precificação
    11.1 Definição do MVP
    11.2 Fases de entrega / releases
    11.3 Critério de priorização utilizado
12. Riscos, premissas, dependências & dúvidas em aberto  [ambos — red flags mapeiam aqui]
    12.1 Riscos
    12.2 Dependências
    12.3 Restrições
    12.4 Dúvidas em aberto (do CSD)
13. Critérios de qualidade: Ready, Done & aceite         [apoio]
    13.1 Definition of Ready / 13.2 Definition of Done
    13.3 Critérios de aceite do MVP / 13.4 Estratégia de testes
14. Glossário                                           [apoio]
15. Anexos & matriz de rastreabilidade                  [apoio]
    15.1 Matriz de rastreabilidade / 15.2 Anexos
```

**Campo Status do PRD** (confirmado nas páginas 1 e 4 do PDF, campo "Status" da tabela de capa e
seção 0.2): valores exatos são **`Rascunho / Em revisão / Aprovado para build`** — batem
literalmente com D-36. Usar estas 3 strings exatas como valores válidos da coluna
`reports.status` (validação em código/Pydantic `Literal`, sem `CHECK`/enum nativo — mesmo padrão de
`mode`/`source`/`project_type` no repo).

**Mapa de origem do discovery → seção do PRD** (página 2 do PDF, tabela "De onde vem o conteúdo"):
síntese de entrevistas → 2 e 4; mapa AS-IS → 2; matriz CSD → 2.4 e 12.4; matriz É/Não É → 5;
personas → 4; protótipos → 10; objetivos/oportunidades → 3 e 11. Como o pipeline atual **não**
produz personas, protótipos, matriz É/Não É nem CSD formal, as seções 4, 5, 10 e partes de 2.4/12.4
ficarão predominantemente `[a preencher no PRD]` — isso é esperado e correto por D-26 (não
auto-gerar o PRD inteiro).

### Recommended Project Structure

Nenhuma pasta nova — o trabalho é 100% dentro de arquivos já existentes:

```
backend/app/
  services/
    llm.py                    # generate_report ganha branch discovery (D-25); prompt PRD skeleton
    discovery_prompt_builder.py  # build_report_generator() REESCRITO para gerar o esqueleto PRD
                                  # (a versão atual, D-10 da Fase 2, é um relatório simplificado —
                                  #  não segue as 16 seções; precisa ser substituída, não estendida)
    session_state.py          # + método(s) de readiness (novo) usando coverage/red_flags/questions
    llm_pricing_service.py    # import_from_diagnosis ganha gate de status; blocos ampliados (D-32)
    coverage_areas.py         # sem mudança de schema — já tem by_lens() pronto (D-19)
  repositories/
    pricing_repository.py     # get_session_report / get_project_reports: adicionar "status" ao select()
  routers/
    sessions.py                # possível novo endpoint PATCH .../report/status (ver Pitfall 2)
    pricings.py                 # sem mudança estrutural — gate fica no service, não no router
supabase/migrations/
  <novo arquivo>_add_status_to_reports.sql   # aditiva, nullable, sem DEFAULT (padrão de lens)
```

### Pattern 1: Pré-montagem híbrida código+LLM por lens (D-27)

**What:** o código particiona deterministicamente `coverage`/`red_flags`/`questions` por `lens`
antes de montar o `user` message; o LLM só escreve a prosa em cima da tabela/lista já pronta —
nunca decide sozinho em que seção um item cai.

**When to use:** montagem do `user` message em `generate_report` quando `mode == "discovery"`.

**Example (baseado no padrão real de `llm.py:121-139`, adaptado para 2 tabelas):**
```python
# Source: adaptado de app/services/llm.py:121-139 (padrão hoje usa SALES_AREA_SET fixo)
from app.services.coverage_areas import DISCOVERY_AREA_SET

def _coverage_table_for_lens(coverage: dict, lens: str) -> str:
    labels = DISCOVERY_AREA_SET.by_lens(lens).labels()
    status_labels = {"covered": "Coberto", "partial": "Parcial", "uncovered": "Não coberto"}
    rows = [
        (labels.get(area, area), status_labels.get(info.get("status", ""), info.get("status", "")),
         info.get("score", 0), info.get("notes", ""))
        for area, info in coverage.items()
        if area in labels  # só áreas desta lente
    ]
    if not rows:
        return "_Nenhuma área classificada ainda._"
    return (
        "| Área | Status | Score | Observações |\n| --- | --- | --- | --- |\n"
        + "\n".join(f"| {l} | {s} | {sc}% | {n} |" for l, s, sc, n in rows)
    )
```

**Nota de implementação:** `coverage` já chega com `lens` embutido por item (ver
`session_state.py::coverage_to_dict`, linhas 156-173, lidas nesta sessão:
`"lens": lens_by_key.get(area)` — quote verbatim), então o filtro por lens pode usar
`info.get("lens") == lens` diretamente no dict recebido, sem precisar reconsultar
`DISCOVERY_AREA_SET`. Ambas as abordagens (filtrar por `area in labels` vs `info["lens"] == lens`)
chegam ao mesmo resultado; a segunda é mais barata (não recalcula `by_lens()` a cada chamada).

### Anti-Patterns to Avoid

- **Usar `SALES_AREA_SET.labels()` no ramo discovery** — é exatamente o bug que D-28 aponta em
  `llm.py:121` hoje (`area_labels = SALES_AREA_SET.labels()` — verbatim lido nesta sessão). Trocar
  por `DISCOVERY_AREA_SET.labels()` (ou `.by_lens(...)`) só dentro do branch `if mode ==
  "discovery"`.
- **Deixar o LLM decidir a lens de um item já classificado** — o registro estático já é autoritário
  (D-19/D-21/D-22); reclassificar via prompt reintroduz inconsistência que a Fase 3 eliminou.
- **Adicionar um segundo flag paralelo a `mode`** — comentário explícito em `pipeline.py:411-413`
  (lido nesta sessão): "NUNCA introduzir um segundo flag paralelo a `mode`." Tudo desta fase deve
  gatear por `mode`, nunca por um novo campo tipo `is_prd` ou `report_type`.
- **Gatear o import olhando `projects.mode`** — mais simples e mais robusto gatear olhando só
  `report.status` (ver Pattern 2 abaixo); evita uma junção extra e funciona mesmo se
  `session_id` for passado num fluxo sales (o que hoje é possível, já que `import_from_diagnosis`
  aceita `session_id` opcional independente de mode).

### Pattern 2: Gate por presença de `status`, não por `mode` (recomendação de implementação para D-37)

**What:** a pré-condição do handoff não precisa saber se a sessão é discovery ou sales — só
precisa olhar se o relatório tem um `status` setado e, se tiver, se é `"Aprovado para build"`.
Como só o branch discovery grava `status` no INSERT (sales nunca escreve essa coluna, ela fica
`NULL` por definição — mesmo padrão de `lens` em `questions`/`red_flags`, D-18/D-22), o gate é
automaticamente um no-op para qualquer relatório sales, sem precisar consultar `projects.mode`.

**When to use:** dentro de `LLMPricingService.import_from_diagnosis`, logo após a linha que hoje
busca o relatório (`llm_pricing_service.py:104`, lido nesta sessão: `report =
self._repo.get_session_report(session_id)`).

**Example:**
```python
# Source: extensão proposta de app/services/llm_pricing_service.py:98-108
if session_id:
    session = self._repo.get_session(session_id)
    if not session or str(session["project_id"]) != project_id:
        raise HTTPException(status_code=404, detail="Sessão não encontrada neste projeto")
    report = self._repo.get_session_report(session_id)  # SELECT precisa incluir "status"
    if report and report.get("status") not in (None, "Aprovado para build"):
        raise HTTPException(
            status_code=422,
            detail="O relatório de discovery precisa estar 'Aprovado para build' antes do import.",
        )
    reports = [report] if report else []
```

**Por que no service, não no router:** o CLAUDE.md exige "sem queries SQL/Supabase em... routers".
Se o gate fosse implementado no router (`pricings.py:207-217`, citado no CONTEXT como "ponto do
gate"), o router precisaria chamar o repositório diretamente para buscar o relatório antes de
delegar ao service — duplicando a consulta que o service já faz internamente e violando a regra de
"router não toca banco". Colocar o gate dentro do service (que já busca o `report`) é mais
SOLID e evita duplicar a query. **Isto é uma leitura minha da regra do projeto, não uma decisão já
tomada — o planner deve confirmar esta escolha de camada antes de implementar** (o texto do
CONTEXT cita a linha do router como "ponto do gate", possivelmente só identificando o endpoint
afetado, não a camada exata).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Particionar áreas/red-flags por lens | Um novo dict/lookup ad-hoc de lens por área | `DISCOVERY_AREA_SET.by_lens(lens)` (já existe, `coverage_areas.py:61-68`) | Já testado (golden tests `test_two_agent_lens.py`); reimplementar quebra a fonte única de verdade |
| Validar valores de `status` | `CHECK`/`ENUM` nativo no Postgres | `Literal["Rascunho", "Em revisão", "Aprovado para build"]` no Pydantic, igual a `mode`/`source`/`project_type` | Migration sem `ALTER TYPE` a cada novo valor — padrão já estabelecido no repo (ver migrations lidas) |
| Calcular custo de tokens do relatório PRD (maior que o sales) | Um novo cálculo de custo do zero | `REPORT_MAX_OUTPUT_TOKENS` (`llm.py:21`) + `tokens_to_usd` já existentes | Já é a fonte única usada por `estimated_report_cost()` (F7); o relatório PRD provavelmente precisa de MAIS tokens de saída que o sales — ver Pitfall 3 |

**Key insight:** quase todo "novo" componente desta fase já tem um análogo pronto na Fase 1-3
(registry, builder-irmão, gate por mode, migration aditiva). O risco real não é "construir algo
novo errado" — é "duplicar/desviar de um padrão que já existe e já foi testado como golden test".

## Common Pitfalls

### Pitfall 1: `questions_used` chega em `generate_report` sem `lens`
**What goes wrong:** `generate_report(questions_used: list[str], ...)` recebe só texto simples
(verbatim de `pipeline.py:439-441`, lido nesta sessão: `questions_used = [q.text for q in
self.state.questions if q.status in ("used", "pinned")]`) — sem `lens`. Se o esqueleto do PRD
precisar separar "perguntas ainda sem resposta" ou similar por Produto/Dados (seção 12.4 do PRD,
"Dúvidas em aberto"), não há como particionar sem mudar a assinatura.
**Why it happens:** o parâmetro foi desenhado para o relatório sales (sem lens) e nunca foi
estendido quando `lens` foi adicionado a `Question` na Fase 3.
**How to avoid:** ou (a) mudar `questions_used` para `list[dict]` com `{"text", "lens"}` (mesmo
padrão já usado para `red_flags_raw` em `pipeline.py:442-450`), ou (b) decidir explicitamente que
a seção 12.4 do PRD discovery não particiona por lens (fica combinada) — **decisão do planner**,
não deve ser assumida silenciosamente.
**Warning signs:** se o prompt do PRD pedir "perguntas por lens" mas o código só mandar uma lista
plana de strings, o LLM vai alucinar a divisão em vez de receber um dado determinístico (viola o
espírito do D-27).

### Pitfall 2: Não existe endpoint para transicionar `reports.status`
**What goes wrong:** sem um endpoint (ou ao menos um método de repositório exposto por rota), a
verificação-semente do REP-02 ("gerar relatório, marcá-lo Aprovado, rodar import") não tem como
"marcar Aprovado" a não ser via UPDATE manual no Supabase — o que não é reprodutível/testável em
CI e quebra a regra de nunca pular a camada de API para mudar estado de negócio.
**Why it happens:** o CONTEXT.md descreve o botão de UI como Fase 5 (D-35), mas não menciona
explicitamente o endpoint backend que o botão vai chamar — só o "campo status" e o "gate".
**How to avoid:** o planner deve incluir, mesmo que minimamente, um endpoint tipo `PATCH
/sessions/{session_id}/report` (ou `/reports/{report_id}`) com body `{"status": "..."}"`, validado
contra o `Literal` de 3 valores, para a Fase 5 só precisar plugar um botão nele. Isto é uma
decisão de escopo que deveria ter sido explícita no CONTEXT — sinalizar como pergunta ao usuário
se o time preferir manter isso 100% em Fase 5 (nesse caso a verificação REP-02 desta fase precisa
usar um caminho alternativo, ex.: update direto de repositório em um teste, não em produção).
**Warning signs:** SC#2 do ROADMAP ("marcar Aprovado, rodar import, provar ≥1 feature") não tem
como ser executado ponta-a-ponta sem esse endpoint.

### Pitfall 3: Teto de tokens de saída do relatório pode ficar pequeno demais para o PRD completo
**What goes wrong:** `REPORT_MAX_OUTPUT_TOKENS = 16384` (`llm.py:21`) é a "fonte única de verdade"
tanto para o `max_output_tokens` da chamada quanto para a estimativa de custo em
`session_state.estimated_report_cost()` (comentário verbatim lido: "mantê-las alinhadas evita
subestimar o custo e cortar a sessão sem saldo"). Um esqueleto de 16 seções (mesmo parcialmente
preenchido) é substancialmente mais longo que o relatório sales atual (7 seções). Se o teto não for
revisto, o relatório pode ser truncado no meio, ou o budget (F7) pode cortar a sessão achando que o
relatório é mais barato do que realmente é.
**Why it happens:** a constante foi calibrada para o formato de relatório sales/discovery-simples
existente, não para 16 seções.
**How to avoid:** medir o tamanho de saída de um relatório PRD de teste e, se necessário, subir
`REPORT_MAX_OUTPUT_TOKENS` só quando `mode == "discovery"` (ou manter uma constante única mas maior
— desde que sales continue recebendo exatamente o texto de hoje, D-25 exige apenas
byte-identidade da SAÍDA sales, não do teto de tokens configurado). **Nota:** truncamento também
pode ser mitigado, sem subir o teto, respeitando o próprio D-26 (só preencher o que o pipeline
capturou) — sessões com pouco insumo geram menos texto de qualquer forma.
**Warning signs:** relatório discovery cortado no meio de uma seção; custo real da sessão maior que
o estimado (budget bar zerando antes do esperado).

### Pitfall 4: `upload_pdf_transcript` (import de PDF) nunca passa `mode` para `generate_report`
**What goes wrong:** o endpoint `POST /{session_id}/transcript/upload` (`sessions.py:469-479`, lido
nesta sessão) chama `llm_service.generate_report(...)` **sem** o parâmetro `mode=` — o default da
função é `mode: str = "sales"` (`llm.py:113`). Se esse endpoint for usado para uma sessão de
projeto em modo discovery (ex.: import de PDF de uma reunião discovery gravada), o relatório gerado
sairá no formato **sales**, não no PRD — inconsistência silenciosa, sem erro.
**Why it happens:** este endpoint foi escrito antes do conceito de `mode` existir e nunca foi
revisitado nas Fases 2-3 (o escopo delas era o pipeline ao vivo, não o upload de PDF).
**How to avoid:** o planner deve decidir explicitamente se este caminho está dentro do escopo da
Fase 4 (corrigir para propagar `mode=project.get("mode")`) ou se é aceitável deixá-lo sales-only
por enquanto — **isto não estava no CONTEXT.md e é uma lacuna real encontrada na leitura do
código**; deve virar pergunta/registro explícito no plano, não uma correção silenciosa nem uma
omissão silenciosa.
**Warning signs:** um discovery com fonte "import" (upload de PDF) gera relatório no formato
sales/simplificado em vez do PRD.

### Pitfall 5: `PricingRepository.get_session_report` / `get_project_reports` não selecionam `status`
**What goes wrong:** os dois métodos (`pricing_repository.py:149-192`, lidos nesta sessão) fazem
`.select("id, markdown_content, generated_at")` — sem `status`. O gate de D-37 não tem como
funcionar sem esse campo vir na consulta.
**Why it happens:** os métodos foram escritos antes da coluna `status` existir.
**How to avoid:** adicionar `"status"` ao `.select(...)` das duas queries junto com a migration —
mudança mecânica, mas fácil de esquecer porque nenhum teste hoje cobre esses `SELECT`s
explicitamente.
**Warning signs:** o gate sempre passa (porque `report.get("status")` sempre retorna `None` mesmo
para relatórios discovery reais) — falha silenciosa, não uma exceção.

## Code Examples

### Migration aditiva — `status` em `reports` (segue o padrão de `lens`, não o de `mode`)

```sql
-- Source: padrão verbatim de supabase/migrations/20260922000000_add_lens_tagging.sql,
-- adaptado para reports.status
-- Aditiva e idempotente (ADD COLUMN IF NOT EXISTS), nullable e SEM DEFAULT:
-- linhas antigas e TODOS os relatórios sales ficam com status NULL, sem backfill manual e
-- sem alterar comportamento existente (D-36, análogo a D-18/D-24 para lens).

ALTER TABLE reports ADD COLUMN IF NOT EXISTS status text;

COMMENT ON COLUMN reports.status IS
    'Status do relatório discovery (igual ao campo Status do PRD): Rascunho | Em revisão | '
    'Aprovado para build. NULL para relatórios sales e linhas antigas — sem backfill. '
    'Validação de valor em código (Pydantic Literal), sem CHECK/enum nativo.';
```

**Por que nullable sem DEFAULT (não como `mode`, que tem `DEFAULT 'sales'`):** `mode` precisa de um
valor para TODA linha (toda sessão tem um modo). `status` só é semanticamente significativo para
discovery — dar um `DEFAULT 'Rascunho'` faria toda linha sales existente (e futura, se algum
código esquecer de omitir o campo) ganhar um valor de status que não faz sentido para ela. O
padrão correto é o de `lens` (`questions.lens`/`red_flags.lens`): nullable, sem default, e o
próprio código discovery é quem escreve o valor explicitamente no INSERT.

### Grant inicial do `status` no INSERT do relatório (gated por mode, sem introduzir segundo flag)

```python
# Source: extensão proposta de app/services/pipeline.py:466-470 (_run_report_generator)
db.table("reports").insert({
    "session_id": self.state.session_id,
    "markdown_content": markdown,
    "cost_usd": str(round(tokens_to_usd(inp, out), 6)),
    **({"status": "Rascunho"} if self.state.mode == "discovery" else {}),
}).execute()
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `DiscoveryPromptBuilder.build_report_generator()` gera um relatório discovery simplificado (6 seções: Cobertura por Área, Gargalo e Frente de Atuação, Fluxo de Processos e Dados, Desenho da Solução, Riscos e Alertas, Perguntas Ainda Sem Resposta) | Precisa ser substituído pelo esqueleto PRD de 16 seções (D-26) | Fase 4 (esta fase) | O método existe e roda hoje (usado desde a Fase 2), mas não atende D-26 — não é um "gap" a preencher, é uma reescrita completa do método |
| `llm.py::generate_report` usa `SALES_AREA_SET.labels()` incondicionalmente (`area_labels = SALES_AREA_SET.labels()`, linha 121) | Precisa ramificar por `mode` (D-28) | Fase 4 (esta fase) | Bug latente hoje: se alguém chamasse `generate_report(mode="discovery")` sem o branch corrigido, as labels mostradas seriam as 8 áreas de sales, não as 18 de discovery |

**Deprecated/outdated:** nenhuma API externa mudou; esta seção reflete apenas o estado interno do
código que a Fase 4 precisa atualizar.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | O gate de status deve ficar na camada de service (`LLMPricingService`), não no router | Architecture Patterns, Pattern 2 | Se o time preferir o router por algum motivo de arquitetura não documentado, o plano precisa ser ajustado — impacto baixo (mudança de poucas linhas) |
| A2 | Faltar um endpoint de transição de `status` é lacuna real, não intencional | Common Pitfalls, Pitfall 2 | Se for intencional (time decidiu fazer só via SQL/Supabase Studio por enquanto), a verificação-semente do REP-02 precisa de um caminho alternativo documentado no plano |
| A3 | Pesos/limiar sugeridos para o readiness score (ver abaixo) são só um ponto de partida razoável, não uma calibração real | Runtime State / Open Questions | Pesos errados fazem o botão da Fase 5 liberar cedo demais ou tarde demais — mitigado por D-34 já prever ajuste pós-sessões reais |
| A4 | `upload_pdf_transcript` deveria propagar `mode`, mas isso é uma correção de escopo que o planner deve confirmar explicitamente com o time, não assumir | Common Pitfalls, Pitfall 4 | Se ficar fora do escopo sem registro, alguém vai descobrir a inconsistência em produção meses depois |
| A5 | `REPORT_MAX_OUTPUT_TOKENS` pode precisar subir para o PRD de 16 seções | Common Pitfalls, Pitfall 3 | Se não for medido, relatório trunca silenciosamente em sessões com muito insumo |

**Nenhuma dessas é uma claim de pacote/versão/API externa — são decisões de design internas ao
código já lido nesta sessão.** Todas nascem de leitura direta do código-fonte (`[VERIFIDO: caminho
e linha]` nos trechos acima) ou do PDF (`[VERIFICADO: PRD_modelo_em_branco_CITi.pdf, páginas
citadas]`); nenhuma claim de biblioteca externa/versão foi feita nesta pesquisa porque a fase não
introduz dependências novas.

## Open Questions

1. **Endpoint de transição de `status` — está no escopo da Fase 4?**
   - What we know: o CONTEXT.md entrega "campo status" e "gate no handoff" ao backend; a UI de
     revisão fica na Fase 5.
   - What's unclear: sem um endpoint, ninguém consegue setar `status='Aprovado para build'` fora do
     banco diretamente — inclusive a verificação-semente da própria Fase 4 (REP-02) depende disso.
   - Recommendation: incluir um endpoint mínimo (`PATCH .../report {status}`) como parte do escopo
     backend desta fase, já que ele é plumbing puro (sem UI), e reportar essa adição como uma
     decisão explícita no plano (não assumir).

2. **`questions_used` sem lens — a seção 12.4 do PRD (Dúvidas em aberto) precisa dividir por lens?**
   - What we know: red_flags e coverage já chegam com lens; questions não.
   - What's unclear: D-27 não menciona explicitamente perguntas na lista de itens agrupados por
     lens (só cita "áreas/red-flags/perguntas" no texto do domínio, mas o mapeamento concreto de
     seção só fala de áreas).
   - Recommendation: tratar como discretionary — se o planner decidir agrupar por lens, estender a
     assinatura de `generate_report` (`questions_used: list[dict]` com lens); se decidir manter
     combinado, documentar a decisão.

3. **Pesos/limiar do readiness score — proposta de default (D-34, discretionary)**
   - What we know: 4 sinais definidos (D-33); todos os dados-fonte já existem em `SessionState`.
   - What's unclear: valores exatos de peso/limiar.
   - Recommendation (default sugerido, calibrável): sinal 1 (min cobertura por lens) peso 0.30;
     sinal 2 (% global das 18 áreas) peso 0.30; sinal 3 (perguntas respondidas / transcrição
     mínima) peso 0.20; sinal 4 (seções-chave do PRD com dado mapeável) peso 0.20; limiar de
     liberação: score ponderado ≥ 0.65. Análogo ao TTL=30s (D-34 explicitamente cita esse
     precedente) — ajustar após sessões reais.

## Environment Availability

Não aplicável — esta fase não depende de nenhuma ferramenta/serviço externo além do que já está
configurado (Supabase, Gemini API key por projeto, LangChain/provider do Precificador). Nenhum
novo binário, runtime ou serviço é introduzido.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest + pytest-asyncio (já em uso, ver `backend/tests/`) |
| Config file | `backend/pytest.ini` ou equivalente (mesmo setup usado pelas Fases 1-3) |
| Quick run command | `cd backend && pytest tests/test_discovery_report.py -x` (arquivo novo sugerido) |
| Full suite command | `cd backend && pytest tests/ -q` |

### Golden test pattern (para REP-03 — regressão sales)

O padrão já estabelecido nas Fases 1-3 (`test_coverage_areas_golden.py`,
`test_discovery_mode.py::test_generate_report_sales_mode_includes_citi_block`) é: capturar o
argumento `system`/`user` passado para `llm._call` via `monkeypatch`, e comparar contra uma string
literal ou fixture congelada ANTES da mudança de produção. Para REP-03, o planner deve:
1. Congelar (fixture) a saída de `generate_report(mode="sales", ...)` com um input fixo, ANTES de
   tocar em `llm.py`.
2. Após a mudança (branch discovery adicionado), rodar o mesmo teste e confirmar que o branch sales
   é byte-idêntico.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REP-01 | Relatório discovery contém as seções Produto+Dados esperadas, marcadas `[a preencher no PRD]` quando sem insumo | unit (golden/snapshot) | `pytest tests/test_discovery_report.py -x` | ❌ Wave 0 |
| REP-02 | Import de sessão discovery aprovada extrai ≥1 feature e vincula `pricings.session_id` | integration (mock LLM) | `pytest tests/test_import_from_diagnosis_gate.py -x` | ❌ Wave 0 |
| REP-03 | `generate_report(mode="sales")` é byte-idêntico ao comportamento pré-fase | unit (golden, mesmo padrão de `test_coverage_areas_golden.py`) | `pytest tests/test_discovery_report.py::test_sales_mode_unchanged -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pytest tests/test_discovery_report.py tests/test_import_from_diagnosis_gate.py -x`
- **Per wave merge:** `pytest tests/ -q`
- **Phase gate:** Full suite green antes de `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `backend/tests/test_discovery_report.py` — cobre REP-01 (esqueleto PRD, duas tabelas por
  lens, `[a preencher no PRD]`) e REP-03 (golden sales)
- [ ] `backend/tests/test_import_from_diagnosis_gate.py` — cobre REP-02 (gate de status +
  extração + `pricings.session_id`)
- [ ] Nenhuma nova fixture de framework necessária — `pytest`/`pytest-asyncio`/`monkeypatch` já
  cobrem tudo que esta fase precisa.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | não | Sem mudança de autenticação nesta fase |
| V3 Session Management | não | Sem mudança de sessão de usuário (não confundir com `sessions` de diagnóstico) |
| V4 Access Control | sim | O gate `status == 'Aprovado para build'` é, em si, um controle de acesso a uma ação de negócio (impedir import de relatório não aprovado) — deve retornar `422`/`403` explícito, nunca falhar silenciosamente |
| V5 Input Validation | sim | Validar `status` recebido em qualquer endpoint novo contra `Literal["Rascunho", "Em revisão", "Aprovado para build"]` no Pydantic — nunca aceitar string livre |
| V6 Cryptography | não | Nenhum segredo novo — chave Gemini/LLM já passa por Supabase Vault (padrão existente, não tocado nesta fase) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Import prematuro de relatório não aprovado (bypass do gate) | Elevation of Privilege / Tampering | Checar `status` sempre no service, nunca confiar em validação só no frontend (a Fase 5 é só UI — o gate real tem que estar no backend, que é exatamente o que D-37 pede) |
| Endpoint de transição de status aceitando valor arbitrário | Tampering | `Literal` no Pydantic (V5) — nunca `str` livre; rejeitar qualquer valor fora das 3 strings exatas do PRD |
| Relatório discovery vazando dados de LGPD sem marcação (seção 7.5) | Information Disclosure | Fora do escopo de mitigação ativa nesta fase (é conteúdo, não uma vulnerabilidade de código) — mas o esqueleto PRD já reserva a seção 7.5 para isso; não omitir a seção mesmo quando vazia |

## Sources

### Primary (HIGH confidence — lidos diretamente nesta sessão)
- `PRD_modelo_em_branco_CITi.pdf` (raiz do repo) — 22 páginas lidas integralmente via Read; base de
  todo o "PRD Skeleton" acima.
- `backend/app/services/llm.py` — `generate_report` (linhas 102-195), `classify_coverage`,
  `generate_questions`, constantes de custo/tokens.
- `backend/app/services/llm_pricing_service.py` — `import_from_diagnosis` (71-179),
  `suggest_features` (185-272).
- `backend/app/services/coverage_areas.py` — `AreaDefinition`, `AreaSet`, `DISCOVERY_AREA_SET`,
  `by_lens()`.
- `backend/app/services/session_state.py` — `SessionState`, `CoverageArea`, `RedFlag`, `Question`,
  `coverage_to_dict()`.
- `backend/app/services/discovery_prompt_builder.py` — builder-irmão completo, incluindo
  `build_report_generator()` atual (a ser reescrito).
- `backend/app/services/pipeline.py` — `_run_report_generator` (434-478), `_run_question_planner`
  (403-432, gate por mode), seleção de builder por mode (693-722).
- `backend/app/repositories/pricing_repository.py` — `get_session_report`, `get_project_reports`,
  `get_session`.
- `backend/app/routers/pricings.py`, `backend/app/routers/sessions.py` — endpoints relevantes.
- `backend/app/models/sessions.py`, `backend/app/models/pricings.py`,
  `backend/app/models/pricing_features.py` — schemas Pydantic (`ReportResponse`, `bloco: str`).
- `supabase/migrations/20260921000000_add_mode_to_projects.sql`,
  `supabase/migrations/20260922000000_add_lens_tagging.sql` — padrão de migration aditiva.
- `backend/tests/test_coverage_areas_golden.py`, `test_discovery_mode.py`,
  `test_two_agent_lens.py` — padrão de golden test / fixtures congeladas.
- `.planning/phases/04-discovery-report-pricing-handoff/04-CONTEXT.md`,
  `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md` (Phase 4 section).

### Secondary / Tertiary
- Nenhuma — esta pesquisa não dependeu de WebSearch/Context7 porque todo o domínio é interno ao
  repositório (nenhuma biblioteca nova, nenhuma API externa nova).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — nenhuma lib nova; stack existente confirmado por leitura direta dos
  imports.
- Architecture: HIGH — todos os seams (mode branch, builder-irmão, registry, import de sessão
  única) foram lidos e citados com número de linha nesta sessão.
- PRD skeleton: HIGH — PDF lido integralmente, títulos/subtítulos reproduzidos verbatim.
- Readiness score (pesos/limiar): LOW/ASSUMED — proposta de default, explicitamente discretionary
  por D-34; precisa validação do time.
- Pitfalls 1, 2, 4: MEDIUM — gaps reais encontrados por leitura de código que não estavam no
  CONTEXT.md; risco de estarem fora do escopo pretendido pelo time (daí a recomendação de tratá-los
  como decisão explícita, não como correção silenciosa).

**Research date:** 2026-09-22
**Valid until:** ~30 dias (código interno estável; não há dependência de API externa com ciclo de
mudança rápido)
