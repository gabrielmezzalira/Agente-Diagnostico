---
phase: 03-two-agent-questions-lens-tagging
reviewed: 2026-09-22T11:32:07Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - .gitignore
  - backend/app/models/questions.py
  - backend/app/services/coverage_areas.py
  - backend/app/services/discovery_prompt_builder.py
  - backend/app/services/pipeline.py
  - backend/app/services/session_state.py
  - backend/tests/test_discovery_mode.py
  - backend/tests/test_two_agent_lens.py
  - supabase/migrations/20260922000000_add_lens_tagging.sql
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-09-22T11:32:07Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Revisei os 9 arquivos da Fase 3 (Two-Agent Questions + Lens Tagging): o registro de áreas com o novo campo `lens` (`coverage_areas.py`), o `DiscoveryPromptBuilder` com o planner separado por lente, o `SessionPipeline`/`SessionState` com o novo agente de Dados rodando em gatilhos pares, a migração aditiva de banco e as duas suítes de teste. Roda os testes das duas suítes (`test_discovery_mode.py` + `test_two_agent_lens.py`) — as 37 asserções passam, e a lógica central (cadência par/ímpar do agente de Dados, allowlist de `lens` nos red flags, escopo do enum de `block` por lente) está corretamente implementada e coberta.

Não encontrei vulnerabilidades de segurança nem bugs que quebrem o fluxo principal — não há SQL/command injection (o cliente Supabase parametriza as chamadas), não há segredos hardcoded, e a allowlist fechada de `lens` (D-22) impede que o LLM injete valores arbitrários no banco. Por isso, **critical: 0**.

Encontrei, no entanto, quatro problemas de robustez/manutenibilidade (WARNING) que valem correção antes de considerar a fase totalmente fechada — o mais importante é que o campo `lens`, escrito corretamente no banco, **não é lido de volta** quando o estado da sessão é reconstruído a partir do Supabase (`_send_initial_state`), o que causa perda silenciosa da etiqueta produto/dados em qualquer cenário de reload (reinício do backend, redeploy) durante uma sessão discovery ativa. Também sinalizo, por exigência explícita do CLAUDE.md, que `pipeline.py` mistura responsabilidades de serviço e de repositório (chamadas diretas ao Supabase dentro do service, sem a camada `repositories/` que já existe no projeto para o Precificador) e que o arquivo, com 743 linhas, está bem acima do limite de 200 linhas sinalizado como "cheiro de código".

## Warnings

### WR-01: `lens` não é restaurado ao recarregar o estado da sessão do banco

**File:** `backend/app/services/pipeline.py:511-518` e `backend/app/services/pipeline.py:530-538`
**Issue:** `_send_initial_state()` é o caminho que reconstrói `SessionState.red_flags` e `SessionState.questions` a partir do Supabase (usado sempre que `PipelineManager.get_or_create` não encontra o pipeline em memória — por exemplo depois de um restart/redeploy do backend com uma sessão discovery ainda `active`, ou ao gerar relatório de uma sessão já encerrada via `load_state_only()`). A Fase 3 adicionou a coluna `lens` e passou a gravá-la corretamente no `insert()` de `questions` e `red_flags` (`pipeline.py:294`, `:388`), mas o `SELECT`/reconstrução de objetos em `_send_initial_state` não foi atualizado: os construtores `RedFlag(...)` e `Question(...)` não passam `lens=f.get("lens")` / `lens=q.get("lens")`. Como o dataclass tem `lens: "str | None" = None` como default, todo `RedFlag`/`Question` recarregado do banco perde silenciosamente sua etiqueta produto/dados em memória — mesmo que o valor correto continue no Supabase. Isso quebra a consistência de qualquer consumidor que leia `state.questions`/`state.red_flags` após um reload (ex.: resposta HTTP da sessão, nova rodada de dedup por lente).
**Fix:**
```python
# pipeline.py:511-518
for f in flags.data:
    self.state.red_flags.append(RedFlag(
        id=f["id"],
        text=f["text"],
        severity=f.get("severity", "warning"),
        evidence=f.get("evidence", ""),
        detected_at=f.get("detected_at", ""),
        lens=f.get("lens"),
    ))

# pipeline.py:530-538
self.state.questions.append(Question(
    id=q["id"],
    text=q["text"],
    block=q.get("block", "negocio"),
    source=q.get("source", "auto"),
    status=q["status"],
    generated_at=q.get("generated_at", ""),
    expires_at=q.get("expires_at", ""),
    lens=q.get("lens"),
))
```

