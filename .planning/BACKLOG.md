# Backlog — Agente Diagnóstico

Itens de escopo novo capturados fora do fluxo de uma fase. Promover via
`/gsd-review-backlog` (para o milestone ativo) ou `/gsd-phase` (nova fase no ROADMAP).

---

## B-001 — Remover a chave de API Gemini por projeto (usar chave única do env do backend)

**Capturado:** 2026-09-21 (durante `/gsd-verify-work 02`)
**Origem:** decisão de operação — hoje todo o time usa uma única chave Gemini, já
presente no `.env` do backend. O campo de chave por projeto virou fricção sem uso.

**O que muda (linguagem comum):** hoje, ao criar/editar um projeto, o formulário exige
digitar a chave da API do Gemini, e o sistema guarda uma chave por projeto. A ideia é
tirar esse campo: o sistema passa a usar sempre a mesma chave que já está configurada no
servidor. Ninguém mais digita chave nenhuma.

**Superfícies afetadas (a confirmar no planejamento):**
- Frontend: remover o campo "Chave de API Gemini" de `ProjectFormPage.tsx` e o tipo em
  `frontend/src/lib/api.ts`.
- Backend: `gemini_api_key` nos schemas Pydantic (`ProjectCreate/Update/Response`) —
  tornar opcional/remover; o pipeline/`llm` deve resolver a chave do env
  (`GEMINI_API_KEY`) em vez de por projeto.
- Banco: coluna `projects.gemini_api_key` (Supabase Vault) — decidir entre deprecar
  (deixar de escrever) ou migração de remoção. **DECISÃO EM ABERTO** — mexer em coluna
  existente é irreversível; precisa de aprovação do time.
- Segurança: garantir que a chave do env nunca vaze para o frontend.

**Status:** aberto — a promover para uma fase/requisito próprio.

---

## B-002 — Agente decompõe a solução em sub-soluções no mapeamento

**Capturado:** 2026-09-21 (durante `/gsd-verify-work 02`)
**Escopo confirmado (2026-09-21):** **comportamento do agente** — ao mapear a solução do
cliente, o agente de discovery deve separar a solução grande em soluções menores que,
somadas, formam a maior, e isso aparece no diagnóstico/relatório.

**O que muda (linguagem comum):** em vez de o agente descrever "uma solução" monolítica,
ele passa a quebrar o que foi mapeado em partes menores e entregáveis (sub-soluções/
módulos) que, juntas, compõem a solução completa. O time enxerga o problema decomposto,
não um bloco único.

**Provável destino:** encaixa na **Fase 4 — Discovery Report + Pricing Handoff** (o
documento de discovery é onde essa decomposição naturalmente aparece e alimenta o handoff
de precificação). A confirmar no planejamento da fase — pode virar requisito próprio.

**A definir no planejamento:**
- Qual agente/prompt produz a decomposição (QuestionPlanner? ReportGenerator? novo passo?).
- Estrutura da sub-solução no relatório (nome, escopo, dependências entre elas).
- Como se conecta às métricas de precificação da Fase 4.

**Status:** aberto — a promover para requisito/fase (candidato: Fase 4).

---

## B-003 — Criação de projeto falha por RLS no Supabase (BLOQUEADOR de UAT)

**Capturado:** 2026-09-21 (durante `/gsd-verify-work 02`, Teste 2)
**Severidade:** blocker (impede criar qualquer projeto → trava a UAT da Fase 2 e o uso normal)
**NÃO é defeito da Fase 2:** a migration `20260921000000_add_mode_to_projects.sql` é puramente
aditiva (`ADD COLUMN IF NOT EXISTS mode ...`); nenhuma migration define RLS/policy em `projects`.

**Sintoma:** `POST /projects` retorna HTTP 500 ("Internal server error"). `GET /projects/`
funciona (200).

**Erro raiz reproduzido:**
`postgrest APIError 42501: new row violates row-level security policy for table "projects"`.

