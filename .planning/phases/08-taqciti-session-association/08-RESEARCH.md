# Phase 8: Taqciti Session Association - Research

**Researched:** 2026-10-11
**Domain:** Extensão Chrome MV3 (React 18 + Vitest) integrada a backend FastAPI + Supabase — vínculo explícito reunião → cliente → sessão, envio em blocos, fila de reenvio offline
**Confidence:** HIGH para o mapa do código existente e para as lacunas de contrato; MEDIUM para os valores de pacing e para o comportamento do PostgREST/supabase-py em duplicata (marcados `[ASSUMED]`)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Vínculo sessão ↔ reunião**
- **D-01:** O vínculo passa a ser feito por um **seletor de cliente por reunião**, no lugar da auto-detecção por `localStorage`. Os critérios 1 e 2 do ROADMAP da Fase 8 precisam ser reescritos com esse mecanismo (tarefa de documentação, junto com TAQ-02 em `REQUIREMENTS.md`). — Reversibility: costly.
- **D-02:** O campo de colar o código da sessão (Fase 7, D-04/D-05) **fica escondido como plano B**. Só aparece quando a lista de clientes não carrega. Mantém o critério 2 do ROADMAP.
- **D-03:** Ao escolher o cliente, a Taqciti **cria uma sessão nova** no Agente. Cada reunião tem a sua própria sessão. A forma de criar (rota) está em D-13 e D-16.

**Fluxo agora / depois / descartar**
- **D-04:** Adota-se o **modelo B** agora. "Depois" guarda a reunião **só no Taqciti** (`chrome.storage.local`), sem enviar nada ao Agente, até a pessoa escolher o cliente. — Reversibility: reversible.
- **D-05:** A migração futura para o **modelo A** (sessão provisória com envio ao vivo mesmo sem cliente) fica **para depois** e é aditiva. Exige decisão de banco na época. Custo registrado: o gasto de IA das perguntas geradas na sessão provisória pode ser refeito depois da ligação ao cliente.
- **D-06:** Fechar o aviso de detecção **sem escolher** conta como **"Depois"**. Nada é enviado.
- **D-07:** O aviso aparece como um **ícone "!" da Taqciti que sobe e desce levemente a cada 5 segundos**, e continua assim **até a pessoa abrir**. Ao clicar, abre a mensagem com as opções "Selecionar cliente agora" e "Depois". A localização exata do ícone fica para a fase de UI (`/gsd-ui-phase`) — já resolvida em `08-UI-SPEC.md`.
- **D-08:** "Selecionar cliente agora" abre uma **lista pesquisável de clientes**, com a opção de **criar cliente novo**.
- **D-09:** No **fim da reunião**, a Taqciti pergunta para qual cliente enviar ou se descarta. O mesmo pedido também fica disponível por um **botão no painel**.
- **D-10:** O envio da reunião guardada, no fim, é **em blocos, na ordem em que foi falada**, com pausa entre os blocos. Não é tudo de uma vez. A rajada ainda não foi testada no backend (ver D-20).
- **D-11:** "Descartar" **pede confirmação** e apaga a reunião **do histórico local do Taqciti**. Como no modelo B nada foi enviado, não há o que apagar no backend. A ação é irreversível. — Reversibility: one-way.
- **D-12:** Se o cliente for escolhido **no meio da reunião**, a **reunião inteira** (tudo o que ficou guardado desde o início) vai para a sessão escolhida. A reunião é uma só, e o vínculo é da reunião.

**Criação de cliente e de sessão (contratos)**
- **D-13:** "Criar cliente novo" pela Taqciti usa uma **rota nova só para isso**, e **não** o `POST /sessions/start`. Esse endpoint é da integração com o CITi Flow: busca briefings de lá e cria um segredo no Vault a cada chamada (`backend/app/routers/sessions.py`, linhas 43–75). — Reversibility: costly. **DECISÃO EM ABERTO do time.**
- **D-14:** Cliente criado só com **nome** é aceito. Tipo de projeto, maturidade (DMS) e contexto são completados depois, no web app. Até lá, as perguntas ao vivo saem genéricas — isso foi aceito.
- **D-15:** A **chave Gemini deixa de ser obrigatória na criação de projeto**, em todo o cadastro (web app e Taqciti). O padrão passa a ser a **chave do servidor** (`GEMINI_API_KEY`, que o pipeline já usa como fallback). Chave própria por projeto fica **opcional**. O Precificador não é afetado (`pricing_api_key`, separada). — Reversibility: costly. **DECISÃO EM ABERTO do time.**

**Segurança, falhas e reenvio**
- **D-16:** Listar clientes, criar cliente e criar sessão, feitos pela Taqciti, passam por **rotas próprias da extensão**, sob `/webhook/extension`, protegidas pelo header `x-agente-key` (mesmo gate da Fase 6, D-10). O web app **não muda**. Decisão de que a criação de sessão também passa por essa rota é Claude's Discretion. — Reversibility: costly. **DECISÃO EM ABERTO do time.**
- **D-17:** O `GET /projects` e o `GET /sessions` atuais **ficam como estão**, sem proteção. Decisão do usuário. Fica **registrado como risco de LGPD**. Fecha quando houver login (AGM ou TAQF-02).
- **D-18:** Quando o Agente cai no meio da reunião ao vivo, as falas que não chegaram são **guardadas no Taqciti e reenviadas** quando o Agente voltar. A pessoa é **avisada na tela** de que o Agente está fora do ar. Isso **reabre a decisão 2-B do WR-04** da Fase 7. — Reversibility: costly.
- **D-19:** O reenvio pode **duplicar trecho** se o backend gravou e a resposta se perdeu. Evitar isso exige um **identificador por trecho** (ex.: `chunk_id` gerado na Taqciti e reaproveitado nas tentativas) e o backend ignorando um id repetido. Hoje o `POST /webhook/extension` faz `insert` direto. Isso é mudança de contrato. **DECISÃO EM ABERTO do time.**

**Validação**
- **D-20:** A fase só é dada por encerrada com **testes automáticos** (Taqciti e backend) **mais um teste manual no Chrome com uma reunião real no Meet**. O teste manual cobre: (a) envio em blocos no fim da reunião, (b) queda do Agente com aviso e reenvio, (c) descarte com confirmação, (d) escolha do cliente no meio da reunião.

### Claude's Discretion
- Nomes exatos dos campos e textos da UI, seguindo o padrão de `taqciti/src/sidepanel/screens/AgenteConfigScreen.tsx`.
- Tamanho dos blocos do envio em D-10 e a pausa entre eles. Definir no planejamento e validar com o teste de D-20.
- Quantas tentativas e quanto tempo esperar antes de considerar o Agente "fora do ar" (hoje são 3 tentativas com espera de 1, 2 e 4 s, em `AGENTE_SEND_MAX_RETRIES`).
- Formato e códigos de erro das rotas novas de D-16. Seguir o padrão 401 da Fase 6.
- Onde exatamente o ícone de D-07 fica, dentro das opções que a UI permitir.
- A lista de clientes deve ficar atrás de uma **interface** (inversão de dependência do CLAUDE.md), para que a origem dos clientes possa mudar (ex.: AGM) sem reescrever o seletor.

### Deferred Ideas (OUT OF SCOPE)
- Migrar do modelo B para o modelo A (sessão provisória com envio ao vivo mesmo sem cliente).
- Perguntas só por clique (`_run_question_planner` só roda por `trigger_questions`) — discutir na Fase 10.
- Banco de perguntas sem filtro por tipo (`pipeline.py` ~linha 670) — discussão própria.
- Tipo de projeto fora do discovery (`generate_questions` não usa `project_type` no prompt) — discussão própria.
- Conexão com o AGM (pode mudar destino da aba AGP e origem da lista de clientes).
- Aba AGP numa reunião "Depois", sem cliente.
- Login (TAQF-02, ou o login do AGM) para fechar `GET /projects` (D-17).
- Enviar as mudanças de volta para o repositório `taqciti` original (Fase 7, D-03).

### DECISÕES DO TIME (em aberto — não decidir sozinho)
1. **Rotas novas da extensão** (listar clientes, criar cliente, criar sessão) — D-13 e D-16. Mudança de contrato da API.
2. **Remover a exigência da chave Gemini** em `ProjectCreate` e no formulário do web app — D-15. Mudança de contrato da API.
3. **Identificador por trecho no webhook** para evitar duplicata no reenvio — D-19. Mudança de contrato do webhook.

Enquanto essas três não forem decididas, o planejamento pode preparar o restante, mas as tasks que dependem delas ficam bloqueadas.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TAQ-02 | A reunião da Taqciti se liga à sessão correta do backend por seleção explícita de cliente por reunião (escolher ou criar cliente, ou adiar para o fim da reunião); o campo manual de ID fica como plano B escondido. | Seções "Arquitetura" (máquina de associação, store, comandos do service worker), "Mapa bloqueado × desbloqueado", "Pitfalls" 1–9 e "Validation Architecture" (um teste automatizado por critério de sucesso 1–4). |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Diretivas extraídas de `./CLAUDE.md` (mesma autoridade de decisão travada) [VERIFIED: CLAUDE.md lido nesta sessão]:

