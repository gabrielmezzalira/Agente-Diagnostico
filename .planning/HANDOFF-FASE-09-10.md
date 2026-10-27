# HANDOFF — Fechar a Fase 8 e preparar as Fases 9 e 10

**Escrito em:** 2026-10-26 (noite) · **Branch atual:** `feat/fase-08-taqciti-session-association`
**Para quem:** a próxima sessão (outra conta/PC). A memória do Claude NÃO viaja entre contas; tudo que importa está aqui e em `.planning/`.
**Regra desta rodada (pedido do usuário):** deixar tudo **documentado antes de agir**. Nada abaixo foi executado, só planejado.

> Leia também: `CLAUDE.md` (português, SOLID, **nunca ler `.env`**, plano de task com 7 seções, branch por fase),
> `.planning/phases/08-taqciti-session-association/08-DECISOES-PENDENTES.md` (decisões do time) e
> `08-REVIEW-DISPOSITION.md` (achados da revisão).

---

## 1. Onde estamos

| Item | Estado |
|------|--------|
| Fase 8, planos | 28/28 executados (o 28 fechou o CR-02) |
| Fase 8, UAT | `08-UAT.md` **135/135 passados**, 0 problemas (testes 133 a 135 = roteiro do Meet real do CR-02, feitos em 2026-10-26) |
| Fase 8, verificação | `08-VERIFICATION.md` = **passed** (commit `fc925c1`) |
| Fase 8, segurança / UI | `08-SECURITY.md` threats_open 0; `08-UI-REVIEW.md` 19/24 |
| Fase 8, revisão de código | `08-REVIEW.md`: 0 críticos abertos (CR-01 e CR-02 `fixed`); **WR-01 a WR-09 e IN-01 a IN-15 seguem `open`** |
| ROADMAP / STATE / REQUIREMENTS | **ainda dizem Fase 8 "EXECUTING/verifying" e TAQ-02 "Pending"**. A transição NÃO foi feita (decisão do usuário abaixo) |
| Git | 210 commits à frente da `main`; **34 à frente do remoto** (nada empurrado). `.planning/config.json` aparece modificado (CRLF/`effort sync`), ignorar |
| Dados de teste em produção | Limpos em 2026-10-26 (tarde). **Sobraram 2 sessões desta noite**, ambas encerradas: `ce75b9af-d3d9-40de-b6e5-00ae38553f91` e `6cd362ad-cdc1-425f-8aca-d23d6a451d03`. Apagar no fim (sessões primeiro, depois projeto `ZZ-TESTE-D20…` se existir). NÃO apagar o cliente real `visus` |

Observação de UX, não é gap (registrada no `08-UAT.md`, "Observações para o time" nº 4): "Selecionar cliente" só aparece depois de clicar na bolha "!". É o desenho (a bolha avisa sem interromper a reunião).

---

## 2. ANTES da Fase 9: fechar a Fase 8 (regra do CLAUDE.md, passo 3 do fluxo de git)

> "Só corte a branch da fase seguinte depois que a fase atual estiver concluída, revisada e com o `code-review --fix` mergeado."

Checklist, em ordem. Cada item marcado **DECISÃO** é do time, não do executor.

- [ ] **DECISÃO — triar os WR-01 a WR-09.** Quais entram num `/gsd-code-review 8 --fix` e quais viram follow-up. Os que mais pesam:
  - **WR-01:** rotas novas da extensão ficam abertas se `EXTENSION_SHARED_KEY` não estiver definida (`backend/app/routers/webhook.py:26-28`). Risco T-08-10, aceito pelo "Time Antonio" **só até o login do AGM**.
  - **WR-02:** "Apagar" do histórico remove a associação sem encerrar a sessão (afeta só fila não vazia ou envio falho).
  - **WR-04 / WR-05:** "Continuar envio" pode pular palavras do último segmento; reinício do service worker com vínculo ao vivo deixa o envio parado.