**Diagnóstico:**
- O RLS está **ligado** na tabela `projects` (bloqueia INSERT), mas **nenhuma migration** cria
  policy nem habilita RLS — logo foi ligado **fora das migrations** (painel do Supabase / default).
- O schema foi desenhado para o backend usar a chave **service_role** (que ignora RLS): ver
  comentários e `GRANT EXECUTE ... TO service_role` em `20260524000000_initial_schema.sql`.
- A credencial atual do backend (`SUPABASE_KEY` em `backend/.env`) **não está furando o RLS** no
  INSERT — ou não é a `service_role`, ou o RLS foi forçado/tem policy restritiva no painel.

**Correção (a decidir pelo time — DECISÃO EM ABERTO):**
1. **Recomendado:** garantir que `SUPABASE_KEY` no `backend/.env` seja a chave **service_role**
   (Supabase → Project Settings → API → `service_role`), que é o design assumido pelo schema.
2. OU criar policies de RLS de INSERT/UPDATE/DELETE explícitas para o papel usado (mais trabalho;
   contraria o design atual baseado em service_role).
3. OU, se for backend confiável single-tenant, revisar por que o RLS foi ligado no painel.

**Como verificar no SQL Editor do Supabase:**
```sql
select relrowsecurity, relforcerowsecurity from pg_class where relname = 'projects';
select * from pg_policies where tablename = 'projects';
```

**Status:** ✅ RESOLVIDO (2026-09-21) — `SUPABASE_KEY` ajustada para a chave `service_role` + restart do backend. Criação de projeto voltou a funcionar (config de ambiente; não exigiu mudança de código).

---

## B-004 — Robustez do create_project: vault órfão em falha + colisão de nome por cliente

**Capturado:** 2026-09-21 (descoberto ao diagnosticar B-003)
**Severidade:** major (pré-existente, não é da Fase 2) — dois bugs em
`backend/app/routers/projects.py`:

1. **Sem rollback do Vault quando o INSERT falha.** `create_project` chama `_vault_store` (grava o
   segredo no Vault) **antes** do `insert` na tabela. Se o insert falhar (como no B-003), o segredo
   fica **órfão** no Vault — acumula lixo a cada tentativa. (Foi o que gerou o resíduo
   `gemini-__uat_probe__` durante o diagnóstico — precisa de limpeza manual no SQL editor.)
2. **Nome do segredo por cliente colide.** O nome do segredo é `f"gemini-{payload.client}"`. Dois
   projetos com o **mesmo cliente** → `duplicate key value violates unique constraint
   "secrets_name_idx"` → HTTP 500 na criação do segundo. Deveria usar um nome único (ex.: incluir o
   `id`/uuid do projeto, como o `update_project` já faz com `gemini-{project_id}`).

**Correção sugerida (a planejar):** envolver a criação em try/except com rollback do segredo em caso
de falha do insert (ou inserir a linha primeiro e só então gravar o Vault), e usar um nome de
segredo único por projeto. **Nota:** o B-001 (remover a chave Gemini por projeto) pode tornar boa
parte disso obsoleto — avaliar B-001 e B-004 juntos.

**Limpeza pendente:** apagar o segredo dummy `gemini-__uat_probe__` no Vault (SQL editor) —
resíduo inofensivo da sonda de diagnóstico.

**Status:** aberto — candidato a fix junto de B-001.

---

## B-005 — Modelo Gemini hardcoded descontinuado (`gemini-2.5-flash` → 404) [BLOQUEADOR de uso]

**Capturado:** 2026-09-21 (durante `/gsd-verify-work 02`, ao tentar o Teste 3)
**Severidade:** blocker (todas as chamadas LLM falham: relatório, perguntas e classificação de
cobertura). **NÃO é defeito da Fase 2** — é drift de tempo (Google descontinuou o modelo).

**Sintoma:** na sessão ao vivo, não gera relatório, não gera perguntas, e as 18 áreas de cobertura
aparecem mas nunca "acendem" (a classificação nunca roda).