- **Idioma:** respostas e documentos em português natural; identificadores, caminhos e comandos ficam como estão.
- **SOLID / camadas (não-negociável):** routers só roteiam; services orquestram; repositories falam com o Supabase; schemas Pydantic separados por contexto (create / update / response). No frontend/extensão: componentes sem chamada de API, lógica stateful em hooks, props minimalistas.
- **Arquivos pequenos:** "Um arquivo, uma responsabilidade. Se um arquivo está ficando grande (>200 linhas), é sinal de que está fazendo coisas demais." Hoje `taqciti/src/content/ui/PanelApp.tsx` tem **1348 linhas** e `agenteStreamerInstance.ts` **288** — a Fase 8 NÃO deve acrescentar lógica nesses arquivos (ver Pitfall 9).
- **Template de 7 seções por task:** (1) o que muda em linguagem comum, (2) como vai ser alterado (commits atômicos), (3) riscos de cada ação, (4) como prevenir, (5) rollback, (6) decisões do time (marcar `DECISÃO EM ABERTO` e parar), (7) verificação ponta a ponta com ao menos 1 teste semente.
- **Condutas:** nunca misturar correção crítica com refator no mesmo commit; refator ≠ mudança de comportamento; preferir estender testes existentes.
- **Git:** uma branch por fase (`feat/fase-08-taqciti-session-association` — já é a branch atual); não misturar fases.
- **Segredos:** NUNCA ler `.env`, `backend/.env`, `taqciti/server/.env.local`. Usar só `.env.example`. Esta pesquisa não abriu nenhum desses arquivos (os testes de backend rodados carregam `.env` via `load_dotenv` do `conftest`, sem imprimir conteúdo).
- **Modelo/esforço do GSD:** planner `opus`/`xhigh`, executor `sonnet` com esforço escolhido na hora — política fixa, não alterar.

## Summary

A Fase 8 é, na prática, **três sistemas costurados**: (1) uma máquina de estados por reunião ("associação": pending → choosing → deferred/linking/linked → ended-unsent → sending → sent/send-failed/discarded) com armazenamento próprio e um único escritor (o service worker); (2) uma camada de UI nova (ícone, cartão, picker, barra de vínculo, cartão de fim) sobre o kit "Liquid Glass" já aprovado no `08-UI-SPEC.md`; (3) uma mudança de política no envio (`agenteSender`) que hoje **descarta** o trecho depois de 4 tentativas e **perde tudo** se o service worker reiniciar, e que precisa virar uma fila durável, paginada e idempotente. O backend precisa de três rotas novas sob `/webhook/extension`, de `gemini_api_key` opcional e, se o time aprovar, de um `chunk_id` com índice único.

**O que o CONTEXT não previu e muda o plano** (detalhes nos Pitfalls):

1. **Ninguém encerra a sessão criada pela Taqciti.** O pipeline sobe `_coverage_task` (30 s) e `_red_flag_task` (15 s) já no primeiro chunk (via `push_chunk` → `get_or_create` → `pipeline.start()`) e não existe auto-encerramento por inatividade. Como D-03 cria uma sessão por reunião e hoje só o web app chama `finish`, cada reunião da Taqciti deixaria um laço chamando o Gemini (com a chave do servidor, D-15) até o processo reiniciar. É uma **4ª decisão do time** (ver Open Questions).
2. **O projeto criado pela Taqciti nasce `mode='sales'`** (default de `ProjectCreate` e da coluna), mas o milestone v3.0 é discovery. A rota nova precisa fixar `mode` explicitamente — decisão a confirmar.
3. **O painel dentro do Meet é content script e não lê `chrome.storage.session`** por padrão; todo o status de runtime da Fase 7 (`taq:agenteSendOutcome`, `taq:agenteWaiting`) mora em `storage.session`. O aviso "Agente fora do ar" e o progresso "x de y" precisam de outro canal (`storage.local` ou broadcast).
4. **O limite de 100 reuniões do histórico apaga em silêncio a mais antiga** — e no modelo B uma reunião "Depois" é a **única cópia** da transcrição.
5. **`AGENTE_SEND_MAX_QUEUED = 50` com "descarta o mais antigo"** contradiz D-10 (centenas de partes) e D-18 (guardar e reenviar).
6. **Duas corridas no backend** afetam a rajada de D-10: `get_or_create` pode criar dois pipelines quando o projeto tem `pre_meeting_context` (há `await` ao LLM antes de registrar), e o `insert` síncrono do supabase-py dentro de `async def` bloqueia o event loop a cada chunk.

**Boa notícia:** (a) o fallback para `GEMINI_API_KEY` **já existe** em dois pontos do pipeline, então D-15 é só relaxar o contrato e o formulário; (b) o `ExtensionChunk` não proíbe campos extras, então a Taqciti pode **gerar e enviar `chunk_id` desde já** sem quebrar o backend atual — a idempotência só "liga" quando o backend for atualizado (assumido; ver A1); (c) nenhuma dependência nova é necessária em nenhum dos dois lados.

**Primary recommendation:** Construir primeiro, sem tocar contrato, o domínio da associação (reducer puro + store `storage.local` com escritor único + interface `ClientDirectory` com fake) e toda a UI contra esse fake; só depois ligar ao backend, atrás de três `checkpoint:decision` (rotas, chave opcional, `chunk_id`) mais a decisão extra do encerramento de sessão. O service worker é o dono de toda a lógica de vínculo e de envio; a UI só emite comandos validados por zod.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Detectar reunião nova e criar a associação `pending` | Service worker (`sessionController`/`index.ts`) | — | A máquina de estados da reunião vive no SW; `MEETING_DETECTED` só chega aqui. Precisa ser idempotente (o poll repete a detecção a cada 1,5 s). |
| Ícone "!", cartão de decisão, picker, barra de vínculo | Content script (painel no Meet, shadow DOM) | Página da extensão (saída larga) | Mesma árvore React nas duas superfícies via `Platform`. Componentes apresentacionais; sem fetch. |
| Buscar/criar cliente, criar sessão (chamadas HTTP) | Service worker (`ClientDirectory` HTTP) | — | `host_permissions: <all_urls>` já cobre o backend; fetch de content script fica sujeito ao CORS/CSP da página do Meet. A UI pede via `platform.send` (comando zod). |
| Persistir associação por reunião | `chrome.storage.local` (chave própria, escritor único = SW) | — | Content script lê `storage.local` + `onChanged` (como `taq:prefs`). Lição WR-01/WR-02 da Fase 7: uma chave por dono, escrita do valor inteiro. |
| Status de entrega (offline, fila, progresso x de y) | `chrome.storage.local` (chave própria, só o SW escreve) | Broadcast por mensagem (alternativa) | `storage.session` **não é exposto a content scripts por padrão** [CITED: developer.chrome.com/docs/extensions/reference/api/storage]. |
| Fila de reenvio (outbox) durável | `chrome.storage.local` | — | O SW morre após 30 s ocioso e perde variáveis globais [CITED: developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle]. Item guarda destino + texto + `chunkId`, **nunca** o header com a chave. |
| Envio em blocos / backfill / retry | Service worker (`agenteSender` estendido + "uploader" de reunião) | — | Precisa continuar com o painel fechado (UI-SPEC "sem Cancelar"). |
| Listar clientes / criar cliente / criar sessão (servidor) | API / Backend (`routers` → `services` → `repositories`) | — | Contrato novo, gate `x-agente-key`; resposta mínima (sem `pre_meeting_context`, sem orçamento). |
| Idempotência por `chunk_id` | Banco (índice único) + API (trata violação) | Taqciti (gera e reaproveita o id) | Só o banco garante unicidade sob concorrência. |
| Encerrar a sessão criada pela Taqciti | API / Backend (`finish`) | Service worker (decide quando chamar) | Hoje só o web app encerra; sem isso o pipeline roda indefinidamente. |
| Descartar reunião | Service worker (`ui/history/delete` + remover associação + outbox) | UI (ConfirmModal) | Comando já existe para o histórico; falta limpar associação/outbox. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react / react-dom | ^18.3.1 | UI do painel e da saída larga | Já é a stack da Taqciti [VERIFIED: taqciti/package.json] |
| zod | ^3.25.0 | Validação de toda mensagem entre contextos (`uiMessageSchema`) | Padrão do projeto; novos comandos entram no mesmo `discriminatedUnion` [VERIFIED: taqciti/src/shared/types/messages.ts] |
| vitest + jsdom | ^3.2.7 / ^29.1.1 | Testes (619 verdes hoje, 42 arquivos) | Baseline rodado nesta sessão: `Test Files 42 passed (42) / Tests 619 passed (619)` |
| tailwindcss | ^3.4.15 | Estilo; keyframe `nudge` novo entra em `tailwind.config.ts` | Kit "Liquid Glass" existente |
| fastapi / pydantic v2 / supabase-py | `>=0.111.0` / `>=2.7.0` / `>=2.3.0` (instalados: postgrest 2.31.0) | Rotas novas, schemas, acesso ao banco | Stack do backend [VERIFIED: backend/requirements.txt; `python -c "import postgrest"` → 2.31.0] |
| pytest + pytest-asyncio | `>=8.0.0` / `>=0.23.0` (`asyncio_mode = auto`) | Testes do backend | `pytest.ini` existente |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `postgrest.exceptions.APIError` | 2.31.0 (vem com supabase) | Capturar violação de unicidade (`.code == "23505"`) no webhook | Idempotência por `chunk_id` (decisão 3). `APIError` expõe `.code`, `.message`, `.details` [VERIFIED: inspect.getsource local] |
| `crypto.randomUUID()` / `crypto.subtle` | nativo (SW e content script) | Gerar `chunkId` | Já é usado em `background/index.ts` para `meetingId` |
| `chrome.alarms` | Chrome ≥ 120 para período de 30 s | Reacordar o SW para retentar a outbox em silêncio | **Opcional**: exige permissão `alarms` no manifesto (ver Open Questions) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Associação em chave própria `taq:agenteAssociations` | Campo `association` dentro de `MeetingRecord` (`taq:history`) | Mais simples de juntar com o histórico, **mas** `upsertRecord`/`patchRecord`/`deleteRecord` fazem read-modify-write do array inteiro sem fila (`history.ts`) — gravar associação por ali repete o bug de "uma gravação apaga a outra" da Fase 7. Recomendado: chave própria + junção na leitura (hook). |
| Outbox em `storage.session` | `storage.local` | `session` some ao fechar o Chrome e não chega ao content script; `local` sobrevive e a transcrição já mora em `local` (histórico) — não cria classe nova de exposição. Recomendado: `local`, com teto e sem segredo. |
| `ConfirmModal` com texto fixo "Cancelar" | Prop `cancelLabel?: string` | Já decidido no UI-SPEC (padrão `'Cancelar'`, retrocompatível). |

