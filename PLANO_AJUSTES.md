# Plano de Ajustes e Pendências — Agente Diagnóstico

> Documento de planejamento do ciclo de correções na branch `feat/ajustes_pendencias`.
> Fica na raiz, ao lado do `CLAUDE.md` (o SDD), para máxima descoberta e revisão no PR.

---

## Contexto — por que este plano existe

Uma varredura completa do repositório revelou que, apesar do nome único, convivem aqui **dois produtos
(Diagnóstico + Precificador) e três clientes** (frontend web, extensão Chrome, servidor MCP). A v2 web
**reescreveu** a v1, não a migrou — deixando `diagnostico/` (~3000 linhas) órfã.

O sistema funciona, mas tem **um vazamento de credencial ativo, ausência total de autenticação, e um
vazamento de custo de LLM** que só não estoura porque roda em instância única. Este plano ataca esses
riscos na ordem de prioridade validada abaixo, mais duas correções de bug e uma dívida de arquitetura.

**Resultado pretendido:** fechar os buracos de segurança e custo sem quebrar a extensão, o MCP nem o
webhook do Recall; deixar o código alinhado às regras SOLID do próprio `CLAUDE.md`.

---

## Validação da ordem de prioridade

A ordem original foi checada item a item. Veredito: **essencialmente correta**, com dois refinamentos.

| # | Tarefa | Necessária? | Ordem correta? | Observação |
|---|--------|:---:|:---:|-----------|
| 1 | Rotacionar chave Supabase + limpar `mcp_precificador.py` | ✅ Sim | ✅ Primeiro | Credencial vazada ativa. Zero dependência de código. |
| 2 | Autenticação + restringir CORS | ✅ Sim | ✅ Segundo (risco) | **DECISÃO EM ABERTO** (estratégia). A parte de CORS pode adiantar. |
| 3 | `stop_session()` no `finish` REST | ✅ Sim | ⬆️ **Subir p/ dia 0** | 1 linha, isolada, para queima de budget. Fazer junto da Task 1. |
| 4 | Persistir expiração de perguntas + custo de relatório | ✅ Sim | ✅ Ok | São **dois** bugs distintos → dividir em 4a e 4b. |
| 5 | Decidir sobre `diagnostico/` | ⚠️ Higiene | ✅ Baixa urgência | **DECISÃO EM ABERTO** — não mexer agora. |
| 6 | Quebrar `SessionActivePage.tsx` + upload de PDF | ✅ Sim (SOLID) | ✅ Último | Maior esforço, menor urgência. |

**Ordem de execução recomendada:** `1 → 3 → 2-CORS → 4a → 4b → 2-Auth (quando decidido) → 6`.
Task 5 fica como TODO aberto.

---

## 📊 Status de execução

_Atualizado em 2026-09-14 · branch `feat/ajustes_pendencias`._

Legenda: ✅ concluído · 🟡 parcial (falta ação externa) · ⏸️ em aberto (aguarda decisão) · ⬜ não iniciado.

| # | Tarefa | Status | O que foi feito | O que ainda falta |
|---|--------|:---:|-----------------------------|-------------------|
| 1 | Chave Supabase + `mcp_precificador.py` | 🟡 | Chave `service_role` removida da docstring → placeholder; confirmado que o código lê de `os.environ`; verificado que o token secreto não está em mais nenhum arquivo. | **AÇÃO EXTERNA:** rotacionar a chave no painel do Supabase e propagar a nova para Railway/MCP/`.env`. Enquanto não rotacionar, a chave antiga segue válida no histórico do git. |
| 3 | `stop_session()` no `finish` REST | ✅ | `finish_session` chama `pipeline_manager.stop_session()` (try/except + log). **+ 5 testes** (idempotência, chamada no finish, falha não quebra resposta, 409 em não-ativa). | — |
| 4a | Persistir expiração de perguntas | ✅ | Lógica extraída p/ `_expire_due_questions()` (testável); persiste `dismissed` em lote só sobre `queued`. **+ 4 testes** (expira só vencidas/queued, persistência em lote, sem escrita quando nada vence, falha de DB não levanta). | — |
| 4b | Estimativa de custo do relatório | ✅ | Constante única `REPORT_MAX_OUTPUT_TOKENS` (16384) usada no `generate_report` **e** na estimativa; margem de 20% (F7). **+ 3 testes**. Validado: corrigia subestimação de 2,3×–6,8×. | Revalidar preços do Gemini periodicamente. |
| 2 | Autenticação + CORS | ⏸️ | — | **DECISÃO EM ABERTO** (estratégia de auth). CORS pode adiantar quando a URL do frontend for definida via env. |
| 5 | `diagnostico/` (v1 CLI) | ✅ | **Decisão: documentar como legado (opção a).** Review de código confirmou que `diagnostico/` **não** está ligada à extensão nem à web v2. Banner "MODO CLI LEGADO" no topo de `diagnostico/README.md` + nova seção 10 "Modo CLI legado (v1)" no `CLAUDE.md` (com regras de não-confusão v1×v2) + nota na Seção 9 de que a migração não ocorreu. | — |
| 6 | Refatorar `SessionActivePage.tsx` + upload PDF | ⬜ | — | Refator SOLID incremental; unificar caminhos de geração de relatório. |