**Erro raiz reproduzido:**
`ClientError 404 NOT_FOUND: This model models/gemini-2.5-flash is no longer available to new users.
Please update your code to use models/gemini-3.6-flash`.
A chave Gemini do projeto **é válida** (autenticou); o problema é só o nome do modelo.

**Prova (mesma chave):** `gemini-2.5-flash` → 404; `gemini-3.6-flash` → OK; `gemini-flash-latest`
→ OK.

**Correção:** trocar o modelo em **dois** pontos:
- `backend/app/services/llm.py:10` — `MODEL = "gemini-2.5-flash"`
- `backend/app/services/structured_context.py:20` — `_MODEL = "gemini-2.5-flash"`
(DECISÃO EM ABERTO: modelo pinado `gemini-3.6-flash` vs alias rolling `gemini-flash-latest`.)
Após editar, **reiniciar o backend**.

**Obs:** a Seção 7 do CLAUDE.md (tabela de preços de budget) cita Gemini 1.5/2.0 — desatualizada;
revisar os preços de referência ao fixar o novo modelo (o controle de budget usa esses fatores).

**Status:** ✅ RESOLVIDO (2026-09-21) — commit `21fb4e7`: modelo trocado para `gemini-flash-latest` em `llm.py` e `structured_context.py`. Relatório/perguntas/cobertura voltaram a funcionar.

---

## B-006 — "Reconectando..." ao encerrar sessão (WS não navega para o histórico)

**Capturado:** 2026-09-21 (durante `/gsd-verify-work 02`)
**Severidade:** minor/major (a investigar) — ao clicar em encerrar, o indicador "ao vivo" vira
"reconectando..." e não conclui de forma limpa.

**Hipótese:** o fluxo de finish fecha o WebSocket; o frontend (`useSessionWS`) tenta reconectar, mas
a sessão já está `finished` → `get_or_create` retorna `None` → o backend fecha com 4004 → o front
fica preso em "reconectando" em vez de navegar para o histórico. A confirmar no `useSessionWS`
(lógica de reconexão) + `SessionActivePage` (navegação pós-finish).

**Status:** ✅ RESOLVIDO (2026-09-21) — commit `be2741e`: `handleFinish` passa a encerrar só via REST (removida a corrida WS+HTTP). Encerrar confirmado funcionando pelo humano.

---

## B-007 — `pipeline.py` chama Supabase direto no service (viola camada de repositories)

**Capturado:** 2026-09-22 (durante `/gsd-code-review 03`, achado WR-03)
**Severidade:** major (dívida arquitetural) — **NÃO é defeito da Fase 3.** Pré-existente; o code
review da Fase 3 o encontrou mas decidiu **não** corrigir junto das correções pontuais (WR-01/02/04),
porque misturar refator grande com fix crítico viola a regra de conduta do CLAUDE.md.

**O que muda (linguagem comum):** o `CLAUDE.md` manda que quem fala com o banco seja a camada de
`repositories/`, e que os `services/` só orquestrem lógica de negócio. Hoje o `pipeline.py` (um
service) chama o Supabase diretamente, misturando as duas responsabilidades — o que dificulta testar
e manter. A ideia é extrair esse acesso a banco para um repository dedicado.

**Superfície afetada:** `backend/app/services/pipeline.py` (~743 linhas — o acesso a banco está
espalhado por praticamente todo o arquivo). Provável criação de um `repositories/session_repo.py` (ou
similar) e reescrita das chamadas do pipeline para passar por ele.

**Riscos:** é refator amplo num arquivo central do fluxo realtime (sessão ao vivo, perguntas, red
flags, relatório). Alto risco de regressão — exige commits atômicos, testes antes/depois e validação
ponta a ponta numa sessão real.

**A definir no planejamento:** desenhar a interface do repository, migrar por partes (leitura →
escrita), e garantir que o modo sales continue byte-idêntico.

**Status:** aberto — refator próprio, a promover para fase/requisito (não misturar com feature nova).