**Installation:** nenhuma. `npm ci` em `taqciti/` e `pip install -r backend/requirements.txt` já estão satisfeitos; **nenhum pacote novo**.

**Version verification:** versões lidas de `taqciti/package.json`, `backend/requirements.txt` e do ambiente (`node v24.12.0`, `Python 3.13.14`, `postgrest 2.31.0`). Nenhum pacote novo é recomendado, então não há `npm view`/`pip index` a registrar.

## Package Legitimacy Audit

Nenhum pacote externo novo é instalado nesta fase (nem em `taqciti/`, nem em `backend/`, nem em `frontend/`). `package.json`/`package-lock.json`/`requirements.txt` não devem ter diff ao final — **o verificador da fase pode checar exatamente isso** (`git diff --stat -- taqciti/package*.json backend/requirements.txt frontend/package*.json` vazio).

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| — | — | — | — | — | — | Nenhum pacote novo |

**Packages removed due to [SLOP] verdict:** nenhum
**Packages flagged as suspicious [SUS]:** nenhum

## Architecture Patterns

### System Architecture Diagram

```
 Meet (aba)                         Service worker (MV3, dono da lógica)                    Backend Agente (Railway)
 ┌──────────────┐  meet/detected   ┌──────────────────────────────────────────┐
 │ content      │ ───────────────► │ sessionController.dispatch(MEETING_*)    │
 │ script       │  meet/chunk      │   └─ runSideEffects: meeting NOVA? ──────┼─► associationStore.create(meetingId,'pending')
 │ (captura)    │ ───────────────► │ flushState → onSessionFlushed(state)     │        (storage.local, escritor único)
 │              │                  │   └─ agenteStreamer.step                 │
 │ PanelApp     │                  │        destino = f(config, associação)   │   associação ≠ linked ─► NADA é enviado
 │ (shadow DOM) │ ◄─ onChanged ─── │                                          │
 │  AgenteNudge │  (storage.local: │ ClientDirectory (HTTP, no SW)            │
 │  DecisionCard│   associação +   │   list()   ── GET  /webhook/extension/clients ───────► repositório → services → router (gate x-agente-key)
 │  ClientPicker│   delivery)      │   create() ── POST /webhook/extension/clients ───────►
 │  BindingBar  │                  │   session()── POST /webhook/extension/sessions ──────►
 │  EndPrompt   │ ─ platform.send ►│ comandos zod: agente/clients/list|create,│
 └──────────────┘  (ui/agente/*)   │   agente/meeting/{defer,bind,send,discard}│
 Saída larga (aba)  idem           │                                          │
                                   │ bind: persiste 'linking' → cria sessão → │
                                   │   backfill PACED (blocos) da reunião ─┐  │
                                   │   cursor primado no instante do vínculo│ │
                                   │ live: phraseBatcher → SENDER ◄────────┘  │
                                   │   SENDER (FIFO serial, pacing)           │
                                   │    ├─ ok ─► status 'sent'                │
                                   │    ├─ retryable ─► OUTBOX (local) +      │ POST /webhook/extension {session_id,text,speaker,chunk_id}
                                   │    │     status 'offline' (+fila n)      │ ─────────────────────────────────────────────────────────►
                                   │    └─ reenvio: a cada flush, no boot,    │      insert → (23505?) duplicata: ignora, 202, NÃO empurra ao pipeline
                                   │       (opcional) chrome.alarms           │      senão push_chunk → WS ─► coverage/red-flag (timers 30s/15s)
                                   │ fim da reunião → 'ended-unsent' (se não  │
                                   │   vinculada) → EndPrompt / "Enviar ao    │  [encerrar a sessão criada pela Taqciti = decisão aberta #4]
                                   │   Agente" → uploader em blocos por índice│
                                   └──────────────────────────────────────────┘
```

### Recommended Project Structure

```
taqciti/src/
├── features/agente/
│   ├── association.ts          # tipos + reducer PURO (estados do UI-SPEC) — sem chrome
│   ├── association.test.ts
│   ├── clientDirectory.ts      # interface ClientDirectory { list(); create(name) } + tipos
│   ├── clientSearch.ts         # normalização sem acento + filtro/ordenação pt-BR (puro)
│   ├── outbox.ts               # itens da fila durável, teto, ordenação (puro)
│   └── meetingUploader.ts      # plano de blocos a partir de record.segments (puro) + pacing
├── shared/config/
│   ├── agenteAssociationStore.ts   # chave taq:agenteAssociations (escritor único = SW, fila de escrita)
│   ├── agenteOutboxStore.ts        # chave taq:agenteOutbox (sem segredo)
│   └── agenteDeliveryStore.ts      # chave taq:agenteDelivery (offline, fila n, progresso x/y)
├── background/
│   ├── agenteAssociationService.ts # orquestra: bind/defer/discard/send (usa deps injetadas)
│   ├── httpClientDirectory.ts      # implementação de ClientDirectory via fetch (+ x-agente-key)
│   └── agenteSender.ts             # estendido: pacing, outbox durável, sem "descarta o mais antigo"
├── shared/hooks/
│   ├── useClientDirectory.ts       # carrega lista via platform.send; estados loading|ready|error
│   └── useMeetingAssociation.ts    # junta associação (local) + histórico + delivery
├── shared/types/messages.ts        # + comandos ui/agente/* no uiMessageSchema
└── sidepanel/components/ (e shared/ui/)
    ├── AgenteNudge.tsx  AgenteDecisionCard.tsx  ClientPicker.tsx
    ├── AgenteBindingBar.tsx  AgenteEndPrompt.tsx  AssociationBadge.tsx
backend/app/
├── routers/extension_clients.py    # APIRouter(prefix="/webhook/extension"): só roteia
├── services/extension_session_service.py   # regras: nome, duplicidade, mode, criar sessão
├── repositories/{projects,sessions,transcript_chunks}_repository.py   # só falam com o Supabase
└── models/extension.py             # ExtensionClientCreate / ExtensionClientResponse / ExtensionSessionCreate (schemas separados)
supabase/migrations/<data>_add_chunk_id_to_transcript_chunks.sql   # só se a decisão 3 for "sim"
```

### Pattern 1: Associação = reducer puro + store de escritor único
**What:** `reduceAssociation(state, event)` (como `features/meeting/machine.ts`) sem relógio nem `chrome`; o SW aplica eventos e grava o **valor inteiro** da chave, sem ler antes (padrão de `agenteBindingStore.ts`). A UI nunca grava; emite comandos.
**When to use:** todo o ciclo `pending → … → sent/discarded` do UI-SPEC.
**Example:**
```typescript
// Fonte do padrão: taqciti/src/shared/config/agenteBindingStore.ts (escrita direta, chave própria)
export type AssociationState =
  | 'pending' | 'choosing' | 'deferred' | 'linking' | 'linked'
  | 'ended-unsent' | 'sending' | 'sent' | 'send-failed';
export interface MeetingAssociation {
  meetingId: string;
  state: AssociationState;
  clientName?: string;          // só para exibir ("Enviando ao vivo para {cliente}")
  sessionId?: string;           // só existe de 'linking' em diante
  origin?: 'picker' | 'manual-id';
  sendProgress?: { done: number; total: number }; // por ÍNDICE de segmento (retomável)
  error?: 'create-session' | 'send';
}
// 'discarded' não é estado persistido: descartar REMOVE a entrada.
```

### Pattern 2: Destino efetivo derivado da associação (não da config global)
**What:** o streamer deixa de ler `config.agenteSessionId` como destino e passa a usar `effectiveConfig = { ...config, agenteSessionId: association.sessionId }` **só quando `state === 'linked'`**. Em qualquer outro estado (ou sem associação) `isStreamingReady` falha e nada é enviado. Assim `buildPhraseRequests`, `syncDestination` e `planStreamStep` ficam intactos.
**When to use:** garantir o critério 3 ("nunca por palpite").
**Cuidado:** hoje `getStreamingReadiness` devolve `'missing-session'` sem `agenteSessionId` e a tela mostra "Falta o ID da sessão do Agente — nada é enviado." (`agenteStatus.ts`, `READINESS_LABELS`). Com o seletor esse texto passa a ser enganoso — trocar a cópia (lacuna do UI-SPEC, ver Open Questions).