**Resumo:** 3 tasks de código concluídas (3, 4a, 4b) **com 12 testes passando**, + limpeza de código da
Task 1. Pendências: rotação externa da chave (Task 1), decisões de auth (Task 2) e `diagnostico/`
(Task 5), e o refator (Task 6).

**Arquivos alterados / criados nesta rodada:**
- `mcp_precificador.py` — placeholder no lugar da chave.
- `backend/app/routers/sessions.py` — `stop_session` no finish.
- `backend/app/services/pipeline.py` — expiração persistida + método `_expire_due_questions` + logger.
- `backend/app/services/session_state.py` — estimativa realista + margem.
- `backend/app/services/llm.py` — constante `REPORT_MAX_OUTPUT_TOKENS`.
- `backend/requirements.txt` — adicionado `pytest-asyncio` (lacuna: `pytest.ini` usa `asyncio_mode=auto`).
- **Novos:** `backend/tests/test_report_cost.py`, `test_expire_questions.py`, `test_finish_stops_pipeline.py`.

> Rodar os testes: `cd backend && python -m pytest tests/test_report_cost.py tests/test_expire_questions.py tests/test_finish_stops_pipeline.py -v` → **12 passed**.
> (Os testes antigos `test_projects.py`/`test_schema.py` seguem como stubs/integração e exigem Supabase real — fora do escopo desta rodada.)

---

## Task 1 — Rotacionar chave Supabase + limpar `mcp_precificador.py` 🔴 CRÍTICO · 🟡 PARCIAL (código feito, rotação externa pendente)

**O que o sistema faz hoje:** `mcp_precificador.py:24` traz, dentro da docstring de setup, a chave
`service_role` real do Supabase em texto puro. Essa chave **ignora RLS por completo** — acesso total ao
banco. Está no repositório e no histórico do git. O `.gitignore` não protege (não é um `.env`).

**O que muda e por quê:** a chave precisa ser **rotacionada** (invalidada e regerada) porque, uma vez
commitada, deve ser tratada como comprometida — reescrever histórico não desfaz um vazamento. Depois, a
docstring passa a usar um placeholder.

**Arquivos modificados:**
- `mcp_precificador.py` — trocar a chave real (linhas 23-26) por `"<SUA_SERVICE_ROLE_KEY>"` + nota de que
  vem do painel do Supabase; garantir que a chave é lida de `os.environ`, nunca hardcoded.

**Arquivos/sistemas afetados:**
- Painel Supabase (fora do repo): **rotacionar** a service_role key.
- Toda config que usa a chave: `claude_desktop_config.json` de cada dev (MCP), variáveis de ambiente do
  Railway (backend), qualquer `.env` local. Todas precisam receber a nova chave após a rotação.

**Pontos de atenção:**
- Rotacionar **quebra** temporariamente o MCP e o backend até a nova chave ser propagada a todos os
  ambientes. Comunicar o time antes.
- Confirmar que nenhum outro arquivo versionou a chave: buscar por `service_role`, `eyJhbGci` e o ref
  `fzvwtkipzxdnubprvfct` em todo o repo antes de fechar a task.

**Plano de ação em caso de erro:**
- Se o backend/MCP parar após a rotação → a nova chave não chegou naquele ambiente; atualizar a env var e
  reiniciar. Manter a chave antiga anotada em local seguro (fora do git) só até confirmar que tudo subiu
  com a nova, então descartá-la.

**Prevenção de erros futuros:**
- Adicionar `*.env` e segredos ao fluxo; considerar um hook/secret-scanner (ex.: `gitleaks`) no
  pre-commit para barrar chaves antes do commit.

---

## Task 3 — `stop_session()` no endpoint REST `finish` 🔴 barato, alto valor · ✅ FEITO

> Executada no **dia 0** junto da Task 1: é 1 linha, isolada, e estanca queima de budget.

**O que o sistema faz hoje:** encerrar a sessão dispara **dois** caminhos no frontend
(`SessionActivePage.tsx:626-627`): o evento WS `finish_session` **e** o `POST /sessions/:id/finish`.
Só o handler WS (`ws.py:78`) chama `pipeline_manager.stop_session()`. O REST
(`routers/sessions.py:226-254`) apenas marca `status='finished'` no banco e para o bot do Recall — **não
para o pipeline**. Se a mensagem WS não chegar (aba fechada, conexão caída, outro cliente encerrando), as
tasks `_coverage_task` (30s) e `_red_flag_task` (15s) continuam chamando o Gemini **indefinidamente**
sobre uma reunião já encerrada, gastando budget até o processo reiniciar.