- [ ] **DECISÃO — DA-4 e DA-5** (hoje implementados nas opções *recomendadas*, a confirmar): DA-4 `navegar-encerra` (commit `566a005`, e o teste 134 provou que sair da sala encerra) e DA-5 `nova-rodada-no-boot` (commit `32c029b`). Cada um se desfaz com `git revert`.
- [ ] **DECISÃO — itens que ninguém decidiu:** remover o código da Fase 7 (`confirmNewMeeting`, `confirmedMeetingId`, `configDestination`, texto "confirme abaixo"; é remoção + mexe no formato da config guardada no navegador); aviso de histórico cheio de reuniões não enviadas (decisão de produto e UI); a observação nº 1 do UAT (envio preso em "Enviando…" por service worker dormindo: guarda por alarme ou aceitar o risco).
- [ ] **Rodar `/gsd-code-review 8 --fix`** (modelo `opus`, esforço `high`) e mergear o resultado.
- [ ] **Empurrar a branch e abrir o PR para a `main`** (decisão de empurrar é do usuário; nada foi ao remoto). O merge vai para a `main`; **o deploy sai da `master`** (`chore/sync-main-to-master` existe).
- [ ] **Fora do código, antes de qualquer deploy/merge na `main`/`master`/junção com o AGM:**
  - [ ] **Criar `GEMINI_API_KEY` no Railway** (hoje NÃO existe; sem ela, projeto sem chave própria não roda IA nem importa PDF). O valor da chave nunca vai em conversa nem em arquivo do repo; peça a quem tem.
  - [ ] Conferir/ativar `EXTENSION_SHARED_KEY` no Railway (ver WR-01).
  - [ ] **Ordem do rollout:** migração `chunk_id` (JÁ aplicada em produção) → deploy do backend → build da Taqciti. Não distribuir build da Taqciti antes de o time dar o D-20 por fechado.
- [ ] **Transição da fase** (só depois do PR mergeado, ou antes se o time preferir marcar já): marcar Fase 8 concluída em `ROADMAP.md` e `STATE.md`, TAQ-02 → Complete em `REQUIREMENTS.md` (linhas 40 e 94). O verificador não mexe em `REQUIREMENTS.md`.
- [ ] **Limpar a documentação velha:** `.planning/RETOMAR-AQUI.md` e `.planning/PENDENCIAS-FASE-08.md` são de 2026-10-12 e estão desatualizados (ver seção 6). Os dois apontam para este arquivo.

---

## 3. Fase 9: Cutover + aposentar a extensão customizada (TAQ-04)

**Objetivo (ROADMAP):** a Taqciti é a única fonte de transcrição em produção; o diretório `extension/` sai do repo, e o contrato do backend que ela usava fica intacto para os dados históricos.
**Depende de:** Fases 6, 7 e 8. **Critérios de sucesso:**
1. Uma sessão de discovery completa (transcrição, atualizações de cobertura, perguntas e relatório final) roda ponta a ponta usando **só a Taqciti**.
2. `extension/` e o zip empacotado saem do repositório.
3. `/webhook/extension`, o modelo `ExtensionChunk` e o valor `extension` do enum de `source` continuam no backend, para sessões históricas.

### 3.1 Mapa do que existe hoje (levantado em 2026-10-26, só leitura)

| O quê | Onde | Nota para o cutover |
|-------|------|---------------------|
| Extensão antiga (código) | `extension/` (`background.js`, `content_app.js`, `content_meet.js`, `popup.js`, `popup.html`, `manifest.json`, `lib/`, `tests/`, `package.json`) | É o que sai |
| Zip empacotado | `agente-diagnostico-extension-v1.0.0.zip` (raiz do repo) | Sai. Continua no histórico do git |
| Página "Instalar extensão" do web app | `frontend/src/pages/ExtensionPage.tsx`, `navItems.ts`, `App.tsx`, `HomePage.tsx`, `lib/api.ts`, `lib/labels.ts`, `ProjectFormPage.tsx`, `SessionActivePage.tsx`, `SessionSetupPage.tsx` mencionam "extension" | Hoje manda baixar o zip da extensão ANTIGA v1.0.0. **Precisa apontar para a Taqciti** ou ser removida |
| Documentação que cita `extension/` | `CLAUDE.md` (seção 10), `diagnostico/README.md`, `PLANO_AJUSTES.md` | Atualizar |
| **Rota que NÃO pode sair** | `POST /webhook/extension` (`backend/app/routers/webhook.py`) | ⚠️ **A Taqciti usa a MESMA rota** (Fase 7), com `x-agente-key`. Aposentar a extensão antiga NÃO é aposentar a rota |
| Rotas novas da Taqciti | `backend/app/routers/extension_clients.py` (`/webhook/extension/clients`, `/sessions`, `/sessions/{id}/finish`) | Ficam. O nome "extension" no backend passa a significar "a extensão que manda transcrição" (hoje, a Taqciti) |
| Enum de `source` | valor `extension` | Fica. As sessões da Taqciti também usam `source=extension` (confirmado no banco no UAT 6/10) |
| Taqciti | `taqciti/` (subtree importado na Fase 7). `taqciti/docs/publicar-release.md`, `taqciti/INSTALL.md`, `taqciti/installer/{windows,macos,linux,guide}` | Distribuição da Taqciti já tem instaladores; ver DECISÃO 9-B |
| Worktrees antigas | `.claude/worktrees/rf-07-*` | Lixo de execuções da Fase 7; fora do escopo, só não deixar entrarem em greps |