### WR-02: trava de dedup normalizado (D-17) bloqueia para sempre perguntas que só expiraram por TTL

**File:** `backend/app/services/pipeline.py:353-357` (definição de `existing_normalized`) e `:363-367` (uso no laço)
**Issue:** `existing_normalized` é construído a partir de **todo** `self.state.questions`, independente do `status` — isso inclui perguntas em `dismissed`. O problema é que `_expire_due_questions` (linha ~171) também marca como `dismissed` qualquer pergunta cujo TTL expirou sem interação do usuário — ou seja, "o comercial não teve tempo de ler" fica indistinguível de "o comercial rejeitou explicitamente". Com o dedup normalizado do D-17, uma pergunta relevante que simplesmente expirou (TTL de 30s por padrão) fica banida para o resto da sessão inteira — nem o agente de Produto nem o de Dados conseguem voltar a perguntar sobre aquele tópico com uma frase equivalente, mesmo que a área continue sem cobertura. Isso reduz a qualidade do discovery ao longo de sessões longas sem que o usuário tenha tomado nenhuma decisão sobre aquele conteúdo.
**Fix:** Restringir o conjunto de dedup a status que representam decisão real do usuário (ou pergunta ainda viva), excluindo `dismissed`-por-TTL — ou marcar a expiração com um status distinto de "dismissed manual" (ex.: `expired`) e excluir `expired` do `existing_normalized`:
```python
existing_normalized = (
    {
        _normalize_question_text(q.text)
        for q in self.state.questions
        if q.status != "dismissed"  # ou == "expired", se status for diferenciado
    }
    if lens is not None
    else None
)
```

### WR-03: `pipeline.py` executa queries Supabase diretamente no service — viola a regra de arquitetura do CLAUDE.md

**File:** `backend/app/services/pipeline.py` (múltiplos pontos, ex.: linhas 236-244, 288-295, 380-389, 619-627)
**Issue:** O CLAUDE.md do projeto é explícito e não-negociável: *"Sem queries SQL/Supabase em services. Services chamam repositories; repositories chamam o banco."* `pipeline.py` (743 linhas — bem acima do limite de 200 linhas citado como "cheiro de código") chama `db.table(...).insert()/update()/select()` diretamente dentro de `SessionPipeline` e `PipelineManager` em praticamente todo método relevante (`_run_coverage_classifier`, `_run_red_flag_detector`, `_run_single_planner`, `_send_initial_state`, `_run_report_generator`, `get_or_create`). O repositório já existe como padrão no projeto (`backend/app/repositories/pricing_repository.py`, usado pelo Precificador), mas nunca foi aplicado ao pipeline do Agente Diagnóstico — cada função nova desta fase (persistência de `lens` em `questions`/`red_flags`) repete o mesmo padrão de acesso direto ao banco em vez de passar por uma camada de repositório.
**Fix:** Extrair um `SessionRepository`/`QuestionRepository`/`RedFlagRepository` em `backend/app/repositories/` com métodos como `insert_question(...)`, `insert_red_flag(...)`, `load_session_state(...)`, e injetar essa dependência em `SessionPipeline`. Esse é um refator de escopo maior — registrar como item de débito técnico a ser planejado separadamente (não misturar com a correção de bugs pontuais acima), conforme a própria regra de conduta do CLAUDE.md de não misturar correção com refator no mesmo commit.

### WR-04: a lente do red flag não chega ao relatório final — tagging incompleto ponta a ponta

