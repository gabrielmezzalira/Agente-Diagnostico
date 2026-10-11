# Phase 8: Taqciti Session Association - Context

**Gathered:** 2026-10-11
**Status:** Ready for planning — com 3 DECISÕES DO TIME em aberto (ver seção no fim). Não executar as tasks que dependem delas antes de o time decidir.

<domain>
## Phase Boundary

A Taqciti (extensão de captura do Google Meet, agora dentro deste repositório em `taqciti/`) passa a
saber **para qual sessão do Agente Diagnóstico** mandar a fala de cada reunião — e só manda quando o
vínculo é explícito, nunca por palpite.

Esta discussão **troca o mecanismo** que o ROADMAP descrevia para esta fase. O ROADMAP previa
auto-detecção por `localStorage['agente_session_id']` + campo manual de ID. A direção passa a ser um
**seletor de cliente por reunião**, com o campo manual de ID mantido como plano B escondido.

Fora do escopo desta fase: a aba AGP com as perguntas ao vivo (Fase 10), o cutover do extension
antigo (Fase 9), a integração com a plataforma AGM e o login (ver "Deferred Ideas").

</domain>

<decisions>
## Implementation Decisions

### Vínculo sessão ↔ reunião
- **D-01:** O vínculo passa a ser feito por um **seletor de cliente por reunião**, no lugar da
  auto-detecção por `localStorage`. Os critérios 1 e 2 do ROADMAP da Fase 8 precisam ser reescritos
  com esse mecanismo (tarefa de documentação, junto com TAQ-02 em `REQUIREMENTS.md`).
  — **Reversibility:** costly — o auto-detect poderia voltar como sugestão, mas exigiria um script
  rodando dentro do domínio do Agente (o `localStorage` do site não é lido pela extensão direto), e o
  valor de `agente_session_id` só existe enquanto a tela de monitoramento está aberta
  (`frontend/src/pages/SessionActivePage.tsx`, linhas 683–691).
- **D-02:** O campo de colar o código da sessão (Fase 7, D-04/D-05) **fica escondido como plano B**.
  Só aparece quando a lista de clientes não carrega. Mantém o critério 2 do ROADMAP.
- **D-03:** Ao escolher o cliente, a Taqciti **cria uma sessão nova** no Agente. Cada reunião tem a sua
  própria sessão. A forma de criar (rota) está em D-13 e D-16.

### Fluxo agora / depois / descartar
- **D-04:** Adota-se o **modelo B** agora. "Depois" guarda a reunião **só no Taqciti**
  (`chrome.storage.local`), sem enviar nada ao Agente, até a pessoa escolher o cliente.
  — **Reversibility:** reversible — é código e configuração da extensão.
- **D-05:** A migração futura para o **modelo A** (sessão provisória com envio ao vivo mesmo sem cliente)
  fica **para depois** e é aditiva: entra ao lado do B, sem apagar o que já foi feito. Exige decisão de
  banco na época (ver "Deferred Ideas"). Custo registrado: o gasto de IA das perguntas geradas na
  sessão provisória pode ser refeito depois da ligação ao cliente.
- **D-06:** Fechar o aviso de detecção **sem escolher** conta como **"Depois"**. Nada é enviado.
- **D-07:** O aviso aparece como um **ícone "!" da Taqciti que sobe e desce levemente a cada 5 segundos**,
  e continua assim **até a pessoa abrir**. Ao clicar, abre a mensagem com as opções "Selecionar cliente
  agora" e "Depois". A localização exata do ícone (dentro do Meet ou na barra do Chrome) fica para a
  fase de UI (`/gsd-ui-phase`).
- **D-08:** "Selecionar cliente agora" abre uma **lista pesquisável de clientes**, com a opção de
  **criar cliente novo**.
- **D-09:** No **fim da reunião**, a Taqciti pergunta para qual cliente enviar ou se descarta. O mesmo
  pedido também fica disponível por um **botão no painel** (para quem quiser fazer depois).
- **D-10:** O envio da reunião guardada, no fim, é **em blocos, na ordem em que foi falada**, com pausa
  entre os blocos. Não é tudo de uma vez. A rajada ainda não foi testada no backend (ver D-20).
- **D-11:** "Descartar" **pede confirmação** e apaga a reunião **do histórico local do Taqciti**.
  Como no modelo B nada foi enviado, não há o que apagar no backend. A ação é irreversível.
  — **Reversibility:** one-way — apaga a transcrição guardada na extensão, sem volta.
- **D-12:** Se o cliente for escolhido **no meio da reunião**, a **reunião inteira** (tudo o que ficou
  guardado desde o início) vai para a sessão escolhida. A reunião é uma só, e o vínculo é da reunião.