### 3.2 Plano de alto nível (será detalhado pelo `/gsd-plan-phase 9`, que precisa ter as 7 seções do CLAUDE.md por task)

Ordem sugerida, em commits atômicos (uma mudança por commit, reversível sozinha; **nunca misturar correção com refator**):

| # | Ação | Natureza | Risco concreto | Prevenção | Rollback |
|---|------|----------|----------------|-----------|----------|
| 1 | **Prova de aceite do cutover (SC1):** reunião real, só com a Taqciti, com cliente `ZZ-TESTE`, até o relatório final; checar no banco `source=extension`, falas, `coverage_snapshots`, perguntas, `reports` | só verificação, sem código | Descobrir só aqui que algo (ex.: perguntas, relatório) dependia da extensão antiga | Fazer ANTES de qualquer remoção; registrar evidência num `09-UAT.md` | n/a |
| 2 | Atualizar a página "Instalar extensão" do web app para a Taqciti (texto + link/instrução de instalação) | muda comportamento (UI) | Usuário continua baixando o zip velho; ou link quebrado | Decidir 9-B antes; rodar a tela no navegador | `git revert` do commit |
| 3 | Remover `extension/` e o zip | remoção de código | Quebrar teste/CI que referencia a pasta; perder algo que só existia lá | `grep` global por `extension/` (já mapeado acima); rodar suítes do backend e do frontend; a pasta continua no histórico do git | `git revert` do commit (recupera tudo) |
| 4 | Atualizar docs (`CLAUDE.md` seção 10, `diagnostico/README.md`, `PLANO_AJUSTES.md`, `ROADMAP`, `PROJECT.md`) | só documentação | Doc dizendo que a extensão existe | Revisão por `grep` | `git revert` |
| 5 | **Teste de regressão do contrato** (semente real): garantir que `/webhook/extension`, `ExtensionChunk` e `source=extension` continuam respondendo/validando (estender `backend/tests/test_extension_clients.py` e testes do webhook) | teste | n/a | n/a | n/a |

### 3.3 Decisões em aberto da Fase 9 (**DECISÃO EM ABERTO: parar e perguntar antes de agir**)

- **9-A: "Taqciti validada" para valer o cutover.** TAQ-04 diz "depois que a Taqciti for validada". O UAT da Fase 8 (135/135, Meet real) basta, ou o time quer um período de uso real (quantas reuniões/dias) antes de remover a antiga?
- **9-B: como as pessoas instalam a Taqciti.** `.zip` servido pelo web app (como hoje), instalador em `taqciti/installer/*`, ou Chrome Web Store (`taqciti/docs/publicar-release.md`)? Isso define o que a `ExtensionPage` mostra.
- **9-C: remover ou só desativar?** Remoção é irreversível fora do git. O CLAUDE.md pede parar nesse tipo de decisão.
- **9-D: o que fazer com o rótulo "extension" no backend** (nome da rota, do enum, do `ProjectFormPage`/labels): manter como está (recomendado: o SC3 manda manter) ou renomear no futuro com migração.
- **9-E: janela de deploy.** Cutover só depois do deploy do backend com `GEMINI_API_KEY` e `EXTENSION_SHARED_KEY` no Railway (seção 2).