### Pattern 3: Backfill a partir do início reaproveitando `planStreamStep`
**What:** vínculo no meio da reunião (D-12) precisa mandar tudo desde o início. Hoje `planStreamStep` com cursor nulo e vínculo vazio faz **prime** (descarta o passado). O caminho "desde o início" já existe: `releaseOrWait` → `computeSegmentDeltas({sent:{}}, segments)` quando `confirmedMeetingId === session.meetingId`. Recomendado: um parâmetro explícito de "iniciar do começo" no `StreamBinding` (em vez de reusar `confirmedMeetingId`, que tem semântica de CR-01) **e** primar o cursor no estado do instante do vínculo, para o que for dito durante o backfill sair pelo fluxo ao vivo, na ordem.
**Armadilha:** se o cursor for perdido (reinício do Chrome) com `confirmedMeetingId` ainda igual à reunião, a regra "desde o início" reenviaria tudo (duplicata massiva). Por isso a ordem de checagem deve ser: `bound === meetingId` → prime; senão "início" só enquanto a associação disser `linking`/backfill pendente; progresso do backfill é gravado por índice na associação.

### Pattern 4: Envio da reunião guardada = uploader por índice, serial, com pacing
**What:** a partir de `record.segments` (imutáveis depois do fim) gerar um request por segmento (mesmo `speaker`), em ordem, `K` requests por bloco e pausa `P` entre blocos; a cada ack gravar `sendProgress.done`. Falha → para, estado `send-failed`. `chunkId` determinístico por segmento (`bulk:{meetingId}:{index}`) torna o reenvio seguro quando a decisão 3 existir.
**Valores iniciais sugeridos:** `K = 20`, `P = 1000 ms` `[ASSUMED]` — 600 segmentos ≈ 30 blocos ≈ 30 s de pausa + tempo de rede. Validar no teste D-20(a).
**Nota:** o envio é serial (aguarda o 202 de cada request), o que já dá contrapressão natural; a pausa existe para não monopolizar o event loop do backend (Pitfall 5).

### Pattern 5: Fila de reenvio durável sem segredo
**What:** item da outbox = `{ chunkId, backendUrl, sessionId, text, speaker, enqueuedAt }`. O header `x-agente-key` é **sempre** reconstruído com a chave atual na hora de enviar (mesmo princípio do snapshot da Fase 7, `buildPhraseRequests`). Teto por quantidade/bytes com status explícito `overflow` em vez de descartar em silêncio.
**Gatilhos de nova tentativa:** (1) cada `flushState` durante a reunião (a captura mantém o SW acordado enquanto há legenda), (2) boot do SW (`resume`), (3) comando de UI, (4) opcional `chrome.alarms`.

### Anti-Patterns to Avoid
- **Gravar a associação dentro de `taq:history`:** read-modify-write sem fila já existe lá; repetir o bug da Fase 7.
- **Ler `storage.session` no painel do Meet:** não é exposto a content script [CITED]; o aviso offline nunca apareceria.
- **Fetch ao backend a partir do content script:** sujeito ao CORS/CSP da página; mantenha no SW.
- **Reusar `confirmedMeetingId` para o backfill:** mistura duas semânticas e arrisca reenvio massivo.
- **Acrescentar lógica em `PanelApp.tsx` (1348 linhas) ou em `agenteStreamerInstance.ts` (288):** extrair módulos novos (Pitfall 9).
- **Criar sessão a cada clique na lista:** o UI-SPEC já exige dois passos (selecionar, depois "Vincular").
- **Refatorar os routers existentes (`projects.py`, `sessions.py` fazem acesso direto ao banco) no mesmo commit das rotas novas:** regra do CLAUDE.md; código novo nasce em camadas, refator antigo é outra task.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Busca insensível a acento/caixa | Regex de acentos à mão | `s.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR')` num helper puro + `Intl.Collator('pt-BR')` para ordenar | `"açaí"` deve casar com `"acai"` (UI-SPEC); API nativa cobre |
| Validação de mensagem entre contextos | `if (typeof …)` solto | `zod` no `uiMessageSchema` | Padrão do projeto; a ponte do app nativo valida com o mesmo schema |
| Escritas concorrentes no storage | Read-modify-write ad hoc | Chave própria + valor inteiro + fila de escrita (`prefsStore.ts`, `agenteBindingStore.ts`) | Lição WR-01/WR-02 (Fase 7) |
| Idempotência no webhook | Cache em memória de ids vistos | Índice único `(session_id, chunk_id)` + tratar `23505` | Memória some no restart/Railway e não vale entre réplicas |
| Aviso animado | JS com `setInterval` | Keyframe CSS `nudge` só com `transform` | UI-SPEC; respeita `prefers-reduced-motion` pela regra global |
| Cliente HTTP com retry | Lib nova | `fetch` + `sendRetryPolicy.ts` existente | Sem dependência nova; política já testada |
| Modal de confirmação | Modal novo | `ConfirmModal` + prop `cancelLabel` | UI-SPEC |

**Key insight:** o difícil nesta fase não é nenhuma peça isolada, é o **ordenamento sob falha** (SW que morre, rede que cai, resposta perdida, painel fechado). Cada peça nova deve ter um teste que injeta exatamente essa falha.

## Common Pitfalls

### Pitfall 1: Sessão criada pela Taqciti nunca é encerrada (custo de Gemini sem fim)
**What goes wrong:** cada reunião vinculada cria uma sessão `active`; o pipeline dela chama o classificador a cada 30 s e o detector de red flags a cada 15 s enquanto houver chunks, com a chave do servidor, até o processo reiniciar.
**Why it happens:** `get_or_create` (chamado por `push_chunk`) já faz `pipeline.start()`; não há auto-finish por inatividade (grep de `idle|inactiv|auto_finish|watchdog` em `pipeline.py`/`ws_manager.py`/`ws.py` não acha nada). O comentário de `finish_session` descreve exatamente o efeito: "as tasks continuam chamando o Gemini indefinidamente sobre uma reunião já encerrada, queimando budget". [VERIFIED: backend/app/services/pipeline.py:58-68,118-141,635-750; backend/app/routers/sessions.py:255-260]
**How to avoid:** decidir e implementar "quem encerra e quando" (Open Question 1). Opção recomendada: rota `POST /webhook/extension/sessions/{id}/finish` (gate) chamada pelo SW depois de: reunião `ended` + outbox vazia + janela de retomada vencida (`REJOIN_RESUME_WINDOW_MS = 10 * 60 * 1000`) — encerrar antes disso quebra o "reentrar na mesma sala" (chunks ainda entram no banco, mas `get_or_create` devolve `None` para sessão não-ativa e o pipeline ao vivo some).
**Warning signs:** chamadas ao Gemini continuam depois da reunião; `has_active_session` verde em projetos sem reunião.

### Pitfall 2: Fila de envio descarta o mais antigo (`MAX_QUEUED = 50`) e o `fetch` esgota em ~7 s
**What goes wrong:** D-10 envia centenas de partes e D-18 exige guardar; a fila atual descarta o trecho mais antigo acima de 50 e abandona o trecho depois de 3 novas tentativas.
**Why it happens:** `export const AGENTE_SEND_MAX_RETRIES = 3;` (`sendRetryPolicy.ts:17`), `export const AGENTE_SEND_MAX_QUEUED = 50;` (`sendRetryPolicy.ts:27`); em `agenteSender.submit`, `if (waiting.length > AGENTE_SEND_MAX_QUEUED) { waiting.shift(); … }`. [VERIFIED: leitura nesta sessão]
**How to avoid:** o produtor do backfill/upload alimenta o sender sob demanda (não enfileira tudo de uma vez); a fila ao vivo passa a ser a outbox durável com teto alto e status `overflow` explícito; "fora do ar" = falha retryable esgotada **e** outbox não vazia.
**Warning signs:** teste que envia 120 requests e confere ordem/contagem no `send` fake.

### Pitfall 3: O painel do Meet não enxerga `storage.session`
**What goes wrong:** o aviso "O Agente está fora do ar…" e "Enviando o que já foi falado… x de y" não aparecem no painel injetado.
**Why it happens:** `storage.session` "não é exposto a content scripts" por padrão; as chaves da Fase 7 (`taq:agenteSendOutcome`, `taq:agenteWaiting`) vivem lá e só a página `AgenteConfigScreen` as lê. [CITED: developer.chrome.com/docs/extensions/reference/api/storage] [VERIFIED: constants.ts — "chrome.storage.session — resultado do último envio…"]
**How to avoid:** chave `taq:agenteDelivery` em `storage.local` (escritor único = SW; gravar só em mudança, com throttle para o progresso). Não usar `setAccessLevel('TRUSTED_AND_UNTRUSTED_CONTEXTS')`: abriria também `taq:state` (a transcrição inteira) ao content script.
**Warning signs:** teste de componente do `AgenteBindingBar` que só passa com `storage.session` mockado.

### Pitfall 4: Reunião "Depois" é a única cópia e o histórico apaga a mais antiga em silêncio
**What goes wrong:** ao entrar a 101ª reunião, `upsertRecord` faz `.sort(startedAt desc).slice(0, MAX_HISTORY_RECORDS)` e descarta a mais antiga — que pode ser uma reunião `deferred`/`ended-unsent` nunca enviada.
**Why it happens:** `MAX_HISTORY_RECORDS = 100` (`constants.ts`) e o `slice` em `background/history.ts:31`. No modelo B (D-04) o histórico local é a fonte única. [VERIFIED]
**How to avoid:** a política de evicção precisa preferir registros já enviados/`sent` e **nunca** descartar `ended-unsent`/`send-failed` (ou avisar antes). Teste: 100 registros + 1 novo com o mais antigo `ended-unsent` ⇒ ele sobrevive. Decisão do time se o teto vira "soft" (ver Open Questions). Também: `chrome.storage.local` tem 10 MB e o manifesto **não** declara `unlimitedStorage` (`permissions: ['storage', 'sidePanel', 'scripting', 'identity']`, `manifest.config.ts:151`); escrita acima da cota **rejeita** a promise [CITED] — histórico + outbox + associações dividem o mesmo orçamento.