**O que muda e por quê:** tornar o REST `finish` a fonte de verdade também para parar o pipeline
(defense-in-depth), de modo que **qualquer** caminho de encerramento estanque o consumo de LLM.

**Arquivos modificados:**
- `backend/app/routers/sessions.py` — em `finish_session` (após marcar `finished`), chamar
  `await pipeline_manager.stop_session(str(session_id))`. Importar `pipeline_manager` como já é feito
  em `generate_session_questions` (import local, `sessions.py:289`).

**Arquivos/sistemas afetados:** nenhum — `stop_session` (`pipeline.py:617`) já é idempotente
(`self._pipelines.pop(session_id, None)`); chamar duas vezes (WS + REST) é seguro.

**Pontos de atenção:**
- Manter a ordem: parar bot Recall + tunnel → atualizar status → `stop_session`.
- `stop_session` sobre sessão sem pipeline em memória é no-op (retorna cedo). Sem risco.

**Plano de ação em caso de erro:** se `stop()` lançar, envolver em try/except com log (não deixar a
falha do stop impedir a resposta de `finish`). O status no banco já terá sido gravado.

**Prevenção:** teste de integração que encerra via REST e verifica que `pipeline_manager._pipelines`
não contém mais o `session_id`.

---

## Task 2 — Autenticação + CORS 🔴 CRÍTICO · ⏸️ DECISÃO EM ABERTO

**O que o sistema faz hoje:** **zero** autenticação em todo o backend — nenhum `Depends` de auth em
nenhum router. `main.py:48` usa `allow_origins=["*"]` com `allow_credentials=False`. A URL do Railway é
pública. Qualquer um com ela: lista projetos/clientes, lê transcrições e relatórios, apaga precificações
e **injeta transcrição falsa** em qualquer sessão via `POST /webhook/extension` (basta o `session_id`).
Combinado com a chave da Task 1, dá acesso direto ao banco.

**Status:** a **estratégia de auth fica em aberto** por decisão do time. Este plano documenta as opções e
o trabalho de adaptação, para decidir depois. **A parte de CORS pode ser adiantada** com baixo risco.

### 2-CORS (pode adiantar)
- `main.py:46-52` — trocar `allow_origins=["*"]` por lista explícita (URL do frontend em produção +
  `http://localhost:5173` do Vite em dev), lida de env var.
- **Atenção:** a extensão Chrome faz `POST /webhook/extension` de origem `chrome-extension://…`;
  requisições de extensão normalmente não são bloqueadas por CORS de navegador, mas **validar** que a
  extensão continua enviando após a mudança. O webhook do Recall é server-to-server (não passa por CORS).

### 2-Auth (aguardando decisão) — opções mapeadas
| Opção | Esforço | Pontos a adaptar |
|-------|:---:|-----------------|
| **Token compartilhado no header** | Baixo (horas) | `Depends(require_token)` nos routers; extensão guarda token nas settings e envia no header; frontend adiciona no `api.ts` e no WS; Recall usa **segredo por-sessão na URL** (`/webhook/recall?s=…`) pois não envia headers custom. |
| **Supabase Auth (JWT + RLS)** | Alto (dias) | Login no frontend; verificação de JWT no backend; `POLICY` RLS por tabela em migration; reescrita do acesso a dados. |
| **Só CORS** | Mínimo | Não resolve — endpoints seguem públicos p/ quem tem a URL. |

**Pontos de atenção (qualquer opção):** não quebrar os **três clientes** — frontend, extensão Chrome e
webhook Recall (server-to-server, não manda header facilmente → precisa de segredo na URL/payload). O MCP
fala direto com o banco, então depende da Task 1, não desta.

**Quando a decisão sair:** reabrir esta seção e detalhar a implementação escolhida antes de codar.

---

## Task 4a — Persistir expiração de perguntas 🟠 bug de correção · ✅ FEITO

**O que o sistema faz hoje:** `_expire_task` (`pipeline.py:142-160`) roda a cada 1s, marca perguntas
vencidas como `dismissed` **apenas em memória** e faz broadcast `question_expired`. O banco continua com
`status='queued'`. Ao recarregar a sessão, perguntas vencidas **ressuscitam** na fila.

**O que muda e por quê:** ao expirar, persistir `status='dismissed'` na tabela `questions`, para o estado
sobreviver a reload/reinício.