---

## 4. Fase 10: Painel de perguntas "AGP" dentro da Taqciti (TAQ-05)

**Objetivo (ROADMAP):** durante a call, as perguntas de discovery geradas pelo backend (cada uma com a lente produto/dados) aparecem quase em tempo real numa aba "AGP" da extensão Taqciti, escopadas à sessão vinculada.
**Depende de:** Fase 3 (perguntas com lente) e Fase 8 (vínculo explícito). Ambas prontas, então **a Fase 10 pode ser puxada para antes da 9** se o time quiser testar captura + perguntas na mesma call. Hoje o usuário quer 9 e depois 10.
**Público** (decisão do time): quem usa as perguntas é **produto/soluções** (não o comercial). A UI da Taqciti é a do operador da call.

**Critérios de sucesso:**
1. Com a Taqciti vinculada a uma sessão ativa, a aba "AGP" mostra a fila ao vivo daquela sessão, cada card com a lente produto/dados, atualizando conforme o backend emite perguntas.
2. As perguntas vêm do backend (reusando `/ws/{session_id}`, eventos `question_new`/`question_expired`); a Taqciti **não recalcula nem inventa**.
3. Só renderiza com vínculo **explícito** (Fase 8); sem sessão vinculada mostra estado vazio/convite, nunca perguntas de sessão "adivinhada".
4. Vive na Taqciti e **não atrapalha** a captura/envio (Fases 7-8) nem a visão de perguntas do web app (Fase 5).

### 4.1 Fatos levantados (só leitura, 2026-10-26) que o planejamento precisa respeitar

- O ROADMAP diz que a Taqciti "vive em repo separado". **Está desatualizado:** ela já está em `taqciti/` (subtree da Fase 7). Corrigir o texto no `/gsd-plan-phase 10`.
- `backend/app/routers/ws.py`: `/ws/{session_id}` **não tem autenticação**, chama `ws_manager.connect` antes de achar a sessão, e fecha com **código 4004** se a sessão não existe/não está ativa. Ao conectar, manda um `initial_state` (cobertura, red flags, perguntas `queued`/`pinned`, transcrição, budget). Aceita `generate_questions`, `force_classify`, `pin_question`, `dismiss_question`, `use_question`.
- Cada pergunta traz `expires_at` (TTL, `pipeline.py`); `question_expired` avisa quando some.
- **Cuidado de segurança:** navegador/extensão não conseguem mandar o header `x-agente-key` num WebSocket. Se o WS continuar aberto a qualquer um que saiba o `session_id`, o painel da Taqciti herda isso (e conectar a uma sessão cria o pipeline de IA: custo). É **DECISÃO 10-A**.
- Sessões encerradas pela Taqciti (Fase 8) fecham o WS com 4004; o painel precisa tratar isso como "reunião encerrada", não como erro.
- A Taqciti é uma extensão MV3: **service worker dorme**. Onde mora a conexão WS (service worker, painel lateral ou content script) muda tudo (reconexão, uma conexão por reunião, não duplicar). Ver o aprendizado da Fase 8 (o Chrome desliga o SW; estado precisa ser durável).
- O painel é shadow DOM no Meet + saída larga. Já há kit de UI (tema escuro CITi); fase marcada `UI hint: yes` → rodar `/gsd-ui-phase 10` (gera `UI-SPEC.md`).
- Para a Fase 10, o vínculo é `association.sessionId` (store de associações da Fase 8). Só `linked` vale (mesma regra do streamer: `agenteStreamDestination.ts`).

### 4.2 Decisões em aberto da Fase 10 (**parar e perguntar**)

- **10-A: autenticação do WebSocket.** Deixar aberto como hoje (aceito para o MVP, como o T-08-10), ou exigir um token/`?key=` na conexão? Mexe em contrato de API do backend.
- **10-B: a aba AGP só lê ou também age?** Mostrar perguntas só leitura (recomendado para o MVP), ou também fixar/descartar/usar e "Gerar agora" (reusa `pin_question` etc.)?
- **10-C: onde mora a conexão WS** (service worker com keepalive/alarme vs. painel aberto). É arquitetura, não detalhe.
- **10-D: o que aparece além de perguntas** (cobertura/red flags ficam fora do escopo; confirmar).
- **10-E: ordem 9→10 ou 10→9** (hoje: 9 e depois 10).