### Criação de cliente e de sessão (contratos)
- **D-13:** "Criar cliente novo" pela Taqciti usa uma **rota nova só para isso**, e **não** o
  `POST /sessions/start`. Esse endpoint é da integração com o CITi Flow: busca briefings de lá e cria
  um segredo no Vault a cada chamada (`backend/app/routers/sessions.py`, linhas 43–75).
  — **Reversibility:** costly — é um contrato novo da API. **DECISÃO EM ABERTO do time** (ver abaixo).
- **D-14:** Cliente criado só com **nome** é aceito. Tipo de projeto, maturidade (DMS) e contexto são
  completados depois, no web app. Até lá, as perguntas ao vivo saem genéricas — isso foi aceito.
- **D-15:** A **chave Gemini deixa de ser obrigatória na criação de projeto**, em todo o cadastro (web
  app e Taqciti). O padrão passa a ser a **chave do servidor** (`GEMINI_API_KEY`, que o pipeline já usa
  como fallback em `backend/app/services/pipeline.py`, por volta das linhas 660–674). Chave própria por
  projeto fica **opcional**, configurada depois. O Precificador não é afetado: ele usa a chave própria
  `pricing_api_key`, separada.
  — **Reversibility:** costly — muda o contrato `ProjectCreate.gemini_api_key`
  (`backend/app/models/projects.py`, obrigatório hoje) e o formulário do web app (F1).
  **DECISÃO EM ABERTO do time** (ver abaixo).

### Segurança, falhas e reenvio
- **D-16:** Listar clientes, criar cliente e criar sessão, feitos pela Taqciti, passam por **rotas
  próprias da extensão**, sob `/webhook/extension`, protegidas pelo header `x-agente-key` (mesmo gate da
  Fase 6, D-10). O web app **não muda**. Decisão de que a criação de sessão também passa por essa rota
  é Claude's Discretion, por consistência.
  — **Reversibility:** costly — são rotas novas de contrato. **DECISÃO EM ABERTO do time** (ver abaixo).
- **D-17:** O `GET /projects` e o `GET /sessions` atuais **ficam como estão**, sem proteção. Decisão do
  usuário. Fica **registrado como risco de LGPD**: quem tiver a URL do backend lista os clientes. Fecha
  quando houver login (AGM ou TAQF-02).
- **D-18:** Quando o Agente cai no meio da reunião ao vivo, as falas que não chegaram são **guardadas no
  Taqciti e reenviadas** quando o Agente voltar. A pessoa é **avisada na tela** de que o Agente está fora
  do ar. Isso **reabre a decisão 2-B do WR-04** da Fase 7 (que aceitava perder o trecho).
  — **Reversibility:** costly — muda a política de envio em `taqciti/src/features/agente/` e
  `taqciti/src/background/agenteSender.ts`.
- **D-19:** O reenvio pode **duplicar trecho** se o backend gravou e a resposta se perdeu. Evitar isso
  exige um **identificador por trecho** (ex.: `chunk_id` gerado na Taqciti e reaproveitado nas
  tentativas) e o backend ignorando um id repetido. Hoje o `POST /webhook/extension` faz `insert` direto
  (`backend/app/routers/webhook.py`). Isso é mudança de contrato. **DECISÃO EM ABERTO do time**.

### Validação
- **D-20:** A fase só é dada por encerrada com **testes automáticos** (Taqciti e backend) **mais um
  teste manual no Chrome com uma reunião real no Meet**, como foi feito na Fase 7. O teste manual cobre:
  (a) envio em blocos no fim da reunião, (b) queda do Agente com aviso e reenvio, (c) descarte com
  confirmação, (d) escolha do cliente no meio da reunião.

### Claude's Discretion
- Nomes exatos dos campos e textos da UI, seguindo o padrão de
  `taqciti/src/sidepanel/screens/AgenteConfigScreen.tsx`.
- Tamanho dos blocos do envio em D-10 e a pausa entre eles. Definir no planejamento e validar com o teste
  de D-20.
- Quantas tentativas e quanto tempo esperar antes de considerar o Agente "fora do ar" (hoje são 3
  tentativas com espera de 1, 2 e 4 s, em `AGENTE_SEND_MAX_RETRIES`).
- Formato e códigos de erro das rotas novas de D-16. Seguir o padrão 401 da Fase 6.
- Onde exatamente o ícone de D-07 fica, dentro das opções que a UI permitir.
- A lista de clientes deve ficar atrás de uma **interface** (inversão de dependência do CLAUDE.md), para
  que a origem dos clientes possa mudar (ex.: AGM) sem reescrever o seletor.

### DECISÕES DO TIME (em aberto — não decidir sozinho)
1. **Rotas novas da extensão** (listar clientes, criar cliente, criar sessão) — D-13 e D-16. Mudança de
   contrato da API.
2. **Remover a exigência da chave Gemini** em `ProjectCreate` e no formulário do web app — D-15. Mudança
   de contrato da API.