**Arquivos modificados:**
- `backend/app/services/pipeline.py` — em `_expire_task`, após marcar `q.status = "dismissed"`,
  atualizar o banco. **Atenção SOLID:** hoje `pipeline.py` já chama `db.table(...)` diretamente (~12×),
  violando "sem queries em services". O ideal é criar/estender um repositório de sessão. Como Task 6 já
  toca essa dívida, o mínimo aqui é seguir o padrão local existente para não bloquear a correção — e
  registrar a dívida.

**Arquivos afetados:** `SessionActivePage.tsx` / `useSessionWS.ts` — já tratam `question_expired`;
sem mudança no front.

**Pontos de atenção:**
- Fazer o update em **lote** (todos os `expired_ids` de uma vez) para não disparar N escritas/segundo.
- Só persistir se a transição em memória ocorreu (evitar sobrescrever `pinned`/`used`).

**Plano de ação em caso de erro:** envolver a escrita em try/except com log — falha de persistência não
pode derrubar a `_expire_task` (senão a fila para de expirar). O broadcast já aconteceu.

**Prevenção:** teste que gera pergunta com TTL curto, espera expirar, recarrega a sessão e verifica que
ela não retorna como `queued`.

---

## Task 4b — Corrigir estimativa de custo do relatório 🟠 bug de correção · ✅ FEITO

**O que o sistema faz hoje:** `estimated_report_cost` (`session_state.py:109-111`) assume **2500 tokens
de saída**, mas `generate_report` passa `max_output_tokens=16384` (`llm.py`). A F7 (parada automática por
budget) depende dessa estimativa — que está **subestimada em até ~6×**, podendo deixar a sessão sem saldo
para o relatório. As constantes de preço (`llm.py:12-13`, `$0.15`/`$0.60` por 1M) conferem com o Gemini
2.5 Flash atual; o bug real é o número de tokens de saída, não o preço.

**O que muda e por quê:** alinhar a estimativa ao teto real de saída (usar a mesma constante de
`max_output_tokens`, ou um fator realista com margem) para a parada automática de budget ser confiável.

**Arquivos modificados:**
- `backend/app/services/session_state.py` — `estimated_report_cost`: substituir o `2500` por uma
  constante compartilhada (ex.: `REPORT_MAX_OUTPUT_TOKENS = 16384`) importada/definida junto de onde
  `generate_report` a usa, para não divergirem de novo.
- `backend/app/services/llm.py` — expor a constante `REPORT_MAX_OUTPUT_TOKENS` e usá-la tanto no
  `max_output_tokens` do `generate_report` quanto na estimativa (fonte única de verdade — princípio DRY).

**Arquivos afetados:** budget bar no `SessionActivePage.tsx` (consome `budget_update`) — passa a mostrar
estimativa realista; sem mudança de código no front.

**Pontos de atenção:**
- O SDD (F7) prevê **margem de 20%** sobre o custo estimado. Considerar aplicar a margem aqui.
- Confirmar as constantes de preço contra a tabela vigente do Gemini no momento da execução.

**Plano de ação em caso de erro:** se a estimativa ficar conservadora demais e cortar sessões cedo,
ajustar o fator; o SDD já prevê trocar a estimativa estática pela média real após ~10 sessões.

**Prevenção:** teste unitário puro sobre `estimated_report_cost` com transcript conhecido, comparando
com o custo de `max_output_tokens` real.

---

## Task 5 — `diagnostico/` (v1 CLI órfã) ✅ FEITO (documentada como legado — opção a)

> **Decisão tomada (2026-09-15):** documentar como modo CLI legado, sem remover.
> Review de código confirmou que `diagnostico/` não é importada por `backend/`, `frontend/` nem
> `extension/`, e que a extensão Chrome fala apenas com o backend v2 (`/webhook/extension` + `/ws`).
> Ações executadas: banner "MODO CLI LEGADO (v1)" no topo de `diagnostico/README.md`; nova seção 10
> "Modo CLI legado (v1)" no `CLAUDE.md` com como rodar e regras de não-confusão v1×v2; nota na Seção 9
> do `CLAUDE.md` esclarecendo que a migração planejada não aconteceu (v2 foi reescrita do zero).
> Saída futura, se ninguém usar o CLI: `git rm -r diagnostico/` (recuperável pelo histórico).

### O que é a pasta `diagnostico/`

É a **versão 1 completa** do produto — um aplicativo de linha de comando (CLI) **autossuficiente**,
anterior à reescrita web (v2). São ~3000 linhas em 31 arquivos, com sua própria arquitetura paralela à
do `backend/`:

| Subpasta / arquivo | O que é |
|--------------------|---------|
| `main.py` | Entry point CLI. Dois modos: `interactive` (entrevista por texto no terminal) e `realtime` (assiste reunião ao vivo). |
| `agent.py`, `conversation.py`, `report.py` | Agente de entrevista, histórico de conversa e gerador de relatório da v1. |
| `prompts.py` | Prompts **fixos** (constantes) — o que a v2 substituiu por geração dinâmica (`PromptBuilder`). |
| `llm/` | Clientes LLM próprios — inclusive `claude_client.py` (Anthropic), que a v2 não tem. |
| `coverage/` | `CoverageTracker` + `CoverageClassifier` próprios (equivalente v1 do pipeline). |
| `analysis/` | `RedFlagDetector` e `QuestionPlanner` da v1. |
| `transcription/` | Fontes de transcrição próprias: webhook Taqtic, Recall, stdin, tail de arquivo + `buffer.py`. |
| `ui/` | Renderers próprios: `renderer.py` (terminal Rich) e `web_renderer.py` (browser standalone na :8080). |

### O que ela faz (quando executada)

Rodando `python main.py` dentro da pasta, ela abre uma entrevista de diagnóstico **inteiramente no
terminal** — sem frontend React, sem FastAPI, sem Supabase. O modo `--mode realtime` liga o painel de
cobertura ao vivo (terminal ou browser) consumindo transcrição de stdin/arquivo/Taqtic/Recall. É o
sistema original, funcional e independente.

### Situação: código órfão

**Nenhum arquivo de `backend/` importa nada de `diagnostico/`.** A v2 web **não migrou** a v1 — reescreveu
tudo do zero em `backend/app/`. A Seção 9 do `CLAUDE.md` planejava *estender* `prompts.py`, `agent.py`,
`conversation.py` etc.; na prática isso não aconteceu. Além disso, a v1 usa **imports relativos ao topo**
(`from config import ...`, `from llm import ...`) — só roda com o diretório `diagnostico/` como raiz, o
que confirma que é um app à parte, não um módulo do backend.

### A decisão lógica a tomar

Só há duas saídas coerentes — o que **não** pode continuar é o estado atual (código morto sem rótulo,
que qualquer dev novo confunde com parte do sistema web):

| Opção | Quando faz sentido | Custo | Risco |
|-------|-------------------|-------|-------|
| **(a) Documentar como modo CLI legado** | Se o time ainda usa (ou quer poder usar) o diagnóstico offline no terminal, sem subir web/Supabase. | ~5 min (nota no `CLAUDE.md`/`README`). | Nenhum — só remove a ambiguidade. |
| **(b) Remover (`git rm -r diagnostico/`)** | Se ninguém usa o CLI e a v2 web é o único produto daqui pra frente. | ~1 min. | Baixo — recuperável via histórico do git a qualquer momento. |

### Por que decidir (e não deixar como está)

1. **Confunde quem lê o repo.** ~3000 linhas que aparentam ser do produto, mas não são chamadas por nada.
2. **Superfície de manutenção e segurança falsa.** Ex.: a v1 tem seu próprio `config.py`/`.env` e webhook
   server — mais lugares onde um segredo pode vazar ou um scanner acusar problema sem necessidade.
3. **Duplicação conceitual.** Prompts, classificador e planner existem em duas versões divergentes; um
   dev pode editar a errada.

**Recomendação:** se houver **qualquer** uso do modo terminal → **(a) documentar**; caso contrário →
**(b) remover**. A pergunta a responder antes de agir: *"alguém ainda roda o diagnóstico pelo terminal?"*

**Decisão:** adiada por escolha do time. **Não mexer agora** — apenas registrada aqui.

---

## Task 6 — Refatorar `SessionActivePage.tsx` + upload de PDF 🟡 dívida SOLID · ⬜ NÃO INICIADO

> Este plano segue o template obrigatório do `CLAUDE.md` ("Regras de Planejamento de Tasks"): as sete
> seções — linguagem comum, como, riscos, prevenção, conserto, decisões do time, verificação.

---

### 1. O que muda (em linguagem comum)

Existem **dois problemas de organização** (não de funcionamento — o sistema hoje funciona). A task
**reorganiza o código sem mudar o que ele faz** para o usuário. Mesma tela, mesmo botão, mesmo resultado.

**Analogia:** hoje o arquivo da tela de sessão é uma cozinha onde **uma pessoa só** corta, frita, emprata
e lava — mais de mil linhas fazendo tudo. A task dá a cada estação um responsável (componentes menores),
e a tela vira o *maître* que só coordena. O prato final é idêntico; muda **quem faz o quê** por dentro.

**Problema A — Frontend (a tela).** O arquivo `SessionActivePage.tsx` tem **1010 linhas** e concentra
tudo: o painel de cobertura à esquerda, a transcrição ao vivo no centro, os alertas, a fila de perguntas
à direita, a barra de custo e o modal de relatório. A regra do projeto diz "um arquivo, uma
responsabilidade". **Boa notícia descoberta ao ler o código:** essas peças **já estão escritas como
funções separadas dentro do mesmo arquivo**, com as entradas (props) bem definidas. Ou seja, a maior
parte do trabalho é **recortar cada função para o seu próprio arquivo** — é mecânico, não é reescrever.