### Pitfall 5: Rajada (D-10) no backend — dois problemas reais além do custo
**What goes wrong:** (a) `extension_webhook` é `async def` mas faz `db.table(...).insert(...).execute()` **síncrono** (supabase-py): cada chunk bloqueia o event loop durante a ida ao banco; 600 chunks seguidos travam WebSocket/UI de outras sessões. (b) `PipelineManager.get_or_create` só registra o pipeline em `_pipelines` **depois** de `await llm_service.infer_project_type(...)` e `await extract_structured_context(...)` (quando o projeto tem `pre_meeting_context`); dois chunks quase simultâneos criam **dois** pipelines, e o primeiro fica com tasks órfãs (nunca parado: `_pipelines[session_id]` é sobrescrito).
**Why it happens:** [VERIFIED: backend/app/routers/webhook.py:40-48 (insert síncrono + `asyncio.create_task(...)`); backend/app/services/pipeline.py:635-745]. O custo de Gemini **não** cresce por chunk (as chamadas são por timer — `pipeline.py:118-141`), então o risco de gasto da rajada é menor do que o CONTEXT temia `[ASSUMED: leitura do código, não medido]`.
**How to avoid:** envio serial com pacing (Pattern 4) e, no backend, um `asyncio.Lock` por `session_id` em `get_or_create` (mudança interna, sem contrato). Clientes criados pela Taqciti (só nome, D-14) não têm contexto e escapam de (b); clientes antigos com contexto, não. Testar com pytest assíncrono: duas chamadas concorrentes a `get_or_create` ⇒ 1 pipeline.
**Warning signs:** WS de outra sessão congela durante um envio em lote; `ps`/log mostra dois conjuntos de tasks `coverage-<id>`.

### Pitfall 6: Ordem das partes e carimbo de tempo
**What goes wrong:** o webhook não recebe timestamp; a ordem da transcrição é a ordem de inserção (`timestamp timestamptz DEFAULT now()`, `_send_initial_state` ordena por `timestamp`). Duas requisições em paralelo podem inverter; e os carimbos da reunião guardada refletem a hora do envio, não da fala.
**How to avoid:** sempre serial, um request por vez, no sender (nunca `Promise.all`). Aceitar e documentar que o carimbo é o do envio (relatório/UX não usam hora da fala hoje `[ASSUMED]`); se virar requisito, é outra mudança de contrato (campo `spoken_at`).

### Pitfall 7: Projeto criado pela Taqciti nasce `mode='sales'`
**What goes wrong:** `ProjectCreate.mode: ProjectMode = "sales"` e a coluna tem `DEFAULT 'sales'`; o pipeline escolhe `DiscoveryPromptBuilder` só se `mode == "discovery"`. Um cliente criado "só com nome" usaria o prompt de vendas com portfólio CITi num milestone de discovery. [VERIFIED: backend/app/models/projects.py (`mode: ProjectMode = "sales"`); supabase/migrations/20260921000000_add_mode_to_projects.sql; pipeline.py:699-712]
**How to avoid:** a rota de criar cliente fixa `mode="discovery"` (e `source="extension"`); confirmar com o time (Open Question 3). Teste: `create_extension_client("X")` ⇒ linha com `mode == "discovery"`.

### Pitfall 8: Estado "linking" interrompido (SW morre entre o POST da sessão e a gravação)
**What goes wrong:** sessão criada no backend, associação nunca chegou a `linked`; a pessoa tenta de novo e cria uma segunda sessão.
**How to avoid:** gravar `linking` **antes** do POST; no boot, `linking` sem `sessionId` volta para `deferred` com `error: 'create-session'` (UI-SPEC: "linking → deferred com erro visível"); sessão órfã sem chunks não gera custo (o pipeline só nasce com chunk ou WebSocket). Aceitar a órfã (clutter) ou tornar `POST sessions` idempotente por `meetingId` — escolha do planner.

### Pitfall 9: Arquivos já grandes e testes que travam a regra de 200 linhas
**What goes wrong:** acrescentar o picker/barra/cartão dentro de `PanelApp.tsx` (1348 linhas) ou a lógica nova em `agenteStreamerInstance.ts` (288) viola o CLAUDE.md e dificulta o review.
**How to avoid:** novos componentes em arquivos próprios (nomes do UI-SPEC) e só a **fiação mínima** no `PanelApp`/`LiveBody`/`MeetingScreen`; qualquer extração do `PanelApp` (ex.: `MeetingScreen` → arquivo próprio) é commit **separado** de refator, sem mudança de comportamento. Idem `AgenteConfigScreen.test.tsx` (530 linhas): testes novos em arquivo novo.

### Pitfall 10: `MEETING_DETECTED` repete a cada poll
**What goes wrong:** criar a associação `pending` a cada detecção gera duplicatas/regrava estado.
**Why it happens:** o content script avisa a cada ciclo; `transition` devolve `withSession(...)` novo para a mesma sala. [VERIFIED: machine.ts, caso `MEETING_DETECTED`]
**How to avoid:** criar só se não existir entrada para aquele `meetingId` (idempotente) e só quando há sessão nova (`prev.session?.meetingId !== state.session?.meetingId`), respeitando a condição "envio ao Agente ligado" do UI-SPEC. Reentrada na mesma sala dentro de 10 min reaproveita o `meetingId` ⇒ não pergunta de novo.

### Pitfall 11: ESC, foco e atalhos do Meet
**What goes wrong:** o `Esc` global do painel recolhe a janela (`PanelApp`, `event.key === 'Escape' && expanded`) e o `ConfirmModal` também ouve `Esc` em `document`; o Meet trata letras como atalho.
**How to avoid:** seguir o UI-SPEC (cartão/picker param a propagação do `Esc` antes do painel); usar sempre `SearchField`/`TextField` (seguram o teclado). Teste de componente: `Esc` dentro do cartão não minimiza o painel.

### Pitfall 12: Copy e botões que o UI-SPEC liga a "decisão 3"
**What goes wrong:** entregar `Continuar envio` antes da decisão cria duplicata.
**How to avoid:** não entregar o botão (UI-SPEC). Registrar a observação útil: como o upload é **serial** e o progresso é gravado por índice, retomar do último ack duplica **no máximo 1 trecho** (o que estava em voo quando falhou) `[ASSUMED: análise]` — insumo para o time decidir se `chunk_id` é mesmo necessário para o botão.

## Code Examples

### Rota nova no backend (camadas; sem acesso ao banco no router)
```python
# Padrão: backend/app/routers/webhook.py (gate) + CLAUDE.md (router só roteia).
# Arquivo novo: backend/app/routers/extension_clients.py
from fastapi import APIRouter, Depends
from app.routers.webhook import verify_extension_key          # mesmo gate da Fase 6
from app.models.extension import ExtensionClientCreate, ExtensionClientResponse
from app.services.extension_session_service import ExtensionSessionService, get_extension_service

router = APIRouter(prefix="/webhook/extension", tags=["webhook-extension"])

@router.get("/clients", response_model=list[ExtensionClientResponse])
async def list_clients(
    _: None = Depends(verify_extension_key),
    service: ExtensionSessionService = Depends(get_extension_service),
):
    return service.list_clients()     # {id, client, name} — nunca pre_meeting_context/budget

@router.post("/clients", response_model=ExtensionClientResponse, status_code=201)
async def create_client(
    payload: ExtensionClientCreate,   # name: str = Field(min_length=1, max_length=120), strip no validator
    _: None = Depends(verify_extension_key),
    service: ExtensionSessionService = Depends(get_extension_service),
):
    return service.create_client(payload.name)   # 409 se já existe (sem acento/caixa); mode="discovery"
```

### D-15: tornar a chave opcional (só onde ela é exigida hoje)
```python
# backend/app/models/projects.py:18 (hoje):
#     gemini_api_key: str
# passa a:
#     gemini_api_key: Optional[str] = None
#
# backend/app/routers/projects.py:55 (hoje): secret_id = _vault_store(db, payload.gemini_api_key, ...)
# passa a guardar no Vault SÓ quando vier chave e omitir gemini_api_key_secret_id caso contrário.
# O pipeline já cobre o caso sem chave:
#   pipeline.py:664-665  if not gemini_key: gemini_key = os.environ.get("GEMINI_API_KEY", "")
#   pipeline.py:53-54    if not self.state.gemini_api_key: ... os.environ.get("GEMINI_API_KEY", "")
# Frontend (mesma decisão): ProjectFormPage.tsx:296-299  <Field required={!isEdit}> / required={!isEdit && !hasApiKey}
#   e ProjectDetailPage.tsx:284-290 mostra "Não configurada" em vermelho → trocar a cópia.
```

### D-19: idempotência (só se a decisão 3 for aprovada)
```python
# Migration (NULLs são distintos em índice único no Postgres → linhas antigas e o /webhook/recall seguem válidos):
#   ALTER TABLE transcript_chunks ADD COLUMN IF NOT EXISTS chunk_id text;
#   CREATE UNIQUE INDEX IF NOT EXISTS ux_transcript_chunks_session_chunk
#       ON transcript_chunks (session_id, chunk_id);
#
# Handler (insert + tratar violação é mais direto do que depender do corpo do upsert/ignore-duplicates):
from postgrest.exceptions import APIError

def insert_chunk(db, session_id, text, speaker, chunk_id):   # no repositório
    try:
        db.table("transcript_chunks").insert(
            {"session_id": session_id, "speaker": speaker, "text": text, "chunk_id": chunk_id}
        ).execute()
        return True
    except APIError as exc:
        if exc.code == "23505":           # unique_violation  [ASSUMED: mapeamento do supabase-py — cobrir com teste de fake]
            return False                  # duplicata: responder 202 e NÃO chamar push_chunk
        raise
```