3. **Identificador por trecho no webhook** para evitar duplicata no reenvio — D-19. Mudança de contrato
   do webhook.

Enquanto essas três não forem decididas, o planejamento pode preparar o restante, mas as tasks que
dependem delas ficam bloqueadas.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap e requisitos
- `.planning/ROADMAP.md` §"Phase 8: Taqciti Session Association" — objetivo e 3 critérios. O critério 1
  (auto-detect) é substituído por D-01; o critério 2 (fallback manual) é mantido por D-02; o critério 3
  (vínculo explícito) vale integral.
- `.planning/REQUIREMENTS.md` §"Taqciti Transcription (TAQ)" — TAQ-02 (esta fase). Atualizar o texto
  para o seletor.
- `.planning/PROJECT.md` §"Key Decisions" — a linha "Streamer groups words into phrases..." e a de
  "Adopt Taqciti capture engine..." são o contexto da Fase 7 que esta fase continua.
- `.planning/ROADMAP.md` §"Phase 10: AGP Question Panel in Taqciti" — depende de D-04/D-05 (vínculo
  explícito) e fica com decisões em aberto por causa do AGM (ver "Deferred Ideas").

### Decisões anteriores que esta fase usa
- `.planning/phases/07-taqciti-config-background-streamer/07-CONTEXT.md` — D-04 e D-05 (campo manual de
  session_id, não descartável), D-06 (debounce do `sessionController`), D-07 (envia só o delta), D-10
  (header `x-agente-key`).
- `.planning/phases/07-taqciti-config-background-streamer/07-DECISOES-REVIEW-2.md` — a seção
  **"Entregue para a Fase 8"** com a proposta original e os pontos abertos que esta discussão respondeu;
  as decisões do CR-01 (vínculo `boundMeetingId`, opção A) e do WR-04 (opção 2-B, reaberta por D-18); os
  "limites conhecidos" do CR-01.
- `.planning/phases/06-opt-in-webhook-auth/06-CONTEXT.md` — gate `x-agente-key` / `EXTENSION_SHARED_KEY`,
  reaproveitado por D-16.

### Código a alterar — Taqciti (`taqciti/`, já neste repositório)
- `taqciti/src/shared/config/agenteBindingStore.ts` — o vínculo "sessão → reunião" (CR-01). Base do
  seletor (D-01/D-03). Função `boundMeetingFor`.
- `taqciti/src/shared/config/agenteConfig.ts` e `agenteConfigStore.ts` — config do backend e da chave.
- `taqciti/src/sidepanel/screens/AgenteConfigScreen.tsx` — tela onde fica o campo manual de ID (D-02).
- `taqciti/src/background/agenteStreamer.ts`, `agenteStreamerInstance.ts`, `agenteStreamerSnapshot.ts` —
  o streamer que liga o vínculo ao envio.
- `taqciti/src/background/agenteSender.ts` e `taqciti/src/features/agente/sendRetryPolicy.ts` — política
  atual de retry (D-18).
- `taqciti/src/features/agente/phraseBatcher.ts` e `wordDelta.ts` — agrupamento e delta do envio ao vivo.
- `taqciti/src/features/meeting/machine.ts` — máquina de estados da reunião. Base para detectar o fim da
  reunião (D-09). Confirmar na planning.
- `taqciti/src/background/history.ts` e `taqciti/src/features/history/` — histórico local. Base de
  "descartar" (D-11).
- `taqciti/src/background/injectPanel.ts` — painel injetado no Meet. Candidato a receber o ícone de D-07.

### Código a alterar — backend do Agente (já neste repositório)
- `backend/app/routers/webhook.py` — `extension_webhook()` e `verify_extension_key()`. Base de D-16 e
  D-19.
- `backend/app/routers/sessions.py` — `POST /sessions` (exige `project_id`), `POST /sessions/start` (CITi
  Flow; não usar para criar cliente — D-13).
- `backend/app/routers/projects.py` — `GET /` (aberto, D-17) e `POST /` (exige a chave Gemini, D-15).
- `backend/app/models/projects.py` — `ProjectCreate.gemini_api_key` obrigatório (D-15).
- `backend/app/models/sessions.py` — `SessionCreate` exige `project_id`.
- `backend/app/services/pipeline.py` — fallback da chave em `GEMINI_API_KEY` (D-15).

### Banco
- `supabase/migrations/20260524000000_initial_schema.sql` — `sessions.project_id uuid NOT NULL REFERENCES
  projects(id)`. É o motivo de o modelo A exigir decisão de banco (D-05).

### Referências do projeto
- `CLAUDE.md` §"Regras de Planejamento de Tasks" — todo plano de task precisa das 7 seções (o que muda,
  como muda, riscos, prevenção, rollback, decisões do time, verificação). Vale para o planejamento desta
  fase.