**Problema B — Backend (o upload de PDF).** Quando o usuário importa um PDF de transcrição para gerar um
relatório, o endpoint `upload_pdf_transcript` faz **tudo sozinho dentro dele**: lê o PDF, classifica as
áreas com a IA, gera o relatório, calcula o custo e grava no banco (~150 linhas). A regra diz "o endpoint
valida a entrada, chama o service e responde — nada mais". A task **move essa lógica para um arquivo de
service** e deixa o endpoint só recebendo o arquivo e delegando.

**Por quê fazer:** ficar mais fácil de ler, de testar cada pedaço isoladamente, e de mexer numa parte sem
arriscar quebrar outra. Além disso, corrige um **bug real** de brinde (ver seção do backend abaixo).

---

### 2. Decisões que são SUAS (parar e perguntar antes)

Estas escolhas **não** devem ser feitas pelo executor sozinho — são suas:

| Decisão | Opções | Recomendação |
|---------|--------|--------------|
| **Nomes dos componentes** | Manter os nomes atuais das funções (`CoveragePanel`, `TranscriptPanel`, `QuestionsPanel`…) ou renomear para os do SDD (`LiveTranscript`, `RedFlagList`, `QuestionQueue`) | **Manter os nomes atuais** — renomear é risco extra sem ganho. |
| **Até onde quebrar a página** | (a) só extrair os 8 componentes que já existem; (b) também separar as duas telas grandes (`ActiveSessionView` / `FinishedSessionView`) | (a) primeiro; (b) só se sobrar fôlego. |
| **Unificar os dois caminhos de relatório** | Corrigir só o bug do upload; **ou** fundir upload + pipeline ao vivo numa função única de relatório | Corrigir o bug agora; **fusão total** fica como decisão à parte (mais arriscada). |
| **Criar repositório de sessão** | Isolar as queries num `SessionRepository` agora, ou manter `db.table(...)` no service por ora | **Manter por ora** — criar repositório completo é outra task; só registrar a dívida. |

**Enquanto essas decisões não saírem, o executor para na escolha e pergunta.**

---

### 3. Parte A — Frontend: como vai ser alterado

Trabalho **mecânico e incremental**: **um componente por commit**, validando a tela a cada passo.
As funções já existem em `SessionActivePage.tsx`; só mudam de arquivo.

**Passo 0 —** criar a pasta `frontend/src/components/session/`.

**Passos 1–9 —** mover, nesta ordem (dependências primeiro):

| Ordem | Função (linhas atuais) | Novo arquivo | Observação |
|:---:|-----------------------|--------------|-----------|
| 1 | `SessionTimer` (42–62) | `components/session/SessionTimer.tsx` | Sem dependências. |
| 2 | `TTLBar` (285–317) | `components/session/TTLBar.tsx` | Usada pelo `QuestionCard`. |
| 3 | `QuestionCard` (323–384) | `components/session/QuestionCard.tsx` | Importa `TTLBar`; leva junto `blockLabel`. |
| 4 | `CoveragePanel` (68–147) | `components/session/CoveragePanel.tsx` | Leva junto `AREA_LABELS`. |
| 5 | `BudgetBar` (153–198) | `components/session/BudgetBar.tsx` | — |
| 6 | `TranscriptPanel` (204–279) | `components/session/TranscriptPanel.tsx` | — |
| 7 | `QuestionsPanel` (390–490) | `components/session/QuestionsPanel.tsx` | Importa `QuestionCard`. |
| 8 | `ReportModal` (496–565) | `components/session/ReportModal.tsx` | — |
| 9 | `useCopy` (571–579) | `hooks/useCopy.ts` | Hook utilitário. |

**Receita de cada extração:** recortar a função + suas constantes locais → colar no arquivo novo →
adicionar os `import` que ela usa (ícones `lucide-react`, `ReactMarkdown`/`remarkGfm`, o tipo `WSQuestion`
de `lib/useSessionWS`) → trocar `function X` por `export function X` → no `SessionActivePage.tsx`, apagar a
definição antiga e adicionar `import { X } from '../components/session/X'`. **Nada da lógica com estado sai
do hook `lib/useSessionWS.ts`** — os componentes continuam só exibindo.

**Passo 10 (opcional, decisão b):** extrair `FinishedSessionView` (bloco `if (!isActive)`, ~743–881) e
`ActiveSessionView` (layout de 3 colunas, ~884–1009). A página raiz fica só com load + handlers +
`return isActive ? <ActiveSessionView/> : <FinishedSessionView/>`.