### Taqciti: id estável por trecho (vale para a outbox e para o upload)
```typescript
// Fonte: crypto.randomUUID já usado em taqciti/src/background/index.ts
const liveChunkId = (): string => crypto.randomUUID();                 // gerado UMA vez ao liberar a fala; vai na outbox
const bulkChunkId = (meetingId: string, index: number) => `bulk:${meetingId}:${index}`; // determinístico: segmentos são imutáveis após o fim
// Enviar `chunk_id` já hoje é inofensivo se o backend ignora campos extras (A1); a dedup só passa a valer com a migration.
```

### Busca sem acento (puro, testável)
```typescript
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR');
export const matchesClient = (c: { client: string; name: string }, q: string) =>
  fold(`${c.client} ${c.name}`).includes(fold(q.trim()));
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Auto-detect por `localStorage['agente_session_id']` (ROADMAP original) | Seletor de cliente por reunião (D-01) | 2026-10-11 | O valor só existe com a tela de monitoramento aberta e a extensão não lê o `localStorage` do site; descartado |
| Perda aceita do trecho na fila (WR-04 opção 2-B) | Fila durável + reenvio + aviso (D-18) | 2026-10-11 | `agenteSender` deixa de descartar; precisa de persistência e idempotência |
| Status do envio só em `storage.session` | Status de entrega em `storage.local` para o content script | Esta fase | Painel do Meet passa a mostrar offline/progresso |
| Config global com um `agenteSessionId` | Associação por reunião (destino efetivo derivado) | Esta fase | `agenteSessionId` vira só plano B (D-02) |

**Deprecated/outdated:**
- Botão "Continuar enviando para esta sessão" (CR-01) só faz sentido no caminho do ID manual; o planejamento decide se sai ou fica restrito ao plano B (UI-SPEC §7).
- Service worker MV3: idle de 30 s e perda de globais; alarmes com período mínimo de 30 s a partir do Chrome 120 [CITED: developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle]. O manifesto declara `minimum_chrome_version: '116'` (`manifest.config.ts:30`) — se usar `alarms`, tratar 116–119 (mínimo de 1 min) ou subir o mínimo.

## Mapa bloqueado × desbloqueado (para ordenar os planos)

Legenda: **L** livre agora · **B1/B2/B3** bloqueado pela decisão 1/2/3 do CONTEXT · **B4** bloqueado pela decisão nova (encerramento de sessão / `mode`) · **C** `checkpoint:human-verify`.

| Bloco de trabalho | Estado | Observação |
|-------------------|--------|------------|
| Domínio da associação: tipos, reducer, store, hook de junção | **L** | Puro/testável; sem backend |
| `ClientDirectory` (interface) + fake para testes + `clientSearch` | **L** | O UI-SPEC já manda construir contra o fake |
| Comandos zod `ui/agente/*` + handlers no SW com `ClientDirectory` injetado | **L** | Handlers usam o fake nos testes |
| Hooks de ciclo de vida no `sessionController` (criar `pending`, fim → `ended-unsent`, recuperação no boot) | **L** | Mudança de comportamento local |
| UI: `AgenteNudge`, `AgenteDecisionCard`, `ClientPicker`, `AgenteBindingBar`, `AgenteEndPrompt`, `AssociationBadge`, `Icon alert`, keyframe `nudge`, `ConfirmModal.cancelLabel` | **L** | Fiação mínima no `PanelApp`/`RecordDetail` |
| `AgenteConfigScreen` (plano B só com lista em erro) | **L** | Depende só da interface |
| Descartar (confirmar → `ui/history/delete` + remover associação/outbox) | **L** | Comando de histórico já existe |
| Evicção do histórico que protege não enviados | **L** (decisão de política do time recomendada) | Pitfall 4 |
| Reescrever `READINESS_LABELS['missing-session']` | **L** | Pitfall/Pattern 2 |
| Uploader por índice + pacing + sender sem "descarta o mais antigo" + outbox durável + status offline | **L** (cliente) | `chunkId` já gerado; dedup só com B3 |
| Rotas `GET/POST /webhook/extension/clients`, `POST .../sessions` (+ services/repos/models/testes) | **B1** | Contrato novo |
| Ligar `HttpClientDirectory` ao backend real | **B1** | Depende das rotas |
| `gemini_api_key` opcional (backend + `ProjectFormPage` + `ProjectDetailPage`) | **B2** | Contrato + web app |
| Rota de criar cliente fixando `mode='discovery'` | **B1 + B4** | Confirmar `mode` |
| Migration `chunk_id` + tratamento de duplicata no webhook | **B3** | Migration roda no Supabase de produção (fora do repo) |
| Habilitar reenvio **automático** com garantia de não duplicar; botão `Continuar envio` | **B3** | Cliente pode estar pronto; o "ligar" espera a decisão |
| Encerrar a sessão criada pela Taqciti (`finish` + gatilho no SW) | **B4** | Decisão nova |
| `asyncio.Lock` por sessão em `get_or_create` | **L** (backend, sem contrato) | Pitfall 5; deve ir antes do teste de rajada |
| Teste manual no Chrome (D-20 a–d) | **C** | Depende de tudo acima ligado |
| Docs: ROADMAP/REQUIREMENTS (TAQ-02 já reescrito no working tree, **ainda não commitado**) | **L** | `git status`: `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md` modificados |

**Ordem sugerida de planos/waves:** (1) domínio + fake + comandos + ciclo de vida; (2) UI contra o fake + descarte + evicção + plano B na config; (3) sender/outbox/uploader/backfill (cliente); (4) **gate de decisões 1, 2 e 4** → backend rotas + `mode` + chave opcional + lock + finish; (5) ligar `HttpClientDirectory` e o fluxo real; (6) **gate da decisão 3** → migration + dedup + habilitar reenvio automático/`Continuar envio`; (7) teste manual D-20 e fechamento de docs.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `ExtensionChunk` (pydantic v2, sem `model_config`) ignora campos extras, então enviar `chunk_id` antes da migration é inofensivo | Summary, Code Examples | Se o backend rejeitar extras (422), todo envio quebra — testar com um request real contra o backend local antes de enviar o campo |
| A2 | Violação de unicidade chega ao supabase-py como `APIError` com `.code == "23505"` | Code Examples (D-19) | Duplicata viraria 500 e a retentativa nunca terminaria — cobrir com teste de fake **e** uma chamada real num Supabase de teste |
| A3 | Blocos de 20 requests e pausa de 1000 ms são um bom ponto de partida | Pattern 4 | Backend sobrecarregado (blocos grandes) ou envio lento demais — D-20(a) valida |
| A4 | O custo de Gemini da rajada é limitado pelos timers (30 s/15 s), não por chunk | Pitfall 5 | Se houver outro gatilho por chunk, o custo cresce com a rajada — conferido só por leitura de `pipeline.py` |
| A5 | Carimbo de tempo do chunk não é usado pelo relatório/perguntas além da ordenação | Pitfall 6 | Se for, reuniões enviadas depois ficam com horário errado — exigiria campo `spoken_at` |
| A6 | `GEMINI_API_KEY` está configurada no Railway de produção | Code Examples (D-15) | Sem ela, projetos sem chave própria rodam o pipeline "mudo" (laços ativos, sem IA) — confirmar com o time; não verificável daqui |
| A7 | `chunk_id` como `text` (não `uuid`) é a melhor escolha | Code Examples (D-19) | Time pode preferir `uuid`; só muda a migration e a geração do id determinístico |
| A8 | Adicionar a permissão `alarms` é aceitável para o time | Pattern 5 / Open Questions | Mudança de manifesto; sem ela a retentativa em silêncio depende de nova atividade (legenda, boot, UI) |
| A9 | Retomar o upload do último ack duplica no máximo 1 trecho | Pitfall 12 | Se houver paralelismo no futuro, a margem cresce |
| A10 | Sessão órfã (criada e nunca usada) não gera custo | Pitfall 8 | Se algo abrir o pipeline sem chunk (ex.: WS do web app), passa a gerar — improvável |

## Open Questions (RESOLVED)

> Todas as 8 perguntas têm dono no planejamento (revisão de 2026-10-11): as que são do time viraram
> `checkpoint:decision` com `gate="blocking-human"`; as de política técnica viraram regra explícita de um plano;
> a de cota virou medição obrigatória no teste manual D-20. Cada item abaixo diz onde está resolvido.

1. **Quem encerra a sessão criada pela Taqciti, e quando?** (nova decisão do time, não listada no CONTEXT)
   - Sabemos: sem `finish`, o pipeline segue em laço (Pitfall 1); `finish` antes de 10 min após o fim quebra a retomada da mesma sala; o web app tem o botão "Encerrar" (WS `finish_session`) e a rota `POST /sessions/{id}/finish` existe sem proteção.
   - Falta: política (automática pelo SW com rota gated? manual no web app? timeout no backend?).
   - Recomendação: rota `POST /webhook/extension/sessions/{id}/finish` chamada pelo SW após o fim + outbox vazia + janela de 10 min; alternativa menor: timeout de inatividade no backend (mudança interna sem contrato). Planner: `checkpoint:decision` antes das tasks de backend.
   - **RESOLVIDA — dono:** decisão do time **B4-b**, `checkpoint:decision` da Task 1 do plano **08-15** (rota de finish na Task 2 do 08-15; gatilho por `chrome.alarms` no plano **08-16**). O resíduo "sessão em `send-failed` não retomada" faz parte da mesma resposta.

2. **O que o campo "ID da sessão" da tela de configuração passa a fazer?**
   - Sabemos: o UI-SPEC o mostra só quando a lista falha e também oferece "Vincular com este ID" no picker.
   - Falta: o ID salvo na config vira destino implícito de reuniões futuras? Isso reabre o "palpite" (critério 3).
   - Recomendação: destino **só** via associação; o ID da config pré-existente nunca envia sozinho. O "Vincular com este ID" cria uma associação `origin: 'manual-id'` para aquela reunião. Registrar como decisão do plano.
   - **RESOLVIDA — dono:** o destino só por associação está garantido em código no plano **08-01** (tracer); o papel do campo na tela é a decisão do time **B5**, `checkpoint:decision` da Task 1 do plano **08-18**.

3. **`mode` do cliente criado pela Taqciti.** Recomendação: `discovery` (milestone v3.0). Confirmar.
   - **RESOLVIDA — dono:** decisão do time **B4-a**, dentro do `checkpoint:decision` B1 (Task 1 do plano **08-07**); aplicada na Task 1 do plano **08-12** (`EXTENSION_CLIENT_MODE`).

4. **Adicionar `alarms` ao manifesto?** Sem ele, uma fila offline pendente só reenvia no próximo flush (legenda), no boot do SW ou por comando de UI. Com ele, reenvio periódico mesmo em silêncio (mínimo 30 s, Chrome ≥ 120). Recomendação: adicionar, como task própria com a seção 6 do template.
   - **RESOLVIDA — dono:** parte da decisão do time **B4-b** (opção `sw-com-alarms`, Task 1 do plano **08-15**); a permissão entra na Task 2 do plano **08-16**, com a seção 6 própria.

5. **Política de evicção do histórico (100).** Recomendação: nunca descartar `ended-unsent`/`send-failed`; avisar quando o histórico estiver cheio de não enviados.
   - **RESOLVIDA — dono:** plano **08-13**, Task 1 (`selectRecordsToKeep`: teto suave, nunca evicta reunião não enviada — suposição protetiva e reversível). O aviso "histórico cheio de não enviadas" não tem cópia no UI-SPEC e fica registrado como DECISÃO EM ABERTO não bloqueante na seção 6 do 08-13; a cota real é medida no D-20 (plano **08-21**, Task 2).

6. **Duplicidade de nome de cliente.** O UI-SPEC tem a cópia "Já existe um cliente com esse nome." Não há índice único em `projects.client` (e dados antigos podem ter nomes repetidos). Recomendação: checar no service (409, sem acento/caixa) + pré-checar na lista do cliente; **não** criar índice único.
   - **RESOLVIDA — dono:** item do `checkpoint:decision` B1 (Task 1 do plano **08-07**); implementada no service (Task 1 do **08-12**, 409) e na pré-checagem do seletor (Task 3 do **08-03**).

7. **Limite de nome (120).** O UI-SPEC assume `maxLength` 120 até a decisão 1; usar o mesmo valor em `Field(max_length=120)` e no `TextField`.
   - **RESOLVIDA — dono:** item do `checkpoint:decision` B1 (Task 1 do plano **08-07**); aplicado em `ClientCreateForm` (Task 3 do **08-03**) e em `ExtensionClientCreate` (Task 1 do **08-12**).

8. **`unlimitedStorage`?** Histórico (100 reuniões) + outbox + associações dividem 10 MB. Estimativa `[ASSUMED]`: reunião de 1 h ≈ dezenas de KB de texto (folga grande), mas não medida. Recomendação: medir o `chrome.storage.local.getBytesInUse()` no teste manual e só pedir `unlimitedStorage` se passar de ~50%.
   - **RESOLVIDA — dono:** medição obrigatória no roteiro manual D-20 (plano **08-21**, Task 2: `chrome.storage.local.getBytesInUse(null)` anotado depois da reunião longa). Pedir `unlimitedStorage` só se passar de ~5 MB (50% da cota) — decisão do time registrada como DECISÃO EM ABERTO não bloqueante na seção 6 dos planos **08-11** e **08-23**.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Testes/typecheck da Taqciti | ✓ | v24.12.0 | — |
| npm deps de `taqciti/` | Vitest/tsc/eslint | ✓ | `node_modules` presente; suíte roda | `npm ci` |
| Python | Testes do backend | ✓ | 3.13.14 | — |
| postgrest/supabase-py | Rotas e `APIError` | ✓ | postgrest 2.31.0 | — |
| Chrome (para D-20) | Teste manual com Meet real | ✗ (não verificável aqui) | `minimum_chrome_version: '116'` | Pessoa com Chrome ≥ 116 faz o teste |
| Backend local em `:8000` + Supabase | Teste manual | ✗ (não verificado; exige `.env` que não deve ser lido) | — | Subir como na Fase 7 (07-DECISOES-REVIEW-2: backend local `:8000`, web app `:5173`) |
| `GEMINI_API_KEY` no servidor | D-15 em produção | ✗ (não verificável) | — | Confirmar com o time (A6) |
| Migrations no Supabase de produção | `chunk_id` | ✗ (fora do repo) | — | Aplicar manualmente após decisão 3 |

**Missing dependencies with no fallback:** nenhuma para planejar/implementar; o teste manual (D-20) depende de ambiente que só a pessoa do time tem.
**Missing dependencies with fallback:** ver tabela.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^3.2.7` (jsdom) em `taqciti/`; pytest `>=8` + pytest-asyncio (`asyncio_mode = auto`) em `backend/` |
| Config file | `taqciti/vitest.config.ts` (alias `@` → `src`, `include: ['src/**/*.test.{ts,tsx}']`); `backend/pytest.ini` |
| Quick run command | `cd taqciti && npx vitest run <arquivo>` · `cd backend && python -m pytest tests/<arquivo> -x -q` |
| Full suite command | `cd taqciti && npm test && npm run typecheck && npm run lint` (baseline: 42 arquivos / 619 testes) · backend: rodar **só** os arquivos puros (padrão `test_webhook_auth.py`); `test_schema.py`/`conftest.supabase_client` falam com o Supabase real e exigem `.env` |