---

## 5. Ordem de trabalho proposta e política de modelo/esforço (CLAUDE.md)

Fluxo de git por fase (CLAUDE.md): `git checkout main && git pull` → `git checkout -b feat/fase-NN-slug` → só então GSD. A branch nasce da `main`, **não** da fase anterior.

| Passo | Comando | Modelo / esforço |
|-------|---------|------------------|
| 0 | Fechar a Fase 8 (seção 2) | `/gsd-code-review 8 --fix`: opus, high |
| 1 | `git checkout -b feat/fase-09-cutover-extension` (sobre a `main` já com a Fase 8) | n/a |
| 2 | `/gsd-discuss-phase 9` (resolver 9-A a 9-E) | o que a sessão estiver usando |
| 3 | `/gsd-plan-phase 9` (cada task com as 7 seções) | planner opus xhigh; checker xhigh (FIXO) |
| 4 | `/gsd-execute-phase 9` | executor sonnet; **esforço escolhido na hora** ajustando a sessão antes |
| 5 | `/gsd-code-review 9`, `/gsd-verify-work 9` | opus high; verify: sonnet high (preferência) |
| 6 | PR → `main`; só então `feat/fase-10-agp-question-panel` | |
| 7 | `/gsd-discuss-phase 10`, `/gsd-ui-phase 10`, `/gsd-plan-phase 10`, execute, review, verify | UI: sonnet high |

Teste manual: sempre explicar o passo a passo de COMO executar (preparo, onde clicar, o que observar). Backend local grava no Supabase de **produção**: usar só cliente `ZZ-TESTE…` e apagar no fim.

---

## 6. Documentos velhos para corrigir (tudo só documentação)

| Arquivo | Problema |
|---------|----------|
| `.planning/RETOMAR-AQUI.md` | De 2026-10-12: diz "27/27 planos, falta D-20". Hoje: 28/28, UAT 135/135, verificação passed |
| `.planning/PENDENCIAS-FASE-08.md` | Mesma data. O D-20 e o teste de DA-4 já foram feitos; os pontos de decisão seguem valendo |
| `.planning/STATE.md` | Fase 8 "EXECUTING", plano 28 de 28, `completed_phases: 7` |
| `.planning/ROADMAP.md` | Checkbox da Fase 8 vazio; Fase 10 diz "repo separado" |
| `.planning/REQUIREMENTS.md` | TAQ-02 Pending (linhas 40 e 94) |
| `frontend/src/pages/ExtensionPage.tsx` | Aponta para a extensão antiga (Fase 9, ação 2) |

---

## 7. Coisas que NÃO viajam e cuidados

- Memória do Claude (fora do repo) **não** vai para a outra conta. Tudo está neste arquivo. Se a conta nova tiver memória vazia, não é problema.
- `.env` e `taqciti/server/.env.local` **não estão no repo e nunca devem ser lidos** (CLAUDE.md). Peça valores a quem tem.
- Acessos que a conta nova pode precisar: Supabase (projeto `fzvwtkipzxdnubprvfct`, "Agente-Diagnostico"; conector do Claude ou SQL Editor), Railway (`GEMINI_API_KEY`, `EXTENSION_SHARED_KEY`), repositório (push/PR).
- Servidores locais que estavam rodando nesta sessão (backend em `127.0.0.1:8000`) morrem ao fechar a sessão: `cd backend && python -m uvicorn app.main:app --port 8000`; web app `npm --prefix frontend run dev` (porta 5173). Python no Windows: usar `127.0.0.1`, não `localhost`.
- A build da Taqciti (`taqciti/dist`) foi refeita nesta noite com todos os commits; depois de qualquer rebuild é preciso o ↻ em `chrome://extensions`.
- O pipeline de IA engole falhas do Gemini em silêncio (`except Exception: pass`): "sem saída" não prova "sem erro".