#### Riscos → Prevenção → Conserto (Frontend)

| Ação | Risco concreto | Como prevenir | Como consertar |
|------|----------------|---------------|----------------|
| Mover uma função | Esquecer um `import` (ícone, tipo, constante) → tela quebra em branco / erro de build | Rodar `npm run build` **ou** deixar o Vite (`npm run dev`) aberto e olhar o console a cada extração | Reverter **só aquele commit** (`git revert <hash>`) — a extração anterior continua de pé |
| Mover `QuestionCard`/`QuestionsPanel` | Ordem errada de import (card antes do TTLBar) → referência indefinida | Seguir a ordem da tabela (dependência primeiro) | Reverter o commit e refazer na ordem |
| Apagar a definição antiga no arquivo original | Sobrar referência à função antiga → erro de compilação | O TypeScript acusa na hora; não commitar com build vermelho | `git checkout -- SessionActivePage.tsx` antes de commitar |
| Extrair as views grandes (passo 10) | Passar props demais/de menos → coluna some ou fica sem dados | Comparar a tela lado a lado (antes/depois) com uma sessão real rodando | Reverter o commit da view; os 9 componentes menores permanecem |

**Regra de ouro:** cada commit é atômico e reversível sozinho. Se algo quebrar, some **um** commit, não a task inteira.

---

### 4. Parte B — Backend: como vai ser alterado

**O bug que entra de brinde (Item 13 — confirmado no código):**
- Caminho **ao vivo**: `pipeline.py:357` chama `generate_report(..., structured_context=...)`.
- Caminho do **upload**: `sessions.py:469` chama `generate_report(...)` **sem** `structured_context`.
- `llm.py:178-180` só monta a seção **"Diagnóstico Pré-Reunião vs Realidade"** quando recebe
  `structured_context`. Resultado: **todo relatório importado por PDF perde essa seção.** Unificar num
  service corrige isso.

**Passos:**

1. **Criar** `backend/app/services/report_ingestion.py` com
   `async def ingest_pdf_and_generate_report(session_id: str, pdf_bytes: bytes, db: Client) -> dict`.
2. **Mover para dentro dela**, na mesma ordem de hoje, os blocos de `sessions.py:359–497`: buscar sessão
   + projeto, obter chave Gemini do Vault, extrair texto do PDF (pdfplumber), gravar `transcript_chunks`,
   classificar cobertura se faltar snapshot, coletar red flags + perguntas usadas, gerar relatório,
   calcular custo e gravar em `reports` + atualizar `sessions`.
3. **Corrigir o bug na mudança:** dentro do novo service, **extrair e passar `structured_context`** igual
   ao pipeline (reusar `extract_structured_context`, como em `pipeline.py:586–592`), com fallback `None`
   se vazio ou se der erro.
4. **Enxugar o router** `upload_pdf_transcript`: manter só a validação de extensão `.pdf`, ler os bytes
   e chamar o service. As `HTTPException` de regra de negócio sobem de dentro do service (FastAPI propaga).

#### Riscos → Prevenção → Conserto (Backend)

| Ação | Risco concreto | Como prevenir | Como consertar |
|------|----------------|---------------|----------------|
| Mover a lógica para o service | Trocar a **ordem** das operações (ex.: gerar relatório antes de gravar o chunk) → dado inconsistente | Copiar bloco por bloco na ordem original; revisar o diff lado a lado | `git revert` do commit; o endpoint antigo volta idêntico |
| Passar `structured_context` novo | `extract_structured_context` faz **mais uma chamada à IA** → custo/tempo extra no upload | Envolver em try/except com fallback `None`; só chamar se há `pre_meeting_context` e chave | Se pesar, condicionar a um parâmetro; comportamento sem contexto = igual ao de hoje |
| Enxugar o router | Uma `HTTPException` que era 422/404/503 virar 500 se o service não relançar certo | Manter os mesmos `status_code` ao mover cada validação; testar cada caminho de erro | Reverter o commit do router; a lógica no service continua |
| Import novo no router | `pipeline_manager`/service import circular | Import local dentro da função, como já se faz em `generate_session_questions` (`sessions.py:302`) | Mover o import para dentro da função |

**Regra:** a extração do backend é **um commit**; a correção do `structured_context` pode ser **outro
commit** (assim dá pra reverter o bugfix sem perder a reorganização).

---

### 5. Verificação (ponta a ponta)

1. **Front:** subir a UI (`npm run dev`) e abrir uma sessão ativa (F5). Conferir **visualmente** que as 3
   colunas (cobertura / transcrição+alertas / perguntas), a budget bar, o timer e o modal de relatório
   estão **idênticos** ao comportamento anterior. Fila de perguntas: pin/dismiss/use e a barra de TTL
   continuam funcionando. `npm run build` sem erros.