Utilitário existente: `taqciti/src/test/chromeStorageMock.ts` (`installChromeStorageMock` com `onChanged` real — usar para os stores novos).

### Phase Requirements → Test Map
| Critério (TAQ-02) | Behavior | Test Type | Automated Command | File Exists? |
|-------------------|----------|-----------|-------------------|-------------|
| SC1 | Reducer: `pending → choosing → linking → linked`; criar cliente → vincular | unit | `cd taqciti && npx vitest run src/features/agente/association.test.ts` | ❌ Wave 0 |
| SC1 | Picker: busca sem acento/caixa, seleção em 2 passos, criar cliente, estados loading/empty/error | component | `cd taqciti && npx vitest run src/sidepanel/components/ClientPicker.test.tsx` | ❌ Wave 0 |
| SC1 | `bind`: cria sessão via `ClientDirectory` fake, backfill paced em ordem, cursor primado | integration (estilo `agenteStreamer.test.ts`) | `cd taqciti && npx vitest run src/background/agenteAssociationService.test.ts` | ❌ Wave 0 |
| SC1 | Rotas: listar (campos mínimos), criar (nome, `mode`, duplicado 409), sessão; 401 sem chave com gate ligado | unit (fakes, sem TestClient) | `cd backend && python -m pytest tests/test_extension_clients.py -x -q` | ❌ Wave 0 |
| SC2 | Reunião `pending`/`deferred` **nunca** chama `send` (inclusive com `agenteSessionId` salvo na config) | integration | `cd taqciti && npx vitest run src/background/agenteStreamer.test.ts` (estender) | ✅ estender |
| SC2 | Fim da reunião sem vínculo ⇒ `ended-unsent`; descartar remove registro + associação + outbox; histórico cheio não evita não enviados | unit/integration | `cd taqciti && npx vitest run src/background/agenteAssociationService.test.ts src/background/history.test.ts` | ❌ Wave 0 (`history.test.ts` não existe) |
| SC2 | Upload em blocos: ordem, K por bloco, pausa (sleep fake), progresso por índice, falha ⇒ `send-failed` | unit | `cd taqciti && npx vitest run src/features/agente/meetingUploader.test.ts` | ❌ Wave 0 |
| SC2 | `ConfirmModal` com `cancelLabel` e `Esc`/fundo = cancelar | component | `cd taqciti && npx vitest run src/shared/ui/ConfirmModal.test.tsx` | ❌ Wave 0 |
| SC3 | `AgenteConfigScreen`: campo de ID só com lista em erro; apoio com lista carregada | component | `cd taqciti && npx vitest run src/sidepanel/screens/AgenteConfigScreen.test.tsx` | ✅ estender (arquivo novo p/ casos novos) |
| SC3 | Sem associação `linked` ⇒ nenhum envio; "Vincular com este ID" cria associação `manual-id` | integration | `cd taqciti && npx vitest run src/background/agenteStreamer.test.ts` | ✅ estender |
| SC4 | Falha retryable ⇒ item vai para a outbox (persistida), status `offline` + contador; nunca "descarta o mais antigo" | unit | `cd taqciti && npx vitest run src/background/agenteSender.test.ts` | ✅ estender |
| SC4 | Reinício do SW rehidrata a outbox e reenvia em ordem; mesmo `chunkId` entre tentativas; a chave **não** está no item persistido | integration | `cd taqciti && npx vitest run src/background/agenteOutbox.test.ts` | ❌ Wave 0 |
| SC4 | Webhook: `chunk_id` repetido ⇒ 202 sem `push_chunk`; sem `chunk_id` ⇒ comportamento atual | unit (fake `APIError`) | `cd backend && python -m pytest tests/test_webhook_idempotency.py -x -q` | ❌ Wave 0 (**B3**) |
| Backend | 2 chamadas concorrentes a `get_or_create` ⇒ 1 pipeline | unit async | `cd backend && python -m pytest tests/test_pipeline_get_or_create_lock.py -x -q` | ❌ Wave 0 |
| Backend | `ProjectCreate` sem `gemini_api_key` válido; sem vault chamado | unit | `cd backend && python -m pytest tests/test_projects.py -x -q` | ✅ estender (**B2**) |
| D-20 | Manual no Chrome: (a) blocos no fim, (b) queda do Agente + reenvio, (c) descarte com confirmação, (d) vínculo no meio, + checagens visuais "backstop" do UI-SPEC (cartão em 320/564 px, selo no histórico, modal com título longo, picker em 320 px) | manual (`checkpoint:human-verify`) | roteiro em VERIFICATION/UAT | — |

