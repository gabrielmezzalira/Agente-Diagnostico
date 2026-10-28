# Análise da `origin/master` para a integração com a `main`

**Data:** 2026-10-28 · **Tipo:** somente leitura (nada foi mergeado, commitado ou alterado no git).
**Refs usadas:** `origin/master` = `2e67c7c` · nosso lado = ponta de `feat/fase-09-cutover-retire-custom-extension` = `946a361` (contém a `main` local `5944748` + 16 commits de docs/teste da Fase 9) · ancestral comum = `bb1aac0` (24/09/2026, PR #5) · `origin/feat/fase-10-agp-question-panel` = `041ed59`.
**Aviso:** outro processo estava commitando em `frontend/`. Tudo abaixo foi lido por `git show 946a361:<caminho>`, nunca pela pasta de trabalho. Se saírem commits novos depois de `946a361`, a conclusão do frontend deve ser reconferida.

---

## 1. Resumo executivo

- **A `master` não tem nada de valioso que o nosso lado não tenha.** Medi de três formas independentes (detalhes na seção 2 e 3): (a) nenhum arquivo foi alterado na master sem também ter sido alterado do nosso lado desde o ancestral comum (`comm` deu 0 arquivos "só da master"); (b) não existe nenhum arquivo que esteja na master e não esteja no nosso lado (`git diff --name-status 946a361 origin/master` não tem nenhuma linha `A`); (c) dos 109 commits "novos" da master, 102 dos 104 sem merge têm commit equivalente (mesmo patch) no nosso lado (`git cherry`), e os outros 2 também já estão contidos em conteúdo.
- O redesign de UI e o vínculo DocuData **já estão no nosso lado** (a `main` recebeu as mesmas mudanças pelos PRs #9 e #10, com outros SHAs). Os arquivos de frontend da master são idênticos aos nossos, com exceção de 2 páginas em que o nosso lado é mais novo.
- A pasta `taqciti/` da master é uma **cópia antiga**: a árvore dela é byte a byte a da ponta de `origin/feat/fase-07-taqciti-config-background-streamer` (Fase 7, 10/10). Ela não tem nada da Fase 8 (vínculo por reunião, `chunk_id`, envio em partes, fila de saída).
- Os 46 conflitos existem só porque a master guarda uma versão **mais velha** dos mesmos arquivos que nós já evoluímos. Em todos os 46, o nosso lado deve vencer por inteiro.
- **Risco geral: baixo no conteúdo, médio no procedimento.** O perigo não é perder algo da master; é o git "resolver sozinho" e misturar versões velhas com as novas. Prova concreta: `merge-tree -X ours` produz `webhook.py` com a função `verify_extension_key` **duplicada** (10 linhas a mais que o nosso arquivo). Por isso a proposta (seção 6) é fazer o merge de forma que a árvore final seja exatamente a nossa, com a master registrada como ancestral.
- A branch `origin/feat/fase-10-agp-question-panel` **é** a Fase 10 (aba AGP na Taqciti), **não está** na master nem na `main`, e só tem **1 conflito de texto** com o nosso lado (`associationClose.ts`). Vale reaproveitar, mas como uma etapa separada (ver seção 5).

---

## 2. O que a master contém, por tema

Total medido: `git rev-list --count 946a361..origin/master` = 109 commits (5 são merges: `a95fe11`, `72e3f85`, `2a98585`, `b1e9094`, `2e67c7c`; 104 sem merge). Por tipo: 66 `docs`, 16 `fix`, 13 `feat`, 7 `test`, restante `chore`/outros.

Comando-chave: `git cherry 946a361 origin/master` → **102 commits "-" (já existe commit com o mesmo patch no nosso lado) e só 2 "+"**: `421eedb` e `dbbe9f8`.

| Tema | Commits / PRs | O que muda de verdade | Redundante com o nosso trabalho? |
|---|---|---|---|
| Sincronização main→master (deploy) | `a95fe11` (22/09), merge PR #2 `72e3f85`, PR #4 `2a98585`, PR #6 `b1e9094` (22–24/09) | Traz `.planning/` (codebase maps, BACKLOG, WINDOWS, roadmap v3.0) e as Fases 1–5 (backend/frontend de discovery, lentes, PRD, monitoramento) | Sim. Blobs idênticos aos nossos. |
| Troca de modelo Gemini | `421eedb` (07/08): `gemini-flash-latest` em `backend/app/services/llm.py` e `structured_context.py` | 2 linhas | Sim. Esses dois arquivos não aparecem na diferença entre a master e o nosso lado (idênticos). Nosso equivalente: `21fb4e7`. |
| Fases 6 e 7 (autoria AntonioNetoG, 24–27/09) | `94ec0d0`, `f8810a5`, `a920102`, `6f335c8`, `03e0746`... `12be199` | Gate opt-in `EXTENSION_SHARED_KEY` no `POST /webhook/extension`, campo de chave na extensão antiga, testes/UAT da Fase 6 e 7 | Sim (equivalentes: `866a90b`, etc.). |
| Vínculo DocuData | `27f509c`, `2f30d36`, `ed53e56`, `51c37db`, `b53e08c`, `f84d78f`, `7ebeb74`, `06dd660`, `969ff0b`, `54e7ab2`, `6a14a9b`, `b003470` (13/10) | Config opcional (URL + chave de serviço), cliente HTTP com retry, envio do pacote da sessão de discovery ao encerrar, coluna `projects.docudata_project_id` (migration `20261012000000`) | Sim. Nosso: `5d78059`, `f620367`, PR #9 (`6d0c60e`), e ainda temos a extensão do envio no `finish` da Taqciti (`82727fe`). |
| Redesign de UI | `7c21823`, `4adb17f`, `1fc0de1`, `098fdf4`, `8205f68` (14/10) | Tokens do design system CITi (tema escuro, fonte Geist), kit de componentes, casca sidebar+topbar, sessão ao vivo/encerrada, telas novas Sessões / Extensão Chrome / Configurações. ~48 arquivos em `frontend/src` | Sim. Nosso: `40a1cc0`, `04dfe3a`, `f620367`, `75b8595` + PR #10. `git diff --stat 946a361 origin/master -- frontend` mostra só 2 arquivos diferentes (`ProjectDetailPage.tsx`, `ProjectFormPage.tsx`), e nesses o nosso lado é o mais novo. |
| Cópia da `taqciti/` | `dbbe9f8` (15/10), 319 arquivos, +56.604 linhas; merge PR #11 `2e67c7c` | Coloca a extensão TaqCITi na master | **Parcialmente nova como commit, mas redundante como conteúdo.** `git rev-parse origin/master:taqciti` = `cc5dec88be…` = `git rev-parse origin/feat/fase-07-taqciti-config-background-streamer:taqciti`. É a Fase 7 pura. |
| Planning / docs | 66 commits `docs(...)` | Planos, UAT, revisões das Fases 1–7, `.planning/redesign-ui/`, `PLANO_INTEGRACAO_DOCUDATA.md` | Sim. A master está **atrás**: roadmap/STATE ainda dizem "Fase 8 pendente, auto-detect"; o nosso diz v3.0, Fase 9 executando. |
| Backend | (dentro dos temas acima) | Versões antigas de `webhook.py`, `projects.py`, `models/projects.py`, `sessions.py`, `pipeline.py`, `main.py` | Sim, e **mais antigas** que as nossas (ver seção 3). |
| Testes | 7 commits `test(...)` + `backend/tests` (26 arquivos na master, 30 no nosso) + `extension/tests` (4) | Testes das Fases 6/7 e do DocuData | Sim. Nosso lado tem 4 testes a mais (idempotência do webhook, lock do pipeline, clientes da extensão, campos extras do chunk) e versões mais novas de `test_projects.py` e `test_upload_pdf_mode.py`. |

**O que NÃO é redundante?** Nada, pelo que consegui provar. Resultado das provas:
- `comm -23` entre "arquivos alterados `bb1aac0→master`" (448) e "alterados `bb1aac0→nosso lado`" (666): **0 arquivos**. Ou seja, todo arquivo que a master mexeu, o nosso lado também mexeu.
- Desses 448, **353 são byte a byte idênticos** (mesmo blob) nos dois lados; 95 diferem, e nesses a versão da master é sempre anterior (seção 3 prova para os 46 em conflito; os outros 49 também terminam iguais ao nosso arquivo quando o merge é feito, ver abaixo).
- Os 213 arquivos que o nosso lado tem a mais (`git diff --name-status 946a361 origin/master | awk '$1=="D"'`) são Fase 8: 110 em `taqciti/src`, ~70 em `.planning/phases/08-…`, `backend/app` (`exceptions.py`, `models/extension.py`, `repositories/*`, `routers/extension_clients.py`, `services/extension_session_service.py`), 4 testes de backend e a migration `20261011000000_add_chunk_id_to_transcript_chunks.sql`.

Observação sobre os 49 arquivos "diferentes mas sem conflito" (`.planning/phases/06*`, `07*`, `debug/*`, `PROJECT.md`, `config.json`, `backend/app/models/projects.py`, `backend/app/routers/sessions.py`...): o merge comum **resolve todos para a versão do nosso lado** (confirmei: `git diff 946a361 <árvore do merge-tree>` só toca nos 46 arquivos em conflito). Nesses, a diferença da master é uma versão antiga (ex.: `models/projects.py` exige `gemini_api_key: str`; nosso lado tem chave opcional, D-15).

---

## 3. Triagem dos 46 conflitos

**Contagem:** `git merge-tree --write-tree --name-only --no-messages 946a361 origin/master` lista **46** arquivos (5 `.planning`, 2 backend, 2 frontend, 37 `taqciti/`). Tipo em todos: "os dois lados mudaram" (o arquivo existe no ancestral `bb1aac0` e foi editado nos dois lados). Não há conflito de tipo "adicionado nos dois" nem "apagado de um lado".

**Regra de partida testada:** `taqciti/` = nosso lado ✔ confirmado. `.planning/` = nosso lado ✔ confirmado. Backend e frontend = "mesclar à mão" ✘ **desmentido**: não há trecho da master que falte no nosso lado, então não há o que mesclar; o nosso arquivo inteiro vence.

**Como provei para cada arquivo:** para cada um dos 46, procurei no histórico do nosso lado (`git log 946a361 -- <arquivo>`) um commit cujo blob é igual ao blob da master (`git rev-parse origin/master:<arq>`). Achei em **41 dos 46**. Ou seja, a master tem exatamente uma versão antiga do arquivo, que o nosso histórico já teve na data indicada. Os 5 restantes são arquivos de `.planning/` que a master simplesmente deixou desatualizados (conferidos à mão, abaixo).

Legenda de risco: risco **de vencer o nosso lado** (de perder algo) — baixo em todos. Quando indico "médio", é porque a ferramenta de merge tende a duplicar/misturar (armadilha da seção 6).

### 3.1 `.planning/` (5)

| Arquivo | Tipo | Vence | Por quê | Risco |
|---|---|---|---|---|
| `.planning/REQUIREMENTS.md` | os dois mudaram | nosso | master tem o TAQ-02 antigo ("auto-detect") e rodapé de 19/09; nosso tem o TAQ-02 reescrito (seletor de cliente, 11/10) | baixo |
| `.planning/ROADMAP.md` | os dois mudaram | nosso | master: Fase 8 "pending", texto antigo, sem lista de planos 8/9 (114 linhas a menos); nosso: Fases 8 e 9 detalhadas | baixo |
| `.planning/STATE.md` | os dois mudaram | nosso | master é só o aviso "Feature Flow em progresso" de 14/10 (235 linhas a menos); nosso é o estado v3.0, Fase 9 executando | baixo |
| `.planning/state.json` | os dois mudaram | nosso | master marca Fases 8 e 9 como `pending` e `updated_at` 27/09; nosso reflete Fase 9 em andamento | baixo |
| `.planning/ui-reviews/.gitignore` | os dois mudaram | nosso | nosso tem a linha `interaction/` a mais; master não | baixo |

### 3.2 Backend (2)

| Arquivo | Tipo | Vence | Por quê | Risco |
|---|---|---|---|---|
| `backend/app/routers/projects.py` | os dois mudaram | nosso | blob da master = o nosso em `86b0795` (13/10). Falta a master o D-15 (chave Gemini do projeto opcional, cai na `GEMINI_API_KEY` do servidor): na master o `create_project` guarda a chave sempre | médio (a ferramenta pode misturar o bloco do D-15 com o antigo; conferir o diff final contra `946a361`) |
| `backend/app/routers/webhook.py` | os dois mudaram | nosso | blob da master = o nosso em `866a90b` (24/09, Fase 6). Falta a master: `chunk_id`, 404 para sessão inexistente, idempotência (D-19), `TranscriptChunksRepository`. **Armadilha comprovada:** `merge-tree -X ours` deixa `verify_extension_key` duplicada | **alto se resolvido por `-X ours`**, baixo se a árvore final for forçada a ser a nossa |

### 3.3 Frontend (2)

| Arquivo | Tipo | Vence | Por quê | Risco |
|---|---|---|---|---|
| `frontend/src/pages/ProjectDetailPage.tsx` | os dois mudaram | nosso | master = o nosso em `f620367` (14/10); diferença total: 1 linha (chip "Usando a chave do servidor" no nosso vs "Não configurada" na master) | baixo |
| `frontend/src/pages/ProjectFormPage.tsx` | os dois mudaram | nosso | master = o nosso em `f620367`; na master a chave Gemini é obrigatória na criação, no nosso lado é opcional (D-15, `7c70c73`) | baixo |

### 3.4 `taqciti/` (37) — a master tem a Fase 7 (ou mais antiga); o nosso lado tem a Fase 8

Todos: nosso vence. A coluna "a master é o nosso de..." é o commit/data do nosso histórico cujo blob é idêntico ao da master.

| Arquivo | A master é o nosso de... | Risco |
|---|---|---|
| `taqciti/manifest.config.ts` | `9a26937` 25/09 | baixo |
| `taqciti/tailwind.config.ts` | `9a26937` 25/09 | baixo |
| `taqciti/src/background/agenteSender.ts` | `a73349d` 27/09 (128 linhas na master, 200 no nosso) | baixo |
| `taqciti/src/background/agenteSender.test.ts` | `a73349d` 27/09 | baixo |
| `taqciti/src/background/agenteStatusReporter.ts` | `1bae001` 10/10 | baixo |
| `taqciti/src/background/agenteStreamer.ts` | `1bae001` 10/10 (91 linhas na master, 139 no nosso; master sem `destination`/`association`) | baixo |
| `taqciti/src/background/agenteStreamer.test.ts` | `1bae001` 10/10 | baixo |
| `taqciti/src/background/agenteStreamerDeps.ts` | `1bae001` 10/10 | baixo |
| `taqciti/src/background/agenteStreamerInstance.ts` | `2400d11` 10/10 | baixo |
| `taqciti/src/background/history.ts` | `9a26937` 25/09 | baixo |
| `taqciti/src/background/index.ts` | `634f541` 27/09 | baixo |
| `taqciti/src/background/sessionController.ts` | `16b4bab` 29/09 | baixo |
| `taqciti/src/content/providers/googleMeet/GoogleMeetProvider.ts` | `9a26937` 25/09 | baixo |
| `taqciti/src/content/providers/googleMeet/GoogleMeetProvider.test.ts` | `9a26937` 25/09 | baixo |
| `taqciti/src/content/providers/googleMeet/selectors.ts` | `9a26937` 25/09 | baixo |
| `taqciti/src/content/ui/PanelApp.tsx` | `9a26937` 25/09 | baixo |
| `taqciti/src/content/ui/panel.css` | `9a26937` 25/09 | baixo |
| `taqciti/src/features/agente/sendRetryPolicy.ts` | `1a5c10a` 27/09 | baixo |
| `taqciti/src/features/agente/sendRetryPolicy.test.ts` | `1a5c10a` 27/09 | baixo |
| `taqciti/src/features/meeting/machine.ts` | `9a26937` 25/09 | baixo |
| `taqciti/src/shared/config/agenteConfig.ts` | `2400d11` 10/10 (234 linhas na master, 239 no nosso) | baixo |
| `taqciti/src/shared/config/agenteConfig.test.ts` | `2400d11` 10/10 | baixo |
| `taqciti/src/shared/config/agenteStatus.ts` | `1bae001` 10/10 | baixo |
| `taqciti/src/shared/config/agenteStatus.test.ts` | `6404a73` 10/10 | baixo |
| `taqciti/src/shared/config/constants.ts` | `1bae001` 10/10 | baixo |
| `taqciti/src/shared/hooks/useAgenteConfigForm.ts` | `1bae001` 10/10 | baixo |
| `taqciti/src/shared/hooks/useAgenteStreamingStatus.ts` | `c17cefb` 27/09 | baixo |
| `taqciti/src/shared/types/messages.ts` | `9a26937` 25/09 | baixo |
| `taqciti/src/shared/ui/Button.tsx` | `9a26937` 25/09 | baixo |
| `taqciti/src/shared/ui/ConfirmModal.tsx` | `9a26937` 25/09 | baixo |
| `taqciti/src/shared/ui/Icon.tsx` | `9a26937` 25/09 | baixo |
| `taqciti/src/sidepanel/components/HistoryCard.tsx` | `9a26937` 25/09 | baixo |
| `taqciti/src/sidepanel/components/RecordDetail.tsx` | `9a26937` 25/09 | baixo |
| `taqciti/src/sidepanel/screens/AgenteConfigScreen.tsx` | `ff970d0` 10/10 | baixo |
| `taqciti/src/sidepanel/screens/AgenteConfigScreen.test.tsx` | `1bae001` 10/10 | baixo |
| `taqciti/src/sidepanel/screens/AgenteConfigScreenBack.test.tsx` | `4a31957` 10/10 | baixo |
| `taqciti/src/test/chromeStorageMock.ts` | `9a26937` 25/09 | baixo |

(`9a26937` é a importação inicial da Taqciti no repo; os de 10/10 são o fim da Fase 7. A Fase 8 só começa depois disso.)

### 3.5 Prova de que `taqciti/` do nosso lado é superconjunto da master

- Árvores: `origin/master:taqciti` = `cc5dec88be…` = `dbbe9f8:taqciti` = taqciti da ponta de `origin/feat/fase-07-taqciti-config-background-streamer` (Fase 7). A árvore do nosso lado é outra (inclui a Fase 8).
- Os 4 blobs pedidos (`git rev-parse <ref>:<arquivo>`):

| Arquivo | Nosso lado (`946a361`) | Master | O que a master NÃO tem |
|---|---|---|---|
| `taqciti/src/shared/config/agenteConfig.ts` | `94185d8755` (239 linhas) | `2c1a84c1ed` (234 linhas) | menos referências a `chunk` (8 vs 12 ocorrências): faltam os campos/limites do `chunk_id` |
| `taqciti/src/background/agenteStreamer.ts` | `a9f744b615` (139 linhas) | `8c442a1ca9` (91 linhas) | associação (`assoc` 4 vs 0), política de destino (`destination` 3 vs 0), fila de saída (`agenteOutboxStore`) |
| `taqciti/src/background/agenteStreamDestination.ts` | `dd4c66298f` | **não existe** | "para onde vai a fala" = associação da reunião (troca de regra da Fase 7 para a Fase 8) |
| `taqciti/src/features/agente/association.ts` | `c5f9d885aa` | **não existe** | o reducer do vínculo por reunião (`pending/choosing/deferred/linking/linked/sent/...`) |

- Busca por palavra em `taqciti/src` (arquivos que mencionam): `chunk_id` 13 (nosso) vs **0** (master); `associationStore` 24 vs 0; `bindFlow` 7 vs 0; `ClientPicker` 7 vs 0; `outbox` 20 vs 2.
- **O que a master tem na `taqciti/` e o nosso lado não tem: nada.** Nenhum arquivo `A` na diferença, e todos os blobs divergentes dos 37 arquivos acima existem no nosso histórico.
- Resposta às perguntas do enunciado: a master **não** tem `chunk_id`, **não** tem envio em partes/fila de saída (`agenteOutboxStore`, `agenteSendQueue`), **não** tem vínculo por reunião. Quem tem tudo isso é o nosso lado.

---

## 4. Pontos de sobreposição com o que ainda vamos mudar

Como o frontend da master é idêntico ao nosso (exceto as 2 páginas de projeto), a master **não acrescenta nenhum comportamento** a esses arquivos. A tabela mostra os blobs de `946a361` e da master.

| Arquivo | Master | Nosso lado (`946a361`) | Como combinar sem perder nada |
|---|---|---|---|
| `frontend/src/pages/ExtensionPage.tsx` (55 linhas) | blob `17f368acc3` | **igual** (`17f368acc3`); vem do commit `75b8595` (14/10). Texto "Baixe o arquivo .zip", botão `Download` apontando para `EXTENSION_URL` | Não há nada a combinar: a reescrita para a Taqciti parte do arquivo atual e não conflita com a master. Cuidado só com `EXTENSION_URL` (próximo item) |
| `frontend/src/lib/labels.ts` (32 linhas) | blob `f0dc0e39ac` | **igual**. Exporta `PROJECT_TYPE_LABELS`, `DMS_LABELS`, `EXTENSION_URL`, `formatDateTime`, `sessionDurationLabel`. `EXTENSION_URL` aponta para o release `v1.0.0` do GitHub (zip da extensão antiga) | Se a reescrita remover/trocar `EXTENSION_URL`, a master continuaria com o valor antigo apenas se a master for mergeada **depois**. Com a estratégia "árvore final = nossa", não há reintrodução. A decisão de trocar o link (ou deixar sem link, plano 09-04) é do time |
| `frontend/src/pages/ProjectDetailPage.tsx` | blob `1e37f8ee91` (1 linha diferente: chip "Não configurada") | blob `493b9fe9e7`: chip "Usando a chave do servidor" (D-15). Contém o bloco "Gerar PRD": `readiness`/`readinessLoading`/`readinessError`, `<PrdCard .../>` na linha ~201 | Esconder o botão = editar o nosso arquivo (ou só não renderizar o `<PrdCard>`). Manter o carregamento de `readiness` evita regressão em outros usos. **Nunca** pegar a versão da master (perderia o D-15) |
| `frontend/src/components/project/PrdCard.tsx` (52 linhas) | blob `b3f48b8e89` | **igual** (`f620367`). Título "Gerar PRD", botão desabilitado se `!readiness?.ready`, usa `onGenerate` | Dá para esconder no pai (`ProjectDetailPage`) e deixar o componente intacto, ou receber uma prop de visibilidade. Qualquer das duas não conflita com a master, que não mexeu no arquivo desde `f620367` |
| Lentes da Fase 5 (`CoveragePanel.tsx`, `LensBadge.tsx`, `QuestionsPanel.tsx`, `TranscriptPanel.tsx`, `lib/lens.ts`, `lib/lens.test.ts`, `lib/useSessionWS.ts`, `SessionActivePage.tsx`) | 8 arquivos com `lens`, todos idênticos | idênticos | Sem sobreposição. A lógica de lentes do **backend** também está igual nos dois lados (nenhum arquivo de lente aparece na lista de diferenças) |

Sobreposição extra que a análise achou: o formulário e a página de detalhe (D-15, chave Gemini opcional) são os únicos arquivos de frontend onde "pegar a master" **regrediria** comportamento. Eles são justamente 2 dos 46 conflitos.

---

## 5. Branch `origin/feat/fase-10-agp-question-panel` (`041ed59`)

**Situação:** `git rev-list --count main..<branch>` = 13 (todos de 12/10/2026, autor gabrielmezzalira); está 71 commits **atrás** da `main` local. `git merge-base main <branch>` = `a365f9c` (12/10, checklist de pendências da Fase 8). **Não** está contida na master nem na `main` (`merge-base --is-ancestor` falhou; `git branch -a --contains` só lista ela mesma). Os 13 commits aparecem todos como "+" no `git cherry 946a361 <branch>` (nenhum equivalente no nosso lado).

É trabalho da **Fase 10 — painel AGP de perguntas dentro da Taqciti**: aba "AGP" no painel ao vivo, alimentada por WebSocket `/ws/{session_id}` do backend (`question_new` / `question_expired`), só com a sessão vinculada (depende da Fase 8). Só toca `taqciti/` e `.planning/` (nenhum arquivo de `backend/`).

| # | Commit | Muda |
|---|---|---|
| 1 | `653dc7c` docs(10): plano da fase 10 | `.planning/phases/10-agp-question-panel-in-taqciti/10-PLAN.md` |
| 2 | `dce585c` feat: regras puras do painel AGP | `features/agente/agpQuestions.ts` e `agpTarget.ts` (+ testes) |
| 3 | `366a4b9` feat: storage do painel (`taq:agpQuestions`) com lista branca | `shared/config/agpQuestionsStore.ts` (+ teste), `constants.ts` (diff com 239 linhas, mas só 5 linhas reais; resto é fim de linha/espaço), 1 linha em `agenteDeliveryStore.ts` (exporta `subscribeNormalized`) |
| 4 | `b6609af` feat: service worker segue a sessão vinculada e espelha as perguntas | `background/agpQuestionsFeed.ts` (+ teste), `agpQuestionsFeedInstance.ts`, 4 linhas em `background/index.ts`, `buildAgpSocketUrl` em `shared/config/agenteRoutes.ts` (+ teste) |
| 5 | `cf2ec43` feat: aba AGP no corpo ao vivo | `AgpLiveTabs.tsx`, `AgpQuestionsPanel.tsx` (+ testes), `hooks/useAgpQuestions.ts`, `LiveScreen.tsx`, `content/ui/PanelApp.tsx` |
| 6 | `d2bc62a` docs: checklist de testes, limitações, adiados | `.planning/PENDENCIAS-FASE-10.md` |
| 7 | `ac1f6b2` docs: relatório de code review | `10-REVIEW.md` |
| 8 | `a4bc2a4` fix CR-01: storage do AGP não perde campo; sem prazo local; backoff e tetos | 10 arquivos em `agp*`/`AgpLiveTabs`/`useAgpQuestions` |
| 9 | `4160d98` fix(08) CR-02: nova rodada de encerramento (DA-5) passa para `runtime.onStartup` | `agenteSessionFinisher.ts`, `agenteSessionFinisherInstance.ts` (+ teste), `background/index.ts`, `features/agente/association.ts`, `associationClose.ts` |
| 10 | `eca394b` docs: registra o resultado do review | `PENDENCIAS-FASE-08.md`, `PENDENCIAS-FASE-10.md`, `RETOMAR-AQUI.md` |
| 11 | `eb619c2` refactor: adaptador do WebSocket vira arquivo próprio | `agpBrowserSocket.ts`, `agpQuestionsFeedInstance.ts` |
| 12 | `0310e3a` test: fumaça opt-in contra o roteador WebSocket real | `scripts/agp-fake-backend.py`, `background/agpBackendSmoke.test.ts` |
| 13 | `041ed59` docs: roteiro de UAT manual (7 testes, nenhum executado) | `10-UAT.md` |

**Conflito com o nosso lado** (`git merge-tree --write-tree --name-only --no-messages 946a361 origin/feat/fase-10-agp-question-panel`): **1 arquivo**, `taqciti/src/features/agente/associationClose.ts`. O conflito é entre (a) o commit `4160d98` da Fase 10, que só reescreve dois comentários ("no boot" → "ao abrir o navegador, `runtime.onStartup`") e (b) o nosso commit `d1aaa1b` (27/10, WR-02), o único que tocou esse arquivo desde `a365f9c` e que, pelo diff, é quem trouxe a função `isCloseOwed` logo ao lado (não abri o diff do commit; deduzido da comparação das duas versões). Resolução: manter o arquivo do nosso lado inteiro e aplicar só os 2 comentários da Fase 10; atualizar também o comentário de `isCloseOwed` ("no boot (DA-5)" → "ao abrir o navegador"). Todo o resto (inclusive `background/index.ts` e `PanelApp.tsx`) o git junta sem conflito, porque o ancestral é `a365f9c` e as mudanças da Fase 10 são em trechos diferentes das nossas.

**Vale reaproveitar?** Sim, é o que falta para a TAQ-05 e é código novo (15 arquivos novos, quase tudo com teste). Pontos de atenção honestos:
- A branch foi cortada de uma Fase 8 **anterior** à nossa (nós temos 71 commits a mais, incluindo revisão e correções da Fase 8, `releaseMeetingAssociation`, `relaunchLiveLinks`, seletor de tamanho do painel). A junção automática não deu conflito, mas um merge sem conflito **não prova** que o painel AGP funciona em cima da Fase 8 final.
- A Fase 10 inclui o fix `4160d98` (CR-02 *da Fase 10 / DA-5*) que muda o comportamento do encerramento: `restartGaveUpRounds()` e o `onStartup`. Nosso lado ainda não tem `restartGaveUpRounds` (`git grep` em `946a361`: 0 ocorrências). Atenção ao nome "CR-02": a nossa Fase 8 tem outro CR-02 (o do `/meet/<código>` que encerra a call, ver memória do projeto). Não são o mesmo problema.
- O `10-UAT.md` diz "7 testes, nenhum executado": ninguém viu a aba AGP no Chrome real.
- Limitações já registradas pela própria branch (`PENDENCIAS-FASE-10.md`): o WebSocket `/ws/{session_id}` do backend **não tem autenticação**; conectar nele **cria o pipeline** da sessão (laço de IA 15/30 s); só mostra, não fixa/descarta; pin/dismiss do site não chega à Taqciti.
- Pelo CLAUDE.md (Fluxo de Git, regra 5: uma fase por branch) a Fase 10 deveria entrar por branch/PR própria depois da Fase 9, não dentro da `chore/integra-master-e-main`.

**Não consegui verificar** (somente leitura): se os testes da Fase 10 passam em cima do nosso código (`npm test` em `taqciti/`); se o backend do nosso lado emite `question_expired` (confirmei só `question_new`, em `backend/app/services/pipeline.py:400`, e a rota `/ws/{session_id}` em `backend/app/routers/ws.py:17`); se `agpBackendSmoke.test.ts` roda sem o backend subido.

---

## 6. Proposta de ordem de merge para `chore/integra-master-e-main`

**Princípio:** como a master não traz nada novo, o objetivo do merge é só **registrar a história da master como ancestral** e terminar com a árvore **exatamente igual à nossa**. Evitar resolver conflito a conflito: o `-X ours` já mostrou que deixa lixo (função duplicada em `webhook.py`).

### Passo 1 — Merge "tudo nosso" (1 commit)

Na branch `chore/integra-master-e-main` (que está na ponta da master): fazer o merge de `feat/fase-09-cutover-retire-custom-extension` sem fechar, e então forçar o índice e a pasta de trabalho para a árvore do nosso lado, e só depois commitar. Resultado: um commit de merge com pais = (master, nosso lado) e árvore = a do nosso lado.
Equivalente mais seguro (não mexe na pasta de trabalho até conferir): criar o commit com `git commit-tree 946a361^{tree} -p origin/master -p 946a361` e só então apontar a branch para ele.
**Conferência obrigatória antes de seguir:** `git diff --stat feat/fase-09-cutover-retire-custom-extension chore/integra-master-e-main` precisa estar **vazio**. Isso vale enquanto a master continuar em `2e67c7c`: se alguém empurrar algo novo nela, refazer a análise (3 comandos da seção 7).

Se, mesmo assim, o time preferir o merge "normal" com resolução manual, a ordem sugerida é: (1) `.planning/` (5), (2) `backend/` (2), (3) `frontend/` (2), (4) `taqciti/` (37), sempre `git checkout --ours`/versão do nosso lado, e **depois** `git diff 946a361 HEAD` tem de ficar vazio. Sem essa conferência final a armadilha do `webhook.py` passa.

### Suítes entre os passos
Rodar uma vez como linha de base (no nosso lado, antes do merge) e uma vez depois do Passo 1 (devem dar o mesmo resultado, já que a árvore é a mesma):
- Backend: `cd backend && pytest` (inclui `test_webhook_idempotency.py`, `test_extension_chunk_extra_fields.py`, `test_pipeline_get_or_create_lock.py`).
- Frontend: `cd frontend && npm run lint && npx tsc -b && npx vitest run && npm run build`.
- Taqciti: `cd taqciti && npm run lint && npm run typecheck && npx vitest run && npm run build` (os nomes exatos dos scripts devem ser conferidos no `package.json`; não rodei nada).
- Extensão antiga: `cd extension && node --test` (4 arquivos em `extension/tests`).

### Passo 2 — `main`
Levar o resultado para a `main` (PR ou fast-forward). Nota: `origin/main` está em `638f0f7` (15/10) e a `main` local `5944748` tem **196 commits a mais** que ela, ainda não empurrados. O merge para a `main` empurra tudo isso de uma vez (Fases 8 e o que há de Fase 9).

### Passo 3 — `master` (deploy)
Como o Passo 1 faz da master ancestral, `master` avança por fast-forward até a `main`. Antes de empurrar (Railway/Vercel):
- Lembrete da memória do projeto: criar `GEMINI_API_KEY` no Railway (chave opcional por projeto, D-15, depende disso).
- **Migration** `20261011000000_add_chunk_id_to_transcript_chunks.sql` (existe no nosso lado, não na master): o webhook novo grava `chunk_id`. Não consegui verificar se ela já foi aplicada no Supabase de produção; aplicar **antes** do deploy do backend.
- `EXTENSION_SHARED_KEY` (Fase 6) continua opt-in; sem ela nada muda.

### Passo 4 (separado) — Fase 10
Fazer em branch própria cortada da `main` já atualizada, `git merge origin/feat/fase-10-agp-question-panel` (1 conflito, seção 5), e rodar de novo a suíte da Taqciti.

### Armadilhas que ficam
1. Arquivos que o git considera resolvidos mas misturam versões: `webhook.py` (duplicação comprovada por `-X ours`), `projects.py` (bloco D-15), e, num merge comum sem conflito, silenciosamente certos mas só porque o nosso lado é superconjunto: `models/projects.py`, `sessions.py`, `pipeline.py`, `main.py`, `routers/__init__.py` (a master não tem `extension_clients_router` em `main.py`/`routers/__init__.py`; escolher a versão da master nesses arquivos desligaria a rota de clientes da Fase 8).
2. **Nunca** usar `-X theirs` nem "aceitar a master" em `taqciti/`: as versões da master são da Fase 7, e escolher o lado errado num dos 37 arquivos derruba a Fase 8 (chunk_id, vínculo por reunião, fila de saída) sem nenhum erro de compilação óbvio. Os 213 arquivos que só existem do nosso lado não somem sozinhos num merge, mas os 37 em conflito sim, se o lado errado for escolhido. (Não simulei o `-X theirs`; é um risco por raciocínio, não medido.)
3. Local `main` sem push: se alguém fizer `git pull` da `origin/main` na máquina errada, vai divergir.
4. Existe `.planning/config.json` modificado e não commitado na branch atual; não faz parte da integração, mas atrapalha `git merge` limpo (stash/commit antes).
5. O `origin/feat/redesign-ui-citi` tem 1 commit a mais que o nosso lado (`6ddb089`, 15/10, "atualiza data da última sessão", só `.planning/STATE.md` e `feature-flow-state.md`): é ruído de docs, pode ficar de fora.

---

## 7. O que ficou sem verificar e perguntas abertas

**Não verificado (somente leitura, sem rodar nada):**
- Nenhuma suíte foi executada (pytest, vitest, tsc, lint, build). Não sei se o nosso lado está verde hoje.
- Se a migration do `chunk_id` já foi aplicada em produção; qual é o estado real do Railway/Vercel (e se a master está deployada em `2e67c7c`).
- O conteúdo do `.planning/config.json` modificado (fora do escopo).
- Os 49 arquivos "diferentes mas sem conflito": confirmei que o resultado do merge não os altera em relação ao nosso lado, mas não li um a um.
- Se `taqciti/server` (120 arquivos) é usado no deploy: são idênticos nos dois lados, então não influencia.
- Fase 10: execução dos testes, `question_expired` no backend, comportamento real no Chrome.
- Reconferir `frontend/` se saírem novos commits depois de `946a361`.
- Escrevi arquivos temporários de apoio (listas de arquivos) em `/tmp` do Git Bash, fora do repositório; nada no repo além deste documento.

**Perguntas para o time:**
1. Confirmam a estratégia "árvore final = nossa, master só como ancestral"? (Descarta qualquer chance de a master ter trabalho não empurrado em outro lugar; vale perguntar ao autor da master, gabrielmezzalira, se há algo local dele.)
2. A Fase 10 entra antes do deploy (junto da Fase 9) ou depois, em PR próprio? O plano de testes manuais da Fase 9 (`05c9998`) fala em "pós-Fase 10", então a ordem precisa ser decidida.
3. A migration do `chunk_id` já está em produção?
4. `EXTENSION_URL` (release `v1.0.0` da extensão antiga) e a página `/extension`: o plano 09-04 diz "sem link de download por enquanto"; fica assim no deploy?
5. O WebSocket `/ws/{session_id}` sem autenticação é aceitável para a Fase 10 em produção (decisão em aberto já listada pela branch da Fase 10)?
6. Depois da integração, as branches `chore/promover-recentes-master`, `chore/sync-main-to-master` e `feat/redesign-ui-citi` podem ser apagadas do remoto?