2. **Back:** fazer **upload de um PDF** numa sessão que tenha `pre_meeting_context` preenchido. O relatório
   gerado **agora deve incluir** a seção "Diagnóstico Pré-Reunião vs Realidade" (antes não incluía).
3. **Back (regressão):** upload numa sessão **sem** `pre_meeting_context` → relatório sai normal, sem a
   seção, e **sem erro** (fallback `None`).
4. **Testes:** `cd backend && python -m pytest` continua verde. **Semente obrigatória:** ao menos 1 teste
   real do novo `report_ingestion` com um PDF conhecido (texto extraído esperado + relatório contém a seção
   quando há contexto).

---

### 6. Ordem recomendada de execução

`Front passos 1→9 (um commit cada)` → `[decisão b? passo 10]` → `Back passo 1–2 (extração, 1 commit)` →
`Back passo 3 (bugfix structured_context, 1 commit)` → `Back passo 4 (enxugar router, 1 commit)` →
`Verificação 1–4`. **Nunca** juntar refator com as correções críticas (Tasks 1–4) no mesmo commit.

---

## Detalhes de arquitetura relevantes ao plano

- **Motor de tempo real:** `SessionPipeline` + `PipelineManager` (`services/pipeline.py`). Boot lê
  `sessions ⋈ projects`, descriptografa a chave Gemini (`vault_get_secret`, fallback env), infere
  `project_type` se vazio, extrai `StructuredContext`, gera 4 prompts (`PromptBuilder.build_all`) e sobe
  4 tasks asyncio: `_coverage_task` (30s), `_red_flag_task` (15s), `_render_task` (1s), `_expire_task`
  (1s). *(Divergências do SDD: `_render` a 1s e não 250ms; sem `_watchdog`; coverage sem gatilho por
  250 tokens.)*
- **Estado em memória, singletons de processo:** `PipelineManager`, `ws_manager` e o `InMemorySaver` do
  chatbot. **Sobrevive só em instância única** — com >1 worker, WS e webhook podem cair em processos
  distintos. Relevante como restrição de fundo para as Tasks 2 e 3 (não escalar horizontalmente sem
  antes resolver estado compartilhado).
- **Ingestão:** extensão (`content_meet.js` → `background.js` → `POST /webhook/extension`) ou Recall
  (`POST /webhook/recall`). Ambos gravam `transcript_chunks` e chamam `pipeline_manager.push_chunk`
  sem bloquear.
- **SOLID:** só o Precificador respeita router→service→repository. O Diagnóstico não tem repositório;
  `pipeline.py` e `sessions.py` falam com o banco direto — dívida que as Tasks 4a e 6 tangenciam.

---

## Verificação (como testar ponta a ponta)

1. **Task 1:** após rotacionar, subir backend + MCP com a nova chave e confirmar que leem/escrevem no
   Supabase. `grep` por `eyJhbGci`/`service_role`/`fzvwtkipzxdnubprvfct` no repo → zero resultados reais.
2. **Task 3:** iniciar sessão (extensão), confirmar tasks rodando (logs de coverage/red_flag); chamar
   `POST /sessions/:id/finish` **sem** o evento WS (ex.: via curl); confirmar nos logs que as chamadas ao
   Gemini **cessam** e que `pipeline_manager._pipelines` não tem mais o `session_id`.
3. **Task 2-CORS:** frontend em produção continua funcionando; extensão continua postando chunks;
   requisição de origem não listada é bloqueada.
4. **Task 4a:** pergunta com TTL curto → expira → recarregar a sessão (`GET /sessions/:id`) → não volta
   como `queued`.
5. **Task 4b:** `estimated_report_cost` retorna valor coerente com `max_output_tokens=16384`; budget bar
   reflete estimativa realista; parada automática dispara na hora certa.
6. **Task 6:** rodar a UI de monitoramento (F5) e o upload de PDF; 3 colunas + budget + modal idênticos
   ao comportamento anterior; relatório importado agora inclui a seção "Pré-Reunião vs Realidade".

Onde houver testes, preferir estendê-los (hoje `test_projects.py` são stubs com `pytest.skip`; cobertura
efetiva é zero — cada task acima deixa ao menos 1 teste real como semente).

---

## Itens deixados FORA deste ciclo (registro)

- **Estratégia de autenticação** (Task 2-Auth) — decisão em aberto.
- **`diagnostico/`** (Task 5) — decisão em aberto.
- Estado compartilhado p/ multi-instância (Item 8), F9/tunnel morto (Item 5), campos de contexto/budget
  de sessão descartados (Item 4), prompts duplicados (Item 10), `generate_custom_areas` nunca chamada
  (Item 14), `except: pass` em massa (Item 15) — backlog para ciclos futuros.