**File:** `backend/app/services/pipeline.py:433-436` e `backend/app/services/discovery_prompt_builder.py:247-273`
**Issue:** `_run_report_generator` monta `red_flags_raw` sem o campo `lens`:
```python
red_flags_raw = [
    {"text": rf.text, "severity": rf.severity, "evidence": rf.evidence}
    for rf in self.state.red_flags
]
```
E o prompt do `ReportGenerator` em `DiscoveryPromptBuilder.build_report_generator()` também não menciona `lens` nem instrui a separar riscos de Produto/Dados na seção "## Riscos e Alertas". Ou seja, a etiquetagem por lente introduzida nesta fase (D-22) é persistida no banco e exibida via WebSocket (`red_flag` event), mas se perde antes de chegar ao relatório final — a funcionalidade "Lens Tagging" do título da fase fica incompleta numa das quatro superfícies que a Fase 2/3 tenta cobrir de forma consistente (o teste `test_disc03_citi_portfolio_absent_from_all_four_discovery_surfaces` em `test_discovery_mode.py` já rastreia as "4 superfícies" para o gate do portfólio CITi — vale considerar o mesmo tipo de rede de proteção para `lens`).
**Fix:** Incluir `lens` no dict de `red_flags_raw` e, opcionalmente, instruir o `ReportGenerator` a agrupar riscos por lente na seção de alertas:
```python
red_flags_raw = [
    {"text": rf.text, "severity": rf.severity, "evidence": rf.evidence, "lens": rf.lens}
    for rf in self.state.red_flags
]
```

## Info

### IN-01: `DiscoveryPromptBuilder.build_question_planner(lens)` não valida o parâmetro `lens`

**File:** `backend/app/services/discovery_prompt_builder.py:167-218`
**Issue:** O método faz `if lens == "produto": ... else: # lens == "dados"` sem validar a entrada. Se `lens` receber qualquer valor diferente de `"produto"`, cai no ramo `else` como se fosse `"dados"`, mas `scoped = DISCOVERY_AREA_SET.by_lens(lens)` (linha 168) devolve um `AreaSet` vazio para um valor desconhecido — o prompt gerado teria o enquadramento "QuestionPlanner de DADOS" com `"block":""` no contrato JSON (`block_enum()` de um conjunto vazio é string vazia). Hoje isso nunca ocorre porque os dois únicos call sites (`pipeline.py:412` e `:416`) usam sempre os literais `"produto"`/`"dados"` — mas o método é público na classe e não tem nenhuma guarda, então uma extensão futura (novo call site, typo) falha silenciosamente em vez de dar erro explícito.
**Fix:** Validar contra uma allowlist explícita no início do método, no mesmo espírito do D-22 usado para o red flag:
```python
def build_question_planner(self, lens: str) -> str:
    if lens not in ("produto", "dados"):
        raise ValueError(f"lens inválida: {lens!r} — esperado 'produto' ou 'dados'")
    scoped = DISCOVERY_AREA_SET.by_lens(lens)
    ...
```

### IN-02: `discovery_prompt_builder.py` com 288 linhas, acima do limite de 200 linhas do CLAUDE.md

**File:** `backend/app/services/discovery_prompt_builder.py`
**Issue:** O arquivo já passava de 200 linhas antes desta fase e cresceu mais com o split do `question_planner` por lente. Não é uma responsabilidade múltipla no sentido arquitetural (é uma classe coesa de geração de prompts), mas o CLAUDE.md trata o tamanho como sinal de alerta explícito ("Se um arquivo está ficando grande (>200 linhas), é sinal de que está fazendo coisas demais").
**Fix:** Se o arquivo continuar crescendo em fases futuras, considerar extrair cada `build_*` para uma função de módulo separada (ex.: `discovery_prompts/coverage_classifier.py`, `.../question_planner.py`) e manter `DiscoveryPromptBuilder` como uma fachada fina que delega a elas.

---

_Reviewed: 2026-09-22T11:32:07Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