### Sampling Rate
- **Por commit de task:** o arquivo de teste da task (`npx vitest run <arquivo>` ou `pytest tests/<arquivo> -x -q`).
- **Por wave:** `cd taqciti && npm test && npm run typecheck && npm run lint` (+ os testes puros do backend tocados).
- **Gate da fase:** suíte completa da Taqciti verde, typecheck e lint limpos, testes puros do backend verdes, `npm run build`, e o teste manual D-20.

### Wave 0 Gaps
- [ ] `taqciti/src/features/agente/association.test.ts` — SC1/SC2 (reducer)
- [ ] `taqciti/src/features/agente/meetingUploader.test.ts` — SC2 (blocos/ordem/progresso)
- [ ] `taqciti/src/features/agente/clientSearch.test.ts` — busca sem acento
- [ ] `taqciti/src/shared/config/agenteAssociationStore.test.ts`, `agenteOutboxStore.test.ts`, `agenteDeliveryStore.test.ts` — escritor único, valor inteiro, teto
- [ ] `taqciti/src/background/agenteAssociationService.test.ts`, `agenteOutbox.test.ts` — SC1/SC4
- [ ] `taqciti/src/background/history.test.ts` — evicção protegida (hoje não há teste do `history.ts`)
- [ ] `taqciti/src/sidepanel/components/{ClientPicker,AgenteDecisionCard,AgenteBindingBar,AgenteEndPrompt}.test.tsx`, `taqciti/src/shared/ui/ConfirmModal.test.tsx`
- [ ] `backend/tests/test_extension_clients.py`, `test_webhook_idempotency.py` (B3), `test_pipeline_get_or_create_lock.py`
- [ ] Framework: nenhum a instalar.

## Security Domain

`security_enforcement` não está desligado em `.planning/config.json` (chave ausente = habilitado). Nível ASVS L1 (como na Fase 7).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | parcial | Header `x-agente-key` com `secrets.compare_digest` já existente (`verify_extension_key`); gate **opt-in** — sem `EXTENSION_SHARED_KEY` as rotas novas ficam abertas (ver ameaça T1) |
| V3 Session Management | não | Sem sessão de usuário; "sessão" aqui é entidade de negócio |
| V4 Access Control | sim | Rotas da extensão só sob o gate; `GET /projects`/`/sessions` abertos por decisão (D-17); resposta mínima nas rotas novas |
| V5 Input Validation | sim | zod nos comandos `ui/agente/*`; Pydantic nas rotas (`Field(min_length=1, max_length=120)`, UUID de `project_id`/`session_id`, `chunk_id` com tamanho máximo); `strip` no nome |
| V6 Cryptography | não | Nada novo; não inventar cifra para a outbox (texto já mora em claro em `storage.local`) |
| V8 Data Protection | sim | Transcrição em `storage.local` (já existe) + outbox temporária; sem segredo na outbox; limpar ao descartar/entregar; não logar texto (só contagens, allowlist `SAFE_LOG_KEYS`) |
| V9 Communications | sim | `isValidAgenteBackendUrl` já exige https fora de loopback — reaproveitar nas chamadas novas |
| V13 API | sim | CORS `allow_origins=["*"]` (existente); respostas de erro consistentes (401 padrão da Fase 6; 404 para sessão inexistente — IN-05) |

### Known Threat Patterns for {extensão MV3 + FastAPI/Supabase}

| # | Pattern | STRIDE | Standard Mitigation |
|---|---------|--------|---------------------|
| T1 | Rotas novas abertas quando `EXTENSION_SHARED_KEY` não está definida: qualquer pessoa cria clientes/sessões e dispara pipelines com a chave do servidor | Spoofing / Elevation / DoS (custo) | Gate `verify_extension_key`; **decisão do time** sobre exigir o gate nas rotas de **escrita** mesmo sem a env var; documentar o risco (D-17 já registra a leitura aberta) |
| T2 | Listagem vaza mais do que precisa (`pre_meeting_context`, orçamento) | Information disclosure (LGPD) | Schema de resposta próprio `{id, client, name}`; nunca `ProjectResponse` |
| T3 | Atribuição ao cliente errado (dado de um cliente no relatório de outro) | Repudiation / Tampering | Vínculo explícito persistido; destino fixado na fala ao abrir (IN-11); nenhum envio sem associação `linked`; `sessionId` viaja em cada item da outbox |
| T4 | Transcrição duplicada ou perdida no reenvio | Tampering | `chunk_id` + índice único (B3); serial; ack por índice |
| T5 | Segredo persistido por engano na outbox/associação | Information disclosure | Item sem headers; teste que inspeciona o valor gravado e prova ausência da chave |
| T6 | Rajada de envio derruba o backend / bloqueia o event loop | DoS | Serial + pacing + `Lock` por sessão; teto de outbox |
| T7 | Comando de descarte acidental/forjado | Tampering | Confirmação na UI; comando no SW valida `meetingId` existente e estado permitido (só não enviado); mensagens só de contextos da extensão (`externally_connectable` não declarado) |
| T8 | XSS via nome de cliente | Tampering | Render por React (texto escapado), nunca `dangerouslySetInnerHTML`; `title` como atributo de texto |
| T9 | Sessão inexistente vira 500 e dispara retentativa inútil (IN-05) | DoS | 404 para `session_id` desconhecido (junto da decisão 1); a política atual já trata 4xx como definitivo |
| T10 | Esgotar a cota de `storage.local` (histórico + outbox) | DoS local | Teto da outbox, status `overflow`, evicção protegida; tratar rejeição de escrita com log e status |

## Sources

### Primary (HIGH confidence)
- Código lido nesta sessão (caminhos relativos a `C:/Users/anton/OneDrive/Desktop/Agente-Diagnostico`): `taqciti/src/background/{agenteSender,agenteStreamer,agenteStreamerInstance,agenteStreamerSnapshot,agenteStreamerDeps,agenteStatusReporter,sessionController,history,index}.ts`, `taqciti/src/features/agente/{sendRetryPolicy,wordDelta,phraseBatcher}.ts`, `taqciti/src/features/meeting/machine.ts`, `taqciti/src/shared/config/{agenteConfig,agenteConfigStore,agenteBindingStore,agenteStatus,agenteStatusStore,constants}.ts`, `taqciti/src/shared/types/{domain,messages}.ts`, `taqciti/src/shared/platform/*`, `taqciti/src/content/ui/{PanelApp.tsx,mount.ts}`, `taqciti/src/sidepanel/**`, `taqciti/manifest.config.ts`; `backend/app/routers/{webhook,projects,sessions,ws}.py`, `backend/app/models/{projects,sessions}.py`, `backend/app/services/pipeline.py`, `backend/app/main.py`, `supabase/migrations/20260524000000_initial_schema.sql`, `20260921000000_add_mode_to_projects.sql`; `frontend/src/pages/{ProjectFormPage,ProjectDetailPage}.tsx`.
- Execução local: `npx vitest run` (619 testes verdes), `pytest tests/test_webhook_auth.py` (4 verdes), `inspect` de `postgrest` (assinatura de `upsert`; `APIError.code`).
- https://developer.chrome.com/docs/extensions/reference/api/storage — `storage.local` 10 MB (`unlimitedStorage` ignora a cota), `storage.session` 10 MB, escrita acima da cota rejeita, `session` limpo ao reiniciar o navegador e **não exposto a content scripts** por padrão.
- https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle — idle de 30 s, perda de globais, alarmes com período mínimo de 30 s (Chrome 120), `fetch` com resposta > 30 s derruba o SW.

### Secondary (MEDIUM confidence)
- https://docs.postgrest.org/en/stable/references/api/tables_views.html — `on_conflict` e `Prefer: resolution=ignore-duplicates` (a página não descreve o corpo da resposta para duplicatas ignoradas; por isso a recomendação é `insert` + tratar `23505`).

### Tertiary (LOW confidence)
- Nenhuma fonte só-web foi usada. Valores de pacing, estimativas de tamanho e comportamento de `extra="ignore"`/`23505` estão no Assumptions Log.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — nenhuma dependência nova; versões lidas do repositório e do ambiente.
- Architecture: HIGH nas costuras (onde o código existente obriga o desenho) / MEDIUM nas escolhas de armazenamento e pacing (recomendações, não fatos).
- Pitfalls: HIGH para 1–4, 7, 9–10 (verificados no código); MEDIUM para 5–6 e 8 (análise de concorrência e de ordem, sem medição).

**Research date:** 2026-10-11
**Valid until:** 2026-11-10 (30 dias; o código-base é estável, mas as decisões do time podem mudar os contratos)