- `CLAUDE.md` §"Segredos" — não ler `.env` nem `taqciti/server/.env.local`.

No external specs beyond the above — requisitos capturados nas decisões acima.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `agenteBindingStore.ts`: já grava o par `{sessionId, meetingId}` em `chrome.storage.local` e tem a
  função `boundMeetingFor`. O seletor generaliza esse vínculo; não é descartado (ver nota no
  `07-DECISOES-REVIEW-2.md`).
- `sendRetryPolicy.ts` e `agenteSender.ts`: retry com espera crescente. Base do reenvio de D-18.
- `phraseBatcher.ts`: agrupamento de falas por silêncio. Pode servir de base para o envio em blocos de
  D-10.
- `history.ts`: histórico local de reuniões (até 100, segundo o documento da Fase 7). Base de "Depois" e
  "Descartar".

### Established Patterns
- Integração com o Agente é **fire-and-forget**, sem bloquear a captura do Meet (Fase 7). Vale para
  D-18: a fila de reenvio não pode travar o Meet.
- Gate opcional por `x-agente-key` (Fase 6). D-16 reaproveita o mesmo mecanismo.
- Config vem de `VITE_AGENTE_*` no build e pode ser editada em runtime (Fase 7, D-08).
- Routers do backend só roteiam. Lógica em services, acesso ao banco em repositories (CLAUDE.md).

### Integration Points
- `POST /webhook/extension` recebe `{session_id, text, speaker}`. Não há campo de timestamp; a ordem é a
  ordem de inserção. Por isso o envio em blocos (D-10) precisa respeitar a ordem.
- `POST /sessions` cria a sessão de uma reunião, com `project_id` obrigatório.
- A aba AGP da Fase 10 vai ler a sessão vinculada desta fase (pelo WebSocket `/ws/{session_id}`).

### Fatos verificados nesta discussão
- O `localStorage['agente_session_id']` só é gravado enquanto a tela `SessionActivePage` está aberta
  (`frontend/src/pages/SessionActivePage.tsx`, 683–691).
- `sessions.project_id` é `NOT NULL` no schema inicial. Sessão sem cliente não existe hoje.
- O `pipeline` usa `GEMINI_API_KEY` quando o projeto não tem chave própria.
- O Precificador usa `pricing_api_key`, separada da chave Gemini.

</code_context>

<specifics>
## Specific Ideas

- O aviso é um **ícone que sobe e desce** a cada 5 segundos, com uma exclamação pequena, como uma
  notificação. Ao clicar, aparece a mensagem. Pedido literal do usuário.
- O usuário chama a solução atual de **"AGP"**, e a plataforma com a qual vamos integrar de **"AGM"**. O
  AGM é "uma plataforma com login, feita para os times de DEV, dados e produto". O AGM não aparece em
  nenhum documento do repositório hoje.
- A tela onde o ícone aparece e a lista de clientes são duas telas novas. Passam pelo `/gsd-ui-phase`
  antes da implementação (regra da proposta original).

</specifics>

<deferred>
## Deferred Ideas

- **Migrar do modelo B para o modelo A** (sessão provisória com envio ao vivo mesmo sem cliente). Aditiva.
  Exige decisão de banco: projeto provisório ou `project_id` opcional. Quando o time precisar de perguntas
  ao vivo em reuniões sem cliente.
- **Perguntas só por clique.** Verificado: `_run_question_planner` só é chamado por `trigger_questions`,
  que roda com `POST /sessions/{id}/questions/generate` ou com o evento WebSocket `generate_questions`. Não
  há ciclo automático, embora a especificação (F5) fale em "ciclo automático". Discutir na Fase 10, porque
  afeta "atualizar conforme o backend emite".
- **Banco de perguntas sem filtro por tipo.** `pipeline.py` (por volta da linha 670) carrega todas as
  linhas de `question_bank`, sem filtrar por `project_types`. A especificação (F4) pedia filtro. Discussão
  própria.
- **Tipo de projeto fora do discovery.** `generate_questions` recebe `project_type`, mas não o usa no
  prompt. Discussão própria.
- **Conexão com o AGM.** Ainda não definida. Pode mudar o destino da aba AGP (Fase 10) e a origem da lista
  de clientes. O usuário quer detalhar depois.
- **Aba AGP numa reunião "Depois", sem cliente.** Ficou sem decisão. Depende do destino AGM e da Fase 10.
- **Login** (TAQF-02, ou o login do AGM) para fechar `GET /projects` (D-17).
- **Enviar as mudanças de volta para o repositório `taqciti` original** — continua adiado (Fase 7, D-03).

### Reviewed Todos (not folded)
None — `todo.match-phase` retornou 0 resultados para a Fase 8.

</deferred>

---

*Phase: 8-Taqciti Session Association*
*Context gathered: 2026-10-11*
</content>
