# Fase 10: AGP Question Panel in Taqciti - Pesquisa

**Pesquisado em:** 2026-10-28
**Domínio:** extensão Chrome MV3 (Taqciti, `taqciti/`): service worker, abas do navegador, WebSocket de leitura, UI React. Fase de **fechamento de lacunas** sobre código já integrado (merge `d896c64`), não construção do zero.
**Confiança geral:** ALTA nos caminhos de código e nos comandos (lidos e executados nesta sessão); MÉDIA em dois pontos de comportamento do Chrome (ver Log de Suposições).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** **Adotar o código como está e fechar as lacunas.** O `/gsd-plan-phase 10` gera planos **só** para: as correções de D-02 a D-05, a validação real (D-13 a D-15) e a formalização (docs). Nada do que o Gabriel fez é reescrito sem motivo. A fase ganha CONTEXT, planos e VERIFICATION do GSD. Os 7 testes do `10-UAT.md` são a base do UAT, ampliados para cobrir as correções.
- **D-02:** **WR-05 entra:** "Continuar envio" (`resumeStoppedSend`/`prepareResume`) passa a conferir `agenteSessionFinisher.isClosing(meetingId)` antes de limpar as marcas de encerramento. É correção de **comportamento** (código da Fase 8), em commit próprio.
- **D-03:** **Reunião aberta em duas abas entra** ("Participar também"): fechar ou navegar a segunda aba não pode encerrar a reunião da primeira (vale para DA-3 e DA-4). Mexe nas regras de encerramento; comportamento novo, testado e em commit próprio.
- **D-04:** **WR-06 entra, com a permissão `tabs` no manifesto**, para a DA-4 disparar também ao ir para `chrome://` (Nova Guia), `file://`, `about:` e `data:`. — **Reversibility:** costly — o Chrome **desativa a extensão em quem já a tem** até a pessoa reaceitar a permissão nova, e o aviso de instalação passa a dizer que a extensão lê o histórico de navegação. Como a distribuição ainda não foi definida (CONTEXT da Fase 9), o custo de comunicação hoje é pequeno. O plano deve sinalizar isso em destaque e ficar em commit separado do resto, para ser revertido sozinho.
- **D-05:** **Dividir `taqciti/src/background/index.ts` (>200 linhas)** entra, mas como **refatoração pura**, em commit separado, **depois** das correções, sem mudar comportamento (regra do `CLAUDE.md`: nunca misturar correção com refator). Teste de regressão antes e depois (mesma saída dos testes existentes).
- **D-06:** Os documentos velhos `.planning/RETOMAR-AQUI.md`, `.planning/PENDENCIAS-FASE-08.md` e `.planning/PENDENCIAS-FASE-10.md` são **marcados como superados** com um aviso no topo apontando para este CONTEXT e o ROADMAP. **Não apagar.**
- **D-07:** Quando a Fase 10 entrar na `main`, o `CLAUDE.md` ganha uma frase corrigindo o trecho que diz que a Taqciti não usa o WebSocket: com a aba AGP ela usa `/ws/{session_id}` (somente leitura).
- **D-08:** **Na Fase 10 a aba só mostra.** Gerar, fixar, descartar (e marcar como usada) **não** entram. O que você pediu (não precisar sair do Meet) vira a **Fase 10.1**, a inserir no roadmap.
- **D-09:** **Divergência aceita e documentada** até a 10.1: o backend não avisa por WebSocket quando alguém fixa/descarta no site. Pergunta descartada no site continua na Taqciti até o TTL ou reconexão; fixada no site some no TTL. Sem código novo e sem aviso na tela; o UAT e a página de ajuda explicam. — **Reversibility:** reversible — é só texto; a 10.1 resolve de verdade.
- **D-10:** **Aceitar o `/ws/{session_id}` sem autenticação até o login do AGM**, na mesma linha de D-08 (Fase 9) e D-17 (Fase 8). **Nada muda no backend.** Registrar o risco de LGPD: quem tiver o id da sessão (UUID) lê as perguntas e, por esse mesmo endpoint, pode mandar `generate_questions`, `pin_question`, `dismiss_question` e `finish_session`. A Taqciti só lê. O 4004 continua impedindo conexão em sessão encerrada. — **Reversibility:** costly — fechar isso depois mexe no contrato do `/ws` que o web app (Fase 5) também usa.
- **D-11:** **O feed só conecta com a reunião em `recording`, vinculada de forma explícita e com o envio ao Agente ligado (`streamingEnabled`)** (resolve o WR-04). Em pausa, sem legendas (`captionsRequired`) ou com o envio desligado, fecha a conexão e **mantém na tela as perguntas já recebidas**; ao voltar a gravar, reconecta e recebe o `initial_state`. Motivo: conectar cria o pipeline de IA e gasta Gemini. Muda comportamento do `agpQuestionsFeed.ts` / `agpTarget.ts`, em commit próprio, com teste de tabela para cada estado.
- **D-12:** Backoff de reconexão, parada no 4004 e a regra "sem relógio local para expirar pergunta" (correções CR-01/WR-01/WR-02/WR-03/WR-07 do `10-REVIEW.md`) **ficam como o Gabriel deixou**. Não reabrir.
- **D-13:** **A fase só fecha com a prova no Chrome real e com IA de verdade:** os testes 2 e 3 do `10-UAT.md` têm que mostrar uma pergunta real, com a lente certa, chegando na Taqciti e expirando. Por isso o **Gemini precisa estar com crédito** antes do `/gsd-verify-work 10` (quem tem acesso à chave recarrega ou troca; **o assistente nunca abre o `.env`**). Enquanto não houver crédito, rodar só os testes que não dependem de IA (1, 4, 5, 6, 7). O backend falso (`taqciti/scripts/agp-fake-backend.py`) e a fumaça `agpBackendSmoke` continuam como teste **automático**, nunca como prova final.
- **D-14:** **Rodar `/gsd-ui-phase 10` antes de planejar** (o ROADMAP marca `UI hint: yes`). O UI-SPEC fixa: emblemas Produto/Dados, estados (sem vínculo, vazio, reconectando, com perguntas), contador na aba, painel compacto dentro do Meet e tela larga. Depois da execução, `/gsd-ui-review 10` audita contra ele.
- **D-15:** O UAT ganha testes para as correções: WR-05 (continuar envio durante encerramento), duas abas na mesma call, ida para `chrome://` com a DA-4, e o feed fechando em pausa/envio desligado (D-11). O build da Taqciti para teste local deve ser refeito com `VITE_AGENTE_BACKEND_URL=http://127.0.0.1:8000 VITE_AGENTE_STREAMING_ENABLED=true` (o `dist` atual foi sobrescrito com o endereço padrão) e dar ↻ em `chrome://extensions`.

### Claude's Discretion

- Nomes de arquivos/funções dos ajustes, textos exatos das mensagens do painel (dentro do que o UI-SPEC definir).
- Como o WR-05 e a regra de duas abas são testados (unitário vs integração), desde que cada um tenha um teste que falha sem a correção.
- Divisão dos planos em ondas e ordem dos commits, respeitando: correção e refator nunca no mesmo commit; a permissão `tabs` (D-04) em commit separado.

### Deferred Ideas (OUT OF SCOPE)

- **Fase 10.1 (a inserir no roadmap com `/gsd-phase`): ações na aba AGP.** "Gerar agora", fixar, descartar e marcar como usada, direto na Taqciti. Pontos que a discussão dela precisa tratar: (a) o `/ws` **já aceita** os comandos `generate_questions`, `pin_question`, `dismiss_question` e `use_question`, mas sem autenticação, então reutilizá-los só é aceitável depois de D-10 ser revisto, senão a alternativa é rota(s) nova(s) sob `/webhook/extension` com `x-agente-key`; (b) o backend precisa **transmitir** pin/dismiss/use por WebSocket para site e Taqciti não divergirem; (c) "Gerar agora" gasta Gemini a cada clique; (d) é mudança de contrato da API, então plano próprio e decisão do time.
- Login do AGM / proteção do `/ws` (fecha D-10 e o risco de LGPD de `GET /projects`, Fase 8 D-17).
- Retirada da geração de PRD (esconder x remover): trabalho à parte, nunca misturado com esta fase.
- Distribuição da Taqciti (GitHub Release, arquivo no web app, instaladores) e comunicação da nova permissão `tabs`: definir junto com o deploy.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Descrição | O que a pesquisa entrega |
|----|-----------|--------------------------|
| TAQ-05 | Durante a call, as perguntas de discovery geradas pelo backend (cada uma com a lente produto/dados) aparecem quase em tempo real numa aba "AGP" da Taqciti, restritas à sessão vinculada. | Mapa do feed existente (SC1/SC2/SC3 já atendidos pelo código do Gabriel; 1513 testes + fumaça 3/3 verdes). O que falta para SC1 e SC4 valerem de verdade: D-11 (custo/estados), D-02/D-03/D-04/D-05 (não atrapalhar captura/encerramento), lacunas de UI do UI-SPEC e a prova no Chrome real (D-13/D-15). |
</phase_requirements>

## Restrições do Projeto (do CLAUDE.md)

- **Idioma:** toda prosa em português claro; identificadores, caminhos e comandos ficam como estão.
- **SOLID e arquivos pequenos:** um arquivo, uma responsabilidade; acima de ~200 linhas é sinal de que faz coisas demais (é o motivo do D-05).
- **Cada task de plano** tem as 7 seções, nesta ordem: (1) O que muda em linguagem comum, (2) Como vai ser alterado, (3) Riscos de cada ação, (4) Como prevenir, (5) Como consertar (rollback), (6) Decisões que são do usuário/time, (7) Verificação ponta a ponta. Cada task deixa ao menos 1 teste real.
- **Correção crítica e refator nunca no mesmo commit.** Refator não muda comportamento.
- **Decisão do time = parar e perguntar** (marcar DECISÃO EM ABERTO). Aqui não há nenhuma aberta: as quatro do `10-PLAN.md` do Gabriel foram fechadas no CONTEXT.
- **Segredos:** nunca ler `.env`, `backend/.env`, `taqciti/server/.env.local`. Ler só `.env.example`.
- **Branch por fase:** a branch atual `feat/fase-10-agp-integracao` já é a da fase; não misturar a Fase 10.1 nela.
- **Estado de teste do GSD:** `/gsd-verify-work` com sessão em `sonnet` + `high` (preferência do time, não trava).

## Resumo

A aba AGP já existe, funciona nos testes automáticos e segue as regras certas de segurança (lista branca de campos, só leitura, 4004 para de vez, sem relógio local). **Medido nesta sessão:** `npx vitest run` = 97 arquivos passando (1 pulado), **1513 testes passando, 3 pulados** (111 s); `npx tsc --noEmit` limpo; `npx eslint src` limpo; fumaça AGP contra o roteador WS real = 3/3 (15 s); `vite build` ok (5,6 s). O que a fase tem de fazer é fechar lacunas em **cinco frentes independentes**: (a) uma correção de comportamento no "Continuar envio" (D-02), (b) a regra de duas abas (D-03), (c) a permissão `tabs` (D-04), (d) o estado "pausado" do feed (D-11 + M-1 do UI-SPEC) e (e) o polimento visual do UI-SPEC (M-2 a M-6); depois uma refatoração pura do `index.ts` (D-05), a documentação (D-06/D-07) e a prova no Chrome real (D-13/D-15).

Três descobertas mudam o que o planejador deve escrever. **Primeira:** a documentação oficial do Chrome diz que o aviso do `tabs` **não aparece quando a extensão já pede `<all_urls>`** — e a Taqciti já pede (`host_permissions: ['<all_urls>']`). Logo a premissa "costly" do D-04 (extensão desativada em quem já a tem, aviso de histórico) provavelmente está superestimada; a decisão continua travada, mas o plano deve **medir** isso com `chrome.management.getPermissionWarningsByManifest` em vez de assumir. **Segunda:** o `index.ts` não tem **nenhum** teste que o importe, então "mesma saída dos testes antes e depois" (D-05) **não prova nada** sobre o registro dos listeners; o plano precisa de um teste de caracterização escrito **antes** do corte. **Terceira:** ao ler o backend, "pergunta fixada no site some no TTL" (D-09) está **errado**: `_expire_due_questions` só expira `status == "queued"`, e o `pin_question` do `/ws` muda o status em memória para `pinned`, então **nenhum `question_expired` é emitido** e o cartão fica na Taqciti até a reconexão. Isso muda só o texto de D-09/UI-SPEC A-4/UAT 3, não o código.

**Recomendação principal:** quatro planos em ondas (ver "Divisão sugerida em planos"), com D-02, D-03, D-11+M-1 em paralelo na onda 1 (arquivos disjuntos), D-04 e o polimento de UI na onda 2, e D-05 + docs + UAT real por último, porque o refator do `index.ts` só pode vir depois de tudo que mexe nele (D-03 acrescenta código ali).

## Mapa de Responsabilidade Arquitetural

(Camadas desta fase: o "frontend server" e o CDN do modelo padrão não existem aqui; a extensão tem service worker, content script/painel e storage.)

| Capacidade | Camada principal | Camada secundária | Por quê |
|------------|------------------|-------------------|---------|
| Dono do WebSocket e da reconexão | Service worker (`agpQuestionsFeed.ts`) | — | O painel injetado no Meet não fala com o backend (comentário de `useAgpQuestions.ts`); só o worker abre socket e grava no storage. |
| Decidir "qual sessão seguir / segurar / limpar" | Regra pura em `features/agente/agpTarget.ts` | Composição em `agpQuestionsFeedInstance.ts` | Pura e sem `chrome`: testável por tabela (D-11). |
| Perguntas e estado de conexão para a UI | `chrome.storage.local` (`agpQuestionsStore.ts`) | — | O content script do Meet não lê `storage.session`; escritor único = worker. |
| Mostrar abas, estados, cartões, contador | Painel/UI (`AgpLiveTabs`, `AgpQuestionsPanel`) | — | Só apresentação por props; nada de lógica de negócio no JSX. |
| Saber se a reunião está ao vivo / pausada / `streamingEnabled` | `sessionController` (`getState()` em memória, `taq:state` em `storage.session`) e `agenteConfigStore` (`storage.local`) | — | Já dirigem o feed por `chrome.storage.onChanged`. |
| Encerrar sessão quando a aba fecha/navega | Service worker (`meetingTabClosed.ts`, `meetingTabNavigated.ts`) | Máquina da reunião (`machine.ts`) | Regras puras com portas injetadas; D-03 acrescenta uma porta "outras abas da mesma sala". |
| Permissão `tabs` | Manifesto (`manifest.config.ts`) | — | Só configuração; sem código novo para a DA-4 funcionar. |
| Perguntas e lentes (origem da verdade) | Backend (`/ws/{session_id}`), **somente leitura nesta fase** | — | D-10: nada muda no backend. |

## Stack Padrão

**Nenhum pacote novo.** Tudo o que a fase precisa já está no `taqciti/package.json` (lido nesta sessão):

| Biblioteca | Versão (package.json) | Uso | Observação |
|------------|-----------------------|-----|------------|
| react / react-dom | ^18.3.1 | UI da aba | já em uso |
| zod | ^3.25.0 | validação de mensagens `ui/*` | já em uso |
| vitest | ^3.2.7 (rodou v3.2.7) | testes | ambiente `jsdom` (`vitest.config.ts`), `include: ['src/**/*.test.{ts,tsx}']` |
| typescript | ^5.6.3 | `tsc --noEmit` | já em uso |
| eslint / typescript-eslint | ^9.15.0 / ^8.15.0 | lint | já em uso |
| @crxjs/vite-plugin | ^2.4.0 | build MV3 | `defineManifest = (manifest) => manifest` [VERIFIED: grep em `node_modules/@crxjs/vite-plugin/dist/index.mjs`], ou seja, o manifesto é um objeto simples e dá para testar em `vitest` |

### Alternativas consideradas

| Em vez de | Poderia usar | Tradeoff |
|-----------|--------------|----------|
| Permissão `tabs` (D-04, travada) | `optional_permissions: ['tabs']` + `chrome.permissions.request` | A doc diz que o pedido exige gesto do usuário dentro de um contexto da extensão ("Permissions must be requested from inside a user gesture") [CITED: developer.chrome.com/docs/extensions/reference/api/permissions]; o próprio `manifest.config.ts` (linhas 115-119) registra que o gesto de um clique **dentro do painel injetado** não atravessa (acontece na página). Só funcionaria a partir da saída larga/popup, e a regra DA-4 ficaria ligada a "quem clicou em ativar". **Não recomendado** — registrado para o time, D-04 permanece. |
| `chrome.tabs.query` sob demanda (D-03) | Registro persistido de abas por reunião em `storage.session` | O registro é mais rápido de consultar mas cria estado novo que precisa sobreviver ao sono do worker e ser limpo; a consulta sob demanda é sem estado. Recomendada a consulta sob demanda. |

**Instalação:** nenhuma. **Auditoria de pacotes:** ver abaixo.

## Auditoria de Legitimidade de Pacotes

Esta fase **não instala nenhum pacote externo**. Nenhuma execução de `package-legitimacy check` foi necessária.

| Pacote | Registro | Idade | Downloads | Repo | Veredito | Disposição |
|--------|----------|-------|-----------|------|----------|------------|
| (nenhum novo) | — | — | — | — | — | — |

**Pacotes removidos por SLOP:** nenhum. **Pacotes sinalizados SUS:** nenhum.

## Padrões de Arquitetura

### Diagrama do fluxo (o que existe hoje + o que a fase acrescenta)

```
 Meet (aba 1)         Meet (aba 2, "Participar também")        Aba qualquer
 content script       content script                           content script (painel)
      │ meet/detected, meet/chunk, meet/ended  │ (tabId = última aba que detectou)
      ▼                                         ▼
 ┌──────────────────── service worker (background/index.ts) ────────────────────┐
 │  onMessage ──► sessionController.dispatch ──► machine.transition             │
 │                    │ (taq:state em storage.session, flush)                    │
 │                    ├──► syncAssociationLifecycle ──► agenteSessionFinisher    │
 │                                                                                │
 │  tabs.onRemoved ─► meetingTabClosed   (DA-3) ┐  [D-03: consulta "outra aba    │
 │  tabs.onUpdated ─► meetingTabNavigated(DA-4) ┘   na mesma sala?" antes de     │
 │     (changeInfo.url; [D-04] com `tabs` vem também p/ chrome://)   encerrar]    │
 │  runtime.onStartup ─► finisher.restartGaveUpRounds (DA-5, 1x por abertura)     │
 │                                                                                │
 │  storage.onChanged(associações | config | taq:state) ─► agpQuestionsFeed       │
 │        selectTarget()  ── [D-11] decideAgpFollow(assoc, fase, streamingEnabled)│
 │              ├─ follow ─► abre WebSocket /ws/{sessionId} ─► initial_state,     │
 │              │            question_new, question_expired ─► applyAgpMessage    │
 │              ├─ hold   ─► fecha socket, MANTÉM lista, publica 'paused'         │
 │              └─ none   ─► fecha socket, LIMPA, publica vazio/idle              │
 └───────────────────────────────┬────────────────────────────────────────────────┘
                                 │ writeAgpFeed → chrome.storage.local ('taq:agpQuestions')
                                 ▼
        AgpLiveTabs (contador) + AgpQuestionsPanel (faixa, lista, avisos)
        em PanelApp.tsx (painel do Meet, 396 px) e LiveScreen.tsx (saída larga)

 Backend (SOMENTE LEITURA): routers/ws.py  → 4004 se sem pipeline; services/pipeline.py →
 question_expired a cada 1 s só para status 'queued'.
```

### Estrutura recomendada (arquivos que a fase toca ou cria)

```
taqciti/
├── manifest.config.ts                          # D-04: + 'tabs' (commit isolado)
└── src/
    ├── background/
    │   ├── index.ts                            # D-05: fica ~30 linhas; só compõe
    │   ├── bootstrap.ts          (novo, D-05)  # cadeia `ready` + relaunchLiveLinks
    │   ├── browserListeners.ts   (novo, D-05)  # onInstalled, action.onClicked, tabs.*, onStartup, alarms
    │   ├── messageRouter.ts      (novo, D-05)  # o switch do onMessage (subdividir se >200 linhas)
    │   ├── index.test.ts         (novo, ANTES do D-05) # teste de caracterização
    │   ├── agenteBindResume.ts / agenteBindFlow.ts / agenteAssociation.ts   # D-02
    │   ├── meetingTabClosed.ts / meetingTabNavigated.ts + novo meetingRoomTabs.ts   # D-03
    │   └── agpQuestionsFeed.ts / agpQuestionsFeedInstance.ts                # D-11
    ├── features/
    │   ├── meeting/machine.ts                  # D-03: evento novo para reapontar `tabId`
    │   └── agente/agpTarget.ts                 # D-11: decisão pura follow/hold/none
    ├── shared/config/agpQuestionsStore.ts      # M-1: 'paused' em AgpConnection e CONNECTIONS
    └── sidepanel/components/AgpQuestionsPanel.tsx, AgpLiveTabs.tsx   # M-1..M-6
```

### Mapa por decisão: caminhos exatos de código hoje

#### D-02 (WR-05): "Continuar envio" sem conferir `isClosing`

- **Quem limpa as marcas:** `taqciti/src/features/agente/associationSend.ts:34-42`, função `resumeStoppedSend`, apaga `finishBy`, `finishTries`, `finishGaveUp` e `error` [VERIFIED: associationSend.ts:34-42]:
  ```
  const next: MeetingAssociation = { ...current, state: 'sending' };
  delete next.error;
  delete next.finishBy;
  delete next.finishTries;
  delete next.finishGaveUp;
  ```
- **Quem dispara:** `agenteBindResume.ts:39-71` `prepareResume(deps, meetingId, live)` chama `applyAssociationEvent(meetingId, { type: 'send-resumed' })` na linha 59, **depois** de checar `state !== 'send-failed' || sessionId === undefined || live` (linha 47) e de ler registro e config. É o ponto onde a checagem de `isClosing` entra: **antes da linha 59** (de preferência junto da guarda da linha 47, devolvendo `bindFail('invalid-state')`).
- **Cadeia de chamada:** UI `AgenteEndSlot.tsx` `handleResume` → `useMeetingAssociation.resumeSend` → mensagem `ui/agente/meeting/resume-send` → `index.ts:281-282` → `agenteAssociation.resumeSend` (`agenteAssociation.ts:80`) → `createAgenteAssociationService.resumeSend` (`agenteAssociationService.ts:109`) → `bindFlow.resumeSend` (`agenteBindFlow.ts:179-190`) → `prepareResume(deps, ...)`.
- **Onde vive `isClosing`:** `agenteSessionFinisherInstance.ts:177` (`closing.has(id)`; o `Set` é preenchido em `closeSession` linha 63 e esvaziado no `finally`, linha 69) e exposto em `agenteSessionFinisher.ts:77` (`isClosing: (meetingId: string) => activeFinisher.isClosing(meetingId)`). Precedente de uso: `agenteFreshStart.ts:19-25`, que declara `isClosing` em uma interface de dependências e usa `agenteSessionFinisher.isClosing` como padrão.
- **Como injetar (seguindo o padrão do projeto, SOLID/D):** `ResumeDeps` (agenteBindResume.ts:21-24) hoje tem `getRecord` e `loadConfig`; `BindFlowDeps` (agenteBindFlow.ts:38-44) estende `BindUploadDeps` e é o que `prepareResume` recebe. Acrescentar `isClosing: (meetingId: string) => boolean` em `ResumeDeps` (obrigatório ou opcional com padrão `() => false` para não quebrar os fixtures de teste existentes) e ligar em `agenteAssociation.ts` (a composição já importa `agenteSessionFinisher`, linha 20): `isClosing: (id) => agenteSessionFinisher.isClosing(id)`. Sem ciclo novo de import.
- **Testes existentes a estender:** `taqciti/src/background/agenteBindFlow.test.ts`, bloco "continuar o envio" (`setupStopped`, perto das linhas 640-833) — o teste da linha 784 ("recusas: pending, sent e reunião ao vivo -> invalid-state") já testa recusas com `flow.resumeSend` e `send` não chamado; o `setup()` (linha 76) monta `createBindFlow({...})` com portas falsas, onde entra `isClosing`. Teste da composição: linha 1001 (`agenteAssociation.resumeSend chega ao fluxo`). O teste novo **falha sem a correção** se: com `isClosing: () => true` (ou `vi.fn`), `resumeSend('m2')` devolve `{ ok: false, error: 'invalid-state' }`, a associação segue `send-failed` com `finishBy`/`finishTries` intactos e `send` não é chamado.
- **Não confundir com DA-2:** o teste da linha 743 ("sessão já encerrada pela B4-b: as partes restantes entram, sessionFinished fica...") prova que continuar o envio **depois** de a sessão estar encerrada **continua valendo**. A sugestão do `10-REVIEW.md` (WR-05) de também recusar quando `sessionFinished === true` **contradiz DA-2 e esse teste**; D-02 só pede `isClosing`. Não acrescentar a recusa por `sessionFinished`.
- **UI ignora o resultado:** `handleResume` em `AgenteEndSlot.tsx` faz `await resumeSend()` e descarta o resultado; uma recusa por `isClosing` fica **silenciosa** (o botão "não faz nada" por até ~10 s, o timeout do finish). Decidir se basta (janela curta, clicar de novo funciona) ou se vale copy — está em "Perguntas em aberto".

#### D-03: mesma sala em duas abas

- **Como a aba é registrada hoje:** `MeetingSessionState.tabId: number | null` é **um único valor** (`domain.ts:133`). Em `machine.ts` o ramo "mesma sala com sessão ativa" faz `withSession(state, { tabId: event.tabId, captionsEnabled: ... })` (linhas 210-219), ou seja, **a última aba que mandou `meet/detected` vira a dona**. O `index.ts:168-184` passa `tabId: sender.tab?.id ?? null`. O content script manda `meet/detected` em `onMeetingStart`, na injeção com reunião em andamento e em `redetect` (`content/controller.ts:110-117, 206-217, 233-244`) — **não a cada poll**.
- **DA-3 (fechar aba):** `meetingTabClosed.ts:26-42` — `if (current.session?.tabId !== tabId) return;` e, nas fases `captionsRequired`/`recording`/`paused`, `MEETING_FINISHED`. **DA-4 (navegar):** `meetingTabNavigated.ts:42-53` — mesma guarda de `tabId`, mais `isStillInMeetingRoom(url, session.meetingCode)`. **DA-5:** não envolve abas (rodada nova no `onStartup`, ver D-12).
- **O defeito:** abrir a mesma sala em uma 2ª aba faz o `tabId` apontar para a 2ª; fechar/navegar a 2ª encerra a reunião, embora a 1ª siga na call.
- **Desenho recomendado (consulta sob demanda, sem estado novo):**
  1. Nova porta injetada em `MeetingTabClosedDeps` e `MeetingTabNavigatedDeps`: `otherRoomTabId: (meetingCode: string, excludeTabId: number) => Promise<number | null>`. A implementação de produção (módulo novo, ex.: `meetingRoomTabs.ts`) usa `chrome.tabs.query({ url: '*://meet.google.com/*' })`, descarta `excludeTabId` e devolve o primeiro cuja `tab.url` passa em `isStillInMeetingRoom(url, meetingCode)` (já exportada de `meetingTabNavigated.ts:30`; mover para um módulo comum evita dependência circular). Há precedente de `chrome.tabs.query({})` em `injectPanel.ts:106`. O `host_permissions: ['<all_urls>']` (manifest.config.ts:173) já dá acesso ao `tab.url` de `meet.google.com` [CITED: "Host permissions allow an extension to read and query a matching tab's four sensitive tabs.Tab properties", developer.chrome.com/docs/extensions/reference/api/tabs].
  2. Nos dois handlers: se a aba que saiu é a dona e há `otherRoomTabId !== null`, **não** disparar `MEETING_FINISHED`; em vez disso **reapontar** `session.tabId` para a outra aba.
  3. Reapontar exige um evento novo na máquina (puro): por exemplo `MEETING_TAB_CHANGED { tabId }`, aplicado só em fase ao vivo, via `withSession(state, { tabId })` como no ramo da linha 211. Reaproveitar `MEETING_DETECTED` seria um hack (exige `meetingId` novo e `captionsEnabled`). Atenção: o `switch` de `transition` e o tipo `MeetingEvent` precisam do caso novo; há testes em `machine.test.ts`/`machineStartFresh.test.ts`.
  4. Sem o reapontamento, o defeito só se desloca: fechar depois a aba que sobrou não casaria com o `tabId` antigo e a reunião nunca encerraria (volta o problema original do DA-3).
- **Cenários para teste (a tabela do D-03):** (a) 2 abas na sala, fecha a dona → não encerra e `tabId` passa para a outra; (b) 2 abas, navega a dona para outro site → não encerra; (c) fecha a dona, depois fecha a restante → encerra uma vez; (d) fecha a **não dona** → nada (já é assim hoje); (e) 1 aba só → comportamento atual (encerra); (f) outra aba do Meet em **outra sala** → não conta como "mesma sala"; (g) consulta falha/rejeita → falha segura (documentar: recomendo **não** encerrar? ver Perguntas em aberto — hoje, sem consulta, encerra).
- **Testes existentes a estender:** `meetingTabClosed.test.ts`, `meetingTabNavigated.test.ts`, os de fluxo com a máquina real `meetingTabClosedFlow.test.ts` e `meetingTabNavigatedFlow.test.ts` (o `liveMeeting()` em `meetingTabNavigatedFlow.test.ts:27-35` já monta a máquina real com `transition(IDLE_STATE, detected)`), `machine.test.ts` para o evento novo.
- **Fora do que D-03 escreveu, mas do mesmo defeito:** `index.ts:185-186` trata `meet/ended` **sem olhar `sender.tab`**: se a 2ª aba detectar o fim da call, a reunião inteira encerra. D-03 fala só de fechar/navegar; ver Perguntas em aberto.

#### D-04 (WR-06): permissão `tabs`

- **Código que depende:** `index.ts:136-140`:
  ```
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url === undefined) return;
    const url = changeInfo.url;
    void ready.then(() => onMeetingTabNavigated(tabId, url, { getState, dispatch, now: Date.now }));
  });
  ```
  Sem `tabs`, `changeInfo.url` não vem para destinos fora das host permissions, e a guarda `=== undefined` ignora o evento: a DA-4 não dispara. **Com `tabs`, nenhuma mudança de código é necessária**; o `isStillInMeetingRoom` já devolve `false` para `chrome://newtab/` (teste em `meetingTabNavigated.test.ts:64`).
- **Manifesto hoje:** `permissions: ['storage', 'sidePanel', 'scripting', 'identity', 'alarms']` (manifest.config.ts:155) e `host_permissions: ['<all_urls>']` (linha 173). Confirmado também no `dist` construído nesta sessão (`['storage', 'sidePanel', 'scripting', 'identity', 'alarms'] ['<all_urls>']`).
- **O que `onUpdated` expõe:** `changeInfo.url` é "The tab's URL if it has changed"; `Tab.url` "is only present if the extension has the "tabs" permission or has host permissions for the page" [CITED: developer.chrome.com/docs/extensions/reference/api/tabs]. A doc não declara a regra de permissão para `changeInfo.url` especificamente; o comportamento de **não preencher** `changeInfo.url` para `chrome://` sem `tabs` é o do Chromium e está só no `10-REVIEW.md` (WR-06) e em relatos de terceiros — tratar como MÉDIA e **provar no UAT** (ver teste 10).
- **`<all_urls>` não cobre `chrome://`, `about:`, `data:`:** a doc de match patterns lista `http`, `https` e `file` como esquemas permitidos; `about:` e `data:` aparecem como "unsupported schemes" [CITED: developer.chrome.com/docs/extensions/develop/concepts/match-patterns]. `file://` ainda exige o usuário ligar "Permitir acesso a URLs de arquivo".
- **Aviso de instalação e desativação (corrige a premissa do CONTEXT):**
  - A permissão `tabs` tem o aviso "Read your browsing history." [CITED: developer.chrome.com/docs/extensions/reference/permissions-list].
  - **Mas** a página de avisos diz: "For example, the "tabs" warning won't show if the extension also requests "<all_urls>"." [CITED: developer.chrome.com/docs/extensions/develop/concepts/permission-warnings]. A Taqciti **já** pede `<all_urls>`.
  - A mesma página diz que adicionar permissão **com aviso** numa atualização desativa a extensão: "the extension will be disabled until the user accepts the new permission." [CITED: mesma página]. Se o aviso do `tabs` está suprimido, **não há aviso novo e, portanto, não deveria haver desativação**.
  - Conclusão: o rótulo `costly` do D-04 provavelmente está pessimista. Continua travado (a equipe escolheu `tabs`), mas o plano deve **verificar** em vez de supor. Método sem instalar nada: `chrome.management.getPermissionWarningsByManifest(manifestStr)` "can be used without requesting the 'management' permission" e devolve a lista de avisos [CITED: developer.chrome.com/docs/extensions/reference/api/management]. Rodar no console de qualquer página de extensão (por exemplo a saída larga, DevTools): comparar o resultado para o manifesto atual e para o manifesto com `'tabs'`. Anexar as duas saídas ao UAT. **Limite:** carregar `dist` como "sem pacote" e recarregar (↻) **não** exercita o diálogo de reaceitação (isso só acontece em atualização de pacote instalado); a prova de que não desativa em quem já instalou só vem de uma atualização real, que depende da distribuição (ainda indefinida).
- **Teste automático possível:** `defineManifest` é identidade, então um `src/manifest.test.ts` pode importar `../manifest.config` e afirmar `permissions` contém `'tabs'` **e** `host_permissions` contém `'<all_urls>'` (a segunda condição é a que justifica "sem aviso novo"). A confirmar: o import de `@crxjs/vite-plugin` sob `jsdom` — se pesar, usar `// @vitest-environment node` como já faz `agpBackendSmoke.test.ts`.
- **Commit isolado:** só `manifest.config.ts` (+ o teste do manifesto + o comentário), para reverter com `git revert` sozinho.
- **Privacidade (LGPD):** com `tabs`, o worker passa a poder ler o `url` de toda aba. O código novo **não pode gravar nem logar URLs** de abas (o `logger` e o storage). Só comparar o host/sala em memória.
- **`optional_permissions`:** viável tecnicamente (`tabs` não está entre as proibidas de ser opcionais [CITED: developer.chrome.com/docs/extensions/reference/api/permissions]), mas o pedido precisa de gesto do usuário no contexto da extensão e a DA-4 passaria a depender de um clique de ativação. Registrado como alternativa, não recomendado; D-04 é travado.

#### D-05: dividir `taqciti/src/background/index.ts`

- **Tamanho atual:** **287 linhas** [VERIFIED: `wc -l` nesta sessão; o `10-REVIEW.md` citava 265 antes do merge].
- **Costuras naturais (lidas linha a linha):**
  | Trecho | Linhas | Destino sugerido | Observação |
  |--------|--------|------------------|------------|
  | `configureAgenteSessionFinisher(...)`, `relaunchLiveLinks`, cadeia `ready` | 49-76 | `bootstrap.ts` exporta `ready` | A ordem da cadeia importa (migrate → hydrate → streamer → recover → relaunch → finisher → prefs); copiar sem reordenar. |
  | `registerAgpQuestionsFeed(ready)` | 79 | continua em `index.ts` (1 linha) | Registro síncrono. |
  | `onInstalled` | 94-100 | `browserListeners.ts` | |
  | `action.onClicked` | 116-124 | `browserListeners.ts` | |
  | `tabs.onRemoved`, `tabs.onUpdated` | 126-140 | `browserListeners.ts` (ou `tabListeners.ts`) | **D-03 mexe aqui antes**: por isso o refator vem depois. |
  | `runtime.onStartup`, `alarms.onAlarm` | 142-153 | `browserListeners.ts` | |
  | `defaultTitle` + `onMessage(...)` com o `switch` | 155-287 | `messageRouter.ts` | O `switch` sozinho passa de 120 linhas; subdividir por grupo (`meet/*` do content script, `panel/*`, `ui/*` básicos, histórico, vínculo Fase 8) para cada arquivo ficar <200. |
- **Restrição MV3 inegociável:** os listeners `chrome.*` precisam ser registrados **de forma síncrona na avaliação do módulo** do service worker. Cada módulo novo expõe uma função `registerX(ready)` chamada **no topo** do `index.ts`, sem `await` antes. Um `registerX` chamado depois de uma promessa perde eventos que acordam o worker.
- **Lacuna crítica de prova:** `grep` por importações de `background/index` em `taqciti/src` **não encontra nenhuma** [VERIFIED: grep nesta sessão]. O `index.ts` não é importado por teste algum, então "mesma saída dos testes existentes" passa mesmo se um listener sumir. **Seed de teste obrigatório, escrito antes do corte (commit próprio, sobre o `index.ts` intacto):** `taqciti/src/background/index.test.ts` com `chrome` simulado (`installChromeStorageMock` tem `extra` para `runtime`/`tabs`; acrescentar `alarms`, `action`, `storage.onChanged`), que importa `./index` e afirma (1) quais `chrome.*.addListener` foram chamados **sincronamente** (onInstalled, action.onClicked, tabs.onRemoved, tabs.onUpdated, runtime.onStartup, alarms.onAlarm, storage.onChanged do AGP, runtime.onMessage), e (2) uma tabela "tipo de mensagem → porta chamada" para os `case` do `switch`. O mesmo teste, rodado depois do corte, tem de passar **sem edição**. Complementos: contagem de testes igual (1513 + os novos) e `vite build` antes/depois sem erro.
- **Regra do projeto:** o commit do refator não pode alterar nenhum `*.test.ts` existente nem a lógica.

#### D-11 (WR-04): conectar só em `recording` + `streamingEnabled`

- **Onde está o estado hoje:**
  - Fase da reunião: `getState()` do `sessionController.ts` (memória, reidratado de `chrome.storage.session` chave `STORAGE_KEYS.state` no boot) — `MeetingPhase = 'idle' | 'captionsRequired' | 'recording' | 'paused' | 'ended'` [VERIFIED: domain.ts:100-105].
  - `streamingEnabled`: `AgenteConfig` lido por `createAgenteConfigReader()` (storage local); `AGENTE_STREAMING_ENABLED_DEFAULT` em `agenteConfig.ts:71-72`; o feed já instancia `readConfig` (`agpQuestionsFeedInstance.ts:22`) e já reconcilia quando a config muda (`changesTarget`: `STORAGE_KEYS.agenteConfig in changes`). **Não é preciso novo gatilho**, só ler `streamingEnabled`.
- **Regra atual (o problema):** `agpQuestionsFeedInstance.ts:24-31` `selectTarget` usa `isLivePhase(state)`, que é `captionsRequired || recording || paused` (`agenteAssociationLifecycle.ts:37-39`), e **ignora** `streamingEnabled`; depois `selectAgpTarget` (`agpTarget.ts:17-27`) exige origem explícita, `sessionId`, `state === 'linked'` e `sessionFinished !== true`.
- **Backend (por que importa):** `ws.py:19-20` `ws_manager.connect` e `pipeline_manager.get_or_create(session_id)` rodam ao conectar; `ws.py:21-24` fecha com 4004 se `pipeline is None`. Conectar **cria o pipeline** (laços de IA de 15/30 s, gasto de Gemini) [VERIFIED: ws.py:17-24 e `10-REVIEW.md` WR-04].
- **Tabela de decisão que o teste de tabela deve cobrir** (função pura nova em `agpTarget.ts`, por exemplo `decideAgpFollow(associations, meeting, streamingEnabled)`; proposta, não verificada contra quem a consumirá):

  | Fase | Associação elegível (explícita, `linked`, não encerrada) | `streamingEnabled` | Decisão | `connection` publicada |
  |------|-----|-----|-----|-----|
  | `recording` | sim | ligado | **seguir** (abre/mantém o socket) | `connecting` → `live` |
  | `recording` | sim | desligado | **segurar** | `paused` |
  | `paused` | sim | qualquer | **segurar** | `paused` |
  | `captionsRequired` | sim | qualquer | **segurar** | `paused` |
  | `recording`/`paused`/`captionsRequired` | não (sem associação, sem origem, `deferred`, `linking`, `sessionFinished`) | qualquer | **nenhuma** | limpa (volta ao estado 1 do UI-SPEC) |
  | `ended` ou `idle` | qualquer | qualquer | **nenhuma** | limpa |
  | qualquer | sim, mas URL do backend inválida (`buildAgpSocketUrl` devolve `null`) | qualquer | **nenhuma** | limpa (igual a hoje) |

- **Mudanças de código (resumo):**
  1. `agpTarget.ts`: a função de decisão devolve união discriminada (`follow` com `meetingId`/`sessionId`, `hold` com `sessionId`, `none`). Manter `selectAgpTarget` existente e seus testes (`agpTarget.test.ts`) intactos e compor por cima.
  2. `agpQuestionsFeedInstance.ts`: `selectTarget` passa a devolver `follow`/`hold`/`none` e lê `streamingEnabled`.
  3. `agpQuestionsFeed.ts`: o `run()` ganha o ramo `hold` (fecha socket e timer com `detach`, **mantém** `questions`, publica `paused`). Hoje o único jeito de "não seguir" é `following = null` + `publish(null, 'idle', [])` (linhas 143-149), que **limpa**.
  4. `agpQuestionsStore.ts`: `AgpConnection` ganha `'paused'` **e** `CONNECTIONS` também (linha 25), senão `normalizeAgpFeed` troca `paused` por `idle` em silêncio (linha 33: `?? 'idle'`) e a UI mostraria "A sessão do Agente não está ativa". Isso está dito no UI-SPEC e **é a armadilha nº 1** de M-1.
  5. Atualizar os dois "rigs" que injetam `selectTarget` (`agpQuestionsFeed.test.ts:35-50` e `agpBackendSmoke.test.ts:48-55`), que hoje devolvem `AgpFeedTarget | null`.
- **Armadilhas específicas do `hold` (decisões de projeto que o plano precisa tomar):**
  - **O worker dorme no hold.** Fechado o socket, a regra do ciclo de vida diz que o service worker para "after 30 seconds of inactivity" e que "Active WebSocket connections now extend extension service worker lifetimes" (só com socket aberto) [CITED: developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle]. Ao acordar, o `following` em memória e a lista **sumiram**; o primeiro `run()` hoje faz `needsInitialClear` e escreve vazio (linhas 61, 144-149). Sem tratamento, "mantém na tela as perguntas já recebidas" **quebra justamente na pausa**. Solução: dependência nova `readStored: () => Promise<AgpFeed>` (já existe `loadAgpFeed`); no ramo `hold` sem `following`, adotar as perguntas do feed salvo **se** o `sessionId` salvo for o mesmo, senão limpar. O `needsInitialClear` não pode apagar no `hold`.
  - **Retomada preserva a lista.** UI-SPEC: ao voltar a gravar, "passa por 'Conectando ao Agente…' (mantendo a lista)" até o `initial_state` substituir. Hoje `run()` cria `Following` com `questions: []` e publica `connecting` com lista vazia (linhas 151-153). No ramo `follow` vindo de `hold`, iniciar com a lista segurada.
  - **4004 não pode virar `paused`.** Depois de um 4004 o feed deve ficar `idle` e **não reabrir** sozinho (D-12). Se o usuário pausa e retoma depois do 4004, o `hold` não pode sobrescrever o `idle` por `paused`, nem o `follow` reabrir o socket numa sessão que o backend já disse não estar ativa. Guardar um marcador "encerrada pelo backend" no `Following`.
  - **WR-01 continua valendo:** o contador de espera (`attempt`) só zera no `initial_state` (agpQuestionsFeed.ts:118-120); um `Following` novo começa com `attempt: 0`, o que é correto.
- **Estados de UI dependentes:** estado 7 do UI-SPEC (faixa "Pausado · mostrando as últimas perguntas" + corpo vazio "Nenhuma pergunta foi recebida antes da pausa."). As abas só existem nas fases `recording`/`paused` (`LiveScreen` `phase !== 'preparing'`); na `captionsRequired` as abas nem são montadas (UI-SPEC, A-8).

#### D-12: invariantes que o código novo **não pode quebrar**

Todas lidas em `agpQuestionsFeed.ts`, `agpQuestions.ts` e `agpQuestionsStore.ts` nesta sessão:

1. **Backoff:** `agpReconnectDelayMs(attempt)` = `min(1000 * 2 ** max(0, attempt), 30000)` (1 s, 2 s, 4 s ... teto 30 s) (agpQuestionsFeed.ts:18-24); `attempt` só zera quando chega `initial_state` (linhas 118-120), nunca no `onopen`.
2. **4004:** `AGP_SESSION_NOT_ACTIVE_CODE = 4004`; no `onclose` com esse código a lista é zerada, publica `idle` e **não agenda timer** (linhas 125-132); só um alvo novo reabre.
3. **Sem relógio local:** `agpQuestions.ts:1-8` — a expiração vem só de `question_expired`; sem `expires_at` na lista (`AgpQuestion` tem só `id`, `text`, `block`, `lens`, `status`). Nenhuma barra de TTL.
4. **Lista branca e tetos:** `MAX_ID_LENGTH = 128`, `MAX_TEXT_LENGTH = 1_000`, `MAX_BLOCK_LENGTH = 64`, `AGP_MAX_QUESTIONS = 30`; o corte descarta primeiro as não fixadas (`capped`).
5. **Só leitura:** a interface `AgpSocket` **não tem `send`** (agpQuestionsFeed.ts:27-32). Manter assim: é o que garante que a Taqciti não manda `generate_questions`/`pin_question` etc. (D-10).
6. **Escritas em fila** (`writes` encadeadas) e **reconciliação em fila** (`reconciling`), idempotentes.
7. **Registro síncrono** dos listeners no topo do módulo (MV3).

### Lacunas do UI-SPEC contra o código atual (lista para o planejador)

Fonte: `10-UI-SPEC.md` (aprovado) lido inteiro; código: `AgpQuestionsPanel.tsx` (53 linhas), `AgpLiveTabs.tsx` (41), `LiveScreen.tsx`, `PanelApp.tsx:916-925`, `agpQuestionsStore.ts`.

| ID | O que o UI-SPEC exige | O que o código faz hoje | Arquivo(s) |
|----|------------------------|-------------------------|-----------|
| **M-1** (obrigatória) | `AgpConnection` ganha `'paused'`; estado 7: faixa `role="status"` "Pausado · mostrando as últimas perguntas" com ícone `pause` (11 px, preenchido), `title` com a dica, lista mantida; se vazia, corpo "Nenhuma pergunta foi recebida antes da pausa." | `AgpConnection = 'idle' | 'connecting' | 'live' | 'reconnecting'` (store:14) e `CONNECTIONS` igual (store:25); o painel só trata `connecting` e "o resto" como "Reconectando ao Agente…" (panel:29-33) — um `paused` mostraria "Reconectando" | store, feed, panel |
| **M-2** (obrigatória) | Faixa de status **fixa acima** da lista (`shrink-0`), fora da região que rola | A faixa é filha do `div` com `overflow-y-auto` (panel:28-33): some quando a lista rola | panel |
| **M-3** (recomendada) | Região de rolagem `scroll-region` + `tabIndex={0}` + `outline-none` (padrão do `HistoryList`/`popup/App.tsx:122`); `break-words` no texto; linha de emblemas só se houver emblema; cartão com `animate-fade-in motion-reduce:animate-none` | `overflow-y-auto` simples (panel:28); `<div className="mb-1.5 flex items-center gap-2">` renderizado sempre, mesmo vazio (panel:40); sem `break-words`; sem animação | panel |
| **M-4** (recomendada) | Aba `h-8`; `aria-label="AGP, {n} perguntas"` (singular com 1; sem rótulo sem contador); corpo com `role="tabpanel"`, `aria-labelledby`; abas com `id`/`aria-controls`; setas esquerda/direita movem entre abas com `tabIndex` móvel. **Não** adicionar texto visível (o teste exige `tab('AGP').textContent === 'AGP2'`) | Classe `rounded-control px-3 py-1 ...` (tabs:12), sem `h-8`; sem `aria-label`; sem `tabpanel`/`aria-controls`/setas | tabs |
| **M-5** (baixa) | Na **saída larga**, o aviso de "sem vínculo" ganha a 2ª frase " O vínculo é feito no painel do TaqCITi dentro do Meet." | Mesmo texto nas duas superfícies; `LiveScreen` não passa nada ao `AgpLiveTabs` | panel, tabs, `LiveScreen.tsx` |
| **M-6** (obrigatória) | Espaçamento na grade 4/8/16: `mb-1.5`→`mb-2`, `ml-1.5`→`ml-2`, `p-3`→`p-4`, `px-3`→`px-4` (e a aba perde `py-1` e ganha `h-8`). **Commit próprio**, mecânico | `p-3` (panel:39), `mb-1.5` (panel:40), `ml-1.5` (tabs:28), `px-3 py-1` (tabs:12) | panel, tabs |

Já **conferido como atendido** pelo código (TRAVADO no UI-SPEC): textos dos estados 1-6 (`Vincule esta reunião...`, `A sessão do Agente não está ativa...`, `Conectando ao Agente…`, `Reconectando ao Agente…`, `Nenhuma pergunta por enquanto...`), rótulo `aria-label="Perguntas do Agente"` da lista, emblemas `Produto` (tone `primary`) / `Dados` (`neutral`) / `Fixada` (`warning`), contador oculto com 0, aba padrão Transcrição, as duas superfícies (`LiveScreen.tsx:68`, `PanelApp.tsx:916`).

**Cuidados de teste da UI:** `AgpQuestionsPanel.test.tsx` e `AgpLiveTabs.test.tsx` usam `textContent` exato (`'ProdutoPergunta a?'`, `'AGP2'`) e `toContain` nas frases; nenhum asserta nome de classe (conferido nesta sessão). Logo M-6 e M-3 passam sem mudar teste, e qualquer texto visível novo dentro do `<li>` ou do botão da aba quebra esses testes. Acrescentar testes novos para `paused`, `aria-label`, `tabpanel`, setas, e a 2ª frase de M-5.

**Classes de utilidade confirmadas existentes** (para M-3): `scroll-region` (`global.css:113`), `animate-fade-in` (`tailwind.config.ts:154`), `Icon` com `pause` preenchido (`Icon.tsx:10,31`).

### Anti-padrões a evitar

- **Misturar correção com refator no mesmo commit** (D-03/D-11 mexem em `index.ts`/feed; D-05 só depois e sem alterar lógica).
- **Reabrir D-12:** não reintroduzir relógio local, não zerar o backoff no `onopen`, não reconectar após 4004.
- **Dar `send` ao `AgpSocket`** ou qualquer comando ao backend (D-08/D-10).
- **Persistir/logar URL de aba** depois de pedir `tabs`.
- **Recusar o "Continuar envio" quando `sessionFinished`** (contradiz DA-2).

## Não Reinventar

| Problema | Não construir | Usar | Por quê |
|----------|---------------|------|---------|
| Detectar "ainda na mesma sala" | outra regex de URL | `isStillInMeetingRoom` + `meetingCodeFromPath` (`meetingTabNavigated.ts:30-40`) | já cobre `/<código>`, `/meet/<código>`, `?query`, `#hash`, maiúsculas e host falso (`meet.google.com.evil.com`); tem 22+ casos de teste |
| Alterar `tabId` da reunião | gravar direto no storage | evento novo na máquina + `dispatch` | `dispatch` faz flush, broadcast e efeitos colaterais; mexer fora quebra a única fonte de verdade |
| Saber se há finish em voo | outro `Set`/flag | `agenteSessionFinisher.isClosing` | já usado em `agenteFreshStart.ts` |
| Avisos de permissão | adivinhar o texto do instalador | `chrome.management.getPermissionWarningsByManifest` | API oficial, sem permissão extra |
| Servidor WS para teste | mock novo do protocolo | `taqciti/scripts/agp-fake-backend.py` (usa o `ws.py` e o `ws_manager` reais) | já prova o protocolo real; 3/3 |
| Storage em teste | `chrome.storage` à mão | `installChromeStorageMock` (`src/test/chromeStorageMock.ts`, aceita `extra`) | padrão de todos os testes de background |
| Estilo/tokens | classes e cores próprias | tokens e kit da Taqciti (`Badge`, `Icon`, `glass-subtle`, `scroll-region`) | UI-SPEC proíbe token novo no AGP |

**Ideia central:** o código do Gabriel já resolveu o difícil (protocolo, expiração, segurança). Cada lacuna desta fase é pequena e cirúrgica; construir paralelo é o que o D-01 proíbe.

## Inventário de Estado em Tempo de Execução

Não é fase de rename/migração. O D-05 é refator de arquivos, sem renomear identificadores persistidos. Verificação das cinco categorias: **dados armazenados** — nenhuma chave de storage muda (`taq:agpQuestions` e `taq:state` ficam); **config de serviço vivo** — nenhuma; **estado registrado no SO** — nenhum (o `chrome.alarms` usa o prefixo `AGENTE_FINISH_ALARM_PREFIX`, que não muda); **segredos/variáveis** — nenhum (as `VITE_AGENTE_*` só entram no build); **artefatos de build** — o `taqciti/dist` local aponta hoje para o endereço padrão (sobrescrito pelo build sem variáveis, conforme `FASE-10-INTEGRACAO-RESULTADO.md`) e precisa ser reconstruído para o UAT. **Único estado novo possível:** o `hold` do D-11 reaproveita a mesma chave `taq:agpQuestions` (valor `paused`), sem chave nova.

## Armadilhas Comuns

### Armadilha 1: `paused` some em silêncio no store
**O que dá errado:** o feed publica `paused`, o store troca por `idle` e a UI diz "sessão não ativa".
**Por quê:** `normalizeAgpFeed` usa `CONNECTIONS.find(...) ?? 'idle'` (agpQuestionsStore.ts:33).
**Como evitar:** acrescentar `'paused'` em `CONNECTIONS` junto do tipo, com teste de ida e volta (`write` → `load`) para cada valor.
**Sinal:** estado 7 nunca aparece no Chrome real.

### Armadilha 2: o `hold` perde a lista quando o worker dorme
**O que dá errado:** pausar a reunião, o worker dorme (socket fechado), a retomada mostra lista vazia.
**Por quê:** `following` e `questions` vivem só em memória; o 1º `run()` limpa (`needsInitialClear`).
**Como evitar:** hidratar do feed salvo no `hold`/`follow` quando o `sessionId` coincide (ver D-11). Testar com um segundo `createAgpQuestionsFeed` (simula novo boot) sobre o mesmo storage.
**Sinal:** UAT do teste 11: pausar por mais de 30 s e retomar.

### Armadilha 3: reapontar `tabId` esquecido (D-03)
**O que dá errado:** passa o teste "fechar a 2ª aba não encerra", mas fechar a 1ª depois nunca encerra.
**Como evitar:** o evento de máquina é parte do D-03; teste de fluxo com a máquina real (`liveMeeting()`) cobrindo a sequência (c).

### Armadilha 4: `isClosing` checado tarde demais (D-02)
**O que dá errado:** a checagem acontece depois do `send-resumed`; as marcas já foram apagadas.
**Como evitar:** checar **antes** de `applyAssociationEvent(..., { type: 'send-resumed' })` (agenteBindResume.ts:59). Há uma janela mínima entre a checagem e a gravação (o `finisher` pode entrar em `closeSession` nesse intervalo); ela é estreita e herdada do desenho assíncrono — registrar no plano como risco residual aceito, não tentar fechá-la nesta fase.

### Armadilha 5: refator do `index.ts` sem prova (D-05)
**O que dá errado:** um listener deixa de ser registrado de forma síncrona e a extensão "funciona" no teste e falha no Chrome (worker acorda sem handler).
**Como evitar:** o teste de caracterização (`index.test.ts`) **antes** do corte; conferir com `vite build` e UAT 6/7 depois.

### Armadilha 6: build do UAT sobrescreve o `dist` do usuário
**O que dá errado:** `npm run build` sem as variáveis recompila o endereço padrão no `dist` carregado no Chrome (já aconteceu em 2026-10-28).
**Como evitar:** para verificação automática, construir para **outro diretório** (`--outDir`), como feito nesta sessão (funciona, 5,6 s); só reconstruir o `dist` oficial no passo do UAT, com as duas variáveis.

### Armadilha 7: texto de D-09 contradiz o backend
**O que dá errado:** a página de ajuda promete "fixada no site some no TTL" e o testador vê o cartão ficar para sempre.
**Por quê:** `pipeline.py:164` — `if q.status != "queued" or not q.expires_at: continue`; e `ws.py:59-69` muda `q.status` em memória no `pin_question`/`dismiss_question`. Sem `queued`, não há expiração nem `question_expired`.
**Como evitar:** corrigir o texto de D-09, do UI-SPEC A-4 e do UAT 3: **fixar ou descartar no site não tira o cartão da Taqciti (até reconectar, quando o `initial_state` traz o estado real)**. Confirmar empiricamente no UAT (teste 12).

## Exemplos de Código

Esboços para orientar; nomes novos são propostas (livres, "Claude's Discretion"). Os valores já existentes foram citados nas seções acima.

### D-02 — checar antes de limpar as marcas

```ts
// agenteBindResume.ts (esboço) — guarda adicionada junto da linha 47, ANTES do send-resumed (linha 59)
export interface ResumeDeps {
  getRecord: (meetingId: string) => Promise<MeetingRecord | null>;
  loadConfig: () => Promise<AgenteConfig>;
  /** Há um encerramento da sessão em voo para esta reunião? Memória pura. */
  isClosing: (meetingId: string) => boolean;
}
// ...
if (deps.isClosing(meetingId)) return { failure: bindFail('invalid-state') };
```

### D-03 — porta "outra aba na mesma sala"

```ts
// meetingRoomTabs.ts (esboço)
export async function findOtherRoomTab(meetingCode: string, excludeTabId: number): Promise<number | null> {
  const tabs = await chrome.tabs.query({ url: '*://meet.google.com/*' });
  const other = tabs.find((t) => t.id !== undefined && t.id !== excludeTabId && t.url !== undefined
    && isStillInMeetingRoom(t.url, meetingCode));
  return other?.id ?? null;
}
// no handler: se existe outra aba -> dispatch({ type: 'MEETING_TAB_CHANGED', tabId: other }) e retorna; senão MEETING_FINISHED.
```

### D-11 — teste de tabela (forma)

```ts
it.each([
  ['recording', true, 'follow'],
  ['recording', false, 'hold'],
  ['paused', true, 'hold'],
  ['captionsRequired', true, 'hold'],
  ['ended', true, 'none'],
  ['idle', true, 'none'],
] as const)('fase %s, envio %s -> %s', (phase, streaming, expected) => { /* decideAgpFollow(...).kind */ });
```

### D-04 — conferir os avisos sem instalar

No console de uma página da extensão (saída larga), duas chamadas, uma por manifesto (atual e com `tabs`):
`chrome.management.getPermissionWarningsByManifest(JSON.stringify(manifestObjeto)).then(console.log)` — retorna `Promise<string[]>` [CITED: developer.chrome.com/docs/extensions/reference/api/management].

## Estado da Arte

| Abordagem antiga | Atual | Mudou | Impacto |
|------------------|-------|-------|---------|
| Service worker morre com WebSocket aberto | WebSocket ativo estende a vida do worker (Chrome 116+) | Chrome 116 | O feed aberto mantém o worker vivo; o `hold` (socket fechado) deixa o worker dormir. `minimum_chrome_version: '116'` já está no manifesto (manifest.config.ts:30) |
| `tabs` sempre gera aviso | Aviso suprimido se já houver `<all_urls>` | doc atual | Custo do D-04 provavelmente menor que o registrado |

**Obsoleto:** o plano original do Gabriel (`10-PLAN.md`) como guia de execução; é só referência histórica.

## Log de Suposições

| # | Afirmação | Seção | Risco se errada |
|---|-----------|-------|-----------------|
| A1 | `changeInfo.url` **não** vem para `chrome://` sem a permissão `tabs` (comportamento do Chromium; a doc oficial não declara a regra para `changeInfo.url`) | D-04 | Se vier mesmo sem `tabs`, D-04 seria desnecessário. O UAT 10 prova isso antes de concluir a fase |
| A2 | Com `<all_urls>` já presente, acrescentar `tabs` **não** desativa a extensão em quem já a tem (inferido da frase "the "tabs" warning won't show if the extension also requests "<all_urls>"" + regra de desativação por permissão com aviso) | D-04 | Se errada, vale o que o CONTEXT já assumiu (`costly`). Só uma atualização de pacote real prova |
| A3 | `chrome.tabs.query({ url: '*://meet.google.com/*' })` devolve `tab.url` legível no worker com `host_permissions: ['<all_urls>']` | D-03 | Sem `url`, a porta nunca acharia a outra aba e D-03 não teria efeito (testar no UAT 9) |
| A4 | Na "Participar também" a 2ª aba também manda `meet/detected` (por inferência do `controller.ts` + `machine.ts`; não observado no Chrome real) | D-03 | Se a 2ª aba não detectar, o defeito do D-03 pode ter outra causa; o UAT 9 confirma |
| A5 | Duas abas na mesma sala mandando `meet/chunk` ao mesmo tempo não duplicam falas além do que a máquina já deduplica por `captionId` (não analisado) | D-03 | Fora do escopo; se duplicar, é achado novo |
| A6 | O `import` de `manifest.config.ts` (e do `@crxjs/vite-plugin`) funciona sob `vitest` para um teste de manifesto | D-04 | Plano B: `// @vitest-environment node` ou ler o arquivo como texto |
| A7 | Recusa silenciosa do "Continuar envio" por `isClosing` (janela de até ~10 s) é aceitável sem copy nova | D-02 | Usuário acha que o botão quebrou; baixo custo de corrigir depois |

## Perguntas em Aberto

1. **O rótulo `costly` do D-04 continua valendo?**
   - Sabemos: a doc diz que o aviso do `tabs` some com `<all_urls>` (já presente).
   - Falta: medir com `getPermissionWarningsByManifest`; uma atualização real de pacote para ver se desativa.
   - Recomendação: manter D-04 travado; o plano mede e registra o resultado; o time decide só se o texto de comunicação (quando houver distribuição) precisa existir.
2. **D-09/A-4 dizem "fixada no site some no TTL" e o backend não faz isso** (ver Armadilha 7). Corrigir os três textos; não é decisão de código. Confirmar no UAT 12.
3. **`meet/ended` vindo da 2ª aba encerra a reunião inteira** (`index.ts:185-186` ignora `sender.tab`). D-03 só trata fechar/navegar. Ignorar `meet/ended` de aba não dona também? Muda comportamento além do D-03; **decisão do time** se for incluir.
4. **Falha da consulta `chrome.tabs.query` no D-03:** encerrar (comportamento de hoje) ou não encerrar? Recomendo encerrar (falha segura = o comportamento atual, nunca deixar IA gastando).
5. **Recusa silenciosa do D-02:** aceitar (A7) ou mostrar uma mensagem curta no cartão do fim? Texto novo de UI = escolha do time/discricionária.
6. **UAT sem Gemini:** só os testes que não dependem de IA rodam; mas "perguntas já recebidas continuam" (testes 4 e 11) precisa de ao menos uma pergunta. Sem IA, o backend real não gera nenhuma (as pré-mapeadas só nascem se o contexto pré-reunião gerar `recommended_questions`, `pipeline.py:562-593`, e vêm sem lente). Opção: estender `agp-fake-backend.py` com `POST /webhook/extension` (202) para poder vincular pelo ID manual e emitir perguntas por `/emit/...` — só como apoio a testes que não são o D-13. Decisão do time se vale o esforço ou se esses testes esperam o crédito.

## Disponibilidade de Ambiente

| Dependência | Necessária para | Disponível | Versão | Alternativa |
|-------------|-----------------|------------|--------|-------------|
| Node | testes, build | ✓ | v24.12.0 | — |
| npm | scripts | ✓ | 11.13.0 | — |
| Python (`python`) | fumaça AGP, backend | ✓ | 3.13.14 | no Windows **não existe `python3` real**; usar `python` e `AGP_PYTHON=python` |
| Dependências do backend em Python | fumaça (importa `app.routers.ws`) | ✓ | (fumaça rodou 3/3) | — |
| Chrome real com a extensão | UAT (D-13/D-15) | não verificado por mim | — | sem alternativa: a fase só fecha com a prova no Chrome |
| Gemini com crédito | testes 2 e 3 (D-13) | ✗ (hoje 402, segundo `FASE-10-INTEGRACAO-RESULTADO.md`) | — | rodar 1, 4*, 5, 6, 7 e os novos que não dependem de IA; *ver Pergunta 6 |
| Backend local `:8000` + web app `:5173` | UAT | não verificado | — | `cd backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000` e `npm --prefix frontend run dev` (de `TESTES-MANUAIS-POS-FASE-10.md`); Windows: usar `127.0.0.1`, não `localhost` |

**Sem fallback e bloqueando o fechamento:** crédito do Gemini (D-13) e uma pessoa com Chrome + Meet reais (call com 2 pessoas e, para o teste 9, uma 2ª aba).

## Arquitetura de Validação

### Framework de teste

| Propriedade | Valor |
|-------------|-------|
| Framework | Vitest 3.2.7, ambiente `jsdom` (config `taqciti/vitest.config.ts`, `include: ['src/**/*.test.{ts,tsx}']`, alias `@` → `src`) |
| Arquivo de config | `taqciti/vitest.config.ts` |
| Comando rápido (um arquivo) | `cd taqciti && npx vitest run src/background/agenteBindFlow.test.ts` |
| Suíte completa | `cd taqciti && npx vitest run` |
| Tipos | `cd taqciti && npx tsc --noEmit` |
| Lint | `cd taqciti && npx eslint src` |
| Build (sem sobrescrever o `dist`) | `cd taqciti && npx vite build --outDir <pasta-fora-do-repo> --emptyOutDir` (com `VITE_AGENTE_BACKEND_URL` e `VITE_AGENTE_STREAMING_ENABLED` se for conferir o endereço) |
| Fumaça contra o roteador WS real | bash: `cd taqciti && AGP_PYTHON=python AGP_SMOKE_SERVER=scripts/agp-fake-backend.py npx vitest run src/background/agpBackendSmoke.test.ts` · PowerShell: `$env:AGP_PYTHON='python'; $env:AGP_SMOKE_SERVER='scripts/agp-fake-backend.py'; npx vitest run src/background/agpBackendSmoke.test.ts` |
| Backend (só leitura nesta fase) | `cd backend && python -m pytest -q` |

**Resultados reais medidos nesta sessão (2026-10-28, Windows 11, branch `feat/fase-10-agp-integracao`):**

| Comando | Resultado | Tempo |
|---------|-----------|-------|
| `npx vitest run` (taqciti) | **97 arquivos passaram, 1 pulado (98); 1513 testes passaram, 3 pulados (1516)** | 111 s |
| `npx tsc --noEmit` | sem erros (exit 0) | 29 s |
| `npx eslint src` | sem avisos (exit 0) | 27 s |
| `npx vite build --outDir <scratch> --emptyOutDir` com as duas variáveis `VITE_*` | `✓ built in 5.58s`; `127.0.0.1:8000` aparece em `assets/agpQuestionsStore-*.js`; manifesto: `permissions` = `['storage', 'sidePanel', 'scripting', 'identity', 'alarms']`, `host_permissions` = `['<all_urls>']`; **o `taqciti/dist` oficial não foi tocado** | 5,6 s |
| fumaça AGP com `AGP_PYTHON=python` | **3 de 3 passam** | 15 s |
| `python -m pytest -q tests/test_expire_questions.py tests/test_two_agent_lens.py` | 26 passaram | 1,6 s |
| `python -m pytest -q` (backend inteiro) | **279 passaram, 4 pulados, 1 falhou**: `tests/test_schema.py::test_tables_exist` — `APIError ... Could not find the table 'public.information_schema.tables' in the schema cache` (PGRST205). Falha **preexistente e fora do escopo** (consulta o Supabase real por uma tabela que o PostgREST não expõe); o backend é somente leitura nesta fase | 5,8 s |

O teste de fumaça é pulado por padrão (`describe.skipIf(SERVER === undefined)`); é daí que vêm os 3 "pulados" da suíte completa.

### Mapa Requisito/Decisão → Teste

| ID | Comportamento | Tipo | Comando automatizado | Arquivo existe? |
|----|---------------|------|----------------------|-----------------|
| TAQ-05 / SC1, SC2 | espelho de `initial_state`/`question_new`/`question_expired` com lente | unit + integração | `npx vitest run src/background/agpQuestionsFeed.test.ts src/features/agente/agpQuestions.test.ts` e a fumaça | ✅ (14 + 22 testes) |
| TAQ-05 / SC3 | sem vínculo explícito → sem pergunta | unit | `npx vitest run src/features/agente/agpTarget.test.ts src/sidepanel/components/AgpQuestionsPanel.test.tsx` | ✅ |
| TAQ-05 / SC4 | não perturba captura/encerramento | suíte completa | `npx vitest run` (1513 hoje, tem de continuar verde) | ✅ |
| D-02 | `isClosing` impede "Continuar envio" e preserva `finishBy`/`finishTries` | unit | `npx vitest run src/background/agenteBindFlow.test.ts` | ✅ estender (bloco "continuar o envio", ~l. 640-833); teste de composição ~l. 1001 |
| D-03 | duas abas: fechar/navegar a 2ª não encerra; reaponta `tabId`; a última encerra; outra sala não conta | unit + fluxo (máquina real) | `npx vitest run src/background/meetingTabClosed.test.ts src/background/meetingTabNavigated.test.ts src/background/meetingTabClosedFlow.test.ts src/background/meetingTabNavigatedFlow.test.ts src/features/meeting/machine.test.ts` | ✅ estender; ❌ novo `meetingRoomTabs.test.ts` (Wave 0) |
| D-04 | `permissions` inclui `tabs` e `host_permissions` mantém `<all_urls>` | unit (manifesto) | `npx vitest run src/manifest.test.ts` | ❌ Wave 0 |
| D-04 (comportamento) | DA-4 dispara ao ir para `chrome://newtab/` | manual (Chrome real) | UAT 10 + saída de `getPermissionWarningsByManifest` | ❌ UAT |
| D-05 | registro síncrono dos listeners e roteamento de mensagens iguais antes e depois | teste de caracterização | `npx vitest run src/background/index.test.ts` (escrito **antes** do corte; passa sem edição **depois**) | ❌ Wave 0 |
| D-11 | tabela follow/hold/none por fase × vínculo × `streamingEnabled` | unit (tabela) | `npx vitest run src/features/agente/agpTarget.test.ts` | ✅ estender |
| D-11 | `hold` fecha o socket, mantém a lista, publica `paused`; retoma → `connecting` com a lista → `initial_state`; hold não vira `paused` após 4004; hold sobrevive a "novo boot" | unit (rig do feed) | `npx vitest run src/background/agpQuestionsFeed.test.ts` | ✅ estender (rig linhas 35-50 precisa do novo formato de `selectTarget`) |
| D-11 / M-1 | `paused` sobrevive a `write`→`load` | unit | `npx vitest run src/shared/config/agpQuestionsStore.test.ts` | ✅ estender |
| M-1..M-5 | faixa fixa, `paused`, `aria-label`, `tabpanel`, setas, 2ª frase na saída larga | unit (React) | `npx vitest run src/sidepanel/components/AgpQuestionsPanel.test.tsx src/sidepanel/components/AgpLiveTabs.test.tsx` | ✅ estender |
| D-12 | invariantes (backoff, 4004, sem relógio, lista branca) não regridem | unit + fumaça | os testes existentes do feed + a fumaça | ✅ (não editar os existentes) |
| D-06 / D-07 | avisos de "superado"; frase no `CLAUDE.md` | conferência por texto | `grep -n "SUPERADO\|superado" .planning/RETOMAR-AQUI.md .planning/PENDENCIAS-FASE-08.md .planning/PENDENCIAS-FASE-10.md` ; `grep -n "/ws/" CLAUDE.md` | doc (sem teste unitário) |
| D-13 / D-15 | prova no Chrome real | UAT manual | `10-UAT.md` ampliado (abaixo) | ❌ Wave 0: reescrever o UAT |

### UAT: de 7 para 12 testes (cada um deve dizer COMO fazer; preferência do usuário registrada em memória)

Preparo comum: construir a Taqciti com as duas variáveis (bash: `VITE_AGENTE_BACKEND_URL=http://127.0.0.1:8000 VITE_AGENTE_STREAMING_ENABLED=true npm --prefix taqciti run build`; PowerShell: `$env:VITE_AGENTE_BACKEND_URL='http://127.0.0.1:8000'; $env:VITE_AGENTE_STREAMING_ENABLED='true'; npm --prefix taqciti run build`), dar ↻ em `chrome://extensions`; backend local em `127.0.0.1:8000`; web app `:5173`. Usar só clientes `ZZ-TESTE-<assunto> <data>` e apagar por id (regra de `TESTES-MANUAIS-POS-FASE-10.md`; o backend local grava no Supabase de produção).

| # | Teste | Depende de IA? | Origem |
|---|-------|----------------|--------|
| 1-7 | os 7 do `10-UAT.md` atual (aba sem vínculo, perguntas com lente, expiração, backend cai e volta, fim da call, navegar para outro site, duas telas) | 2 e 3 **sim**; 1, 4*, 5, 6, 7 não | Gabriel |
| 8 | **WR-05:** com a reunião encerrada e o envio parado (`send-failed`), clicar "Continuar envio" **durante** o encerramento da sessão não apaga o prazo; depois que o encerramento termina, "Continuar envio" funciona | não | D-02 |
| 9 | **Duas abas:** entrar na call, abrir a mesma sala em outra aba ("Participar também"); fechar a 2ª → a 1ª segue gravando; navegar a 2ª para outro site → a 1ª segue; fechar a 1ª e depois a última → encerra uma vez | não | D-03 |
| 10 | **`chrome://` com a DA-4:** com a reunião gravando e a extensão já com `tabs`, navegar a aba para a Nova Guia (`chrome://newtab/`, ou Alt+← até ela) → a reunião vira "encerrada". Anexar a saída de `getPermissionWarningsByManifest` antes/depois | não | D-04 / A1 / A2 |
| 11 | **Feed fecha em pausa/envio desligado:** com perguntas na aba AGP, pausar a captura → faixa "Pausado · mostrando as últimas perguntas" e as perguntas continuam; esperar >30 s (o worker dorme) e retomar → "Conectando…" mantendo a lista e depois o estado real; repetir desligando "Enviar a transcrição ao vivo para o Agente". Conferir no log do backend que **não há nova conexão** durante a pausa | precisa de ≥1 pergunta (ver Pergunta 6) | D-11 |
| 12 | **Divergência site × Taqciti (D-09 corrigido):** fixar e descartar uma pergunta no site; ver que o cartão **continua** na Taqciti; reconectar (derrubar e subir o backend) → o `initial_state` mostra o estado real | precisa de ≥1 pergunta | D-09 / Armadilha 7 |

Verificação visual (UI-SPEC "backstops"): painel do Meet no degrau `compact` e `regular` com lista rolando e faixa fixa; pergunta com trecho sem espaços (URL) sem rolagem horizontal nos 396 px; contador "AGP, N perguntas" (leitor de tela).

### Taxa de amostragem

- **Por commit de task:** `npx vitest run <arquivos tocados>` + `npx tsc --noEmit`.
- **Por onda:** `npx vitest run` + `npx eslint src` + a fumaça (se tocou `agp*`) + `npx vite build --outDir <scratch>`.
- **Portão da fase:** suíte completa verde (≥ 1513 + novos) **e** UAT 1-12 executado no Chrome real, com Gemini com crédito para 2 e 3, **antes** de `/gsd-verify-work 10`.

### Lacunas da Onda 0

- [ ] `taqciti/src/background/index.test.ts` — caracterização do `index.ts` **antes** do D-05.
- [ ] `taqciti/src/manifest.test.ts` — `tabs` e `<all_urls>` (D-04).
- [ ] `taqciti/src/background/meetingRoomTabs.test.ts` — porta de outras abas da sala (D-03), com `chrome.tabs.query` simulado (o `installChromeStorageMock` aceita `extra`; hoje só há `runtime.sendMessage` e `tabs.sendMessage` nos testes de fluxo).
- [ ] `10-UAT.md` reescrito com os 12 testes e o "como fazer" de cada um.
- Nenhum framework a instalar.

## Domínio de Segurança

`security_enforcement` não aparece desabilitado em `.planning/config.json` (lido nesta sessão): tratar como habilitado.

### Categorias ASVS aplicáveis

| Categoria | Aplica | Controle padrão |
|-----------|--------|-----------------|
| V2 Autenticação | não nesta fase | o `/ws` **sem autenticação** é risco aceito (D-10), fecha com o login do AGM |
| V3 Sessão | não | — |
| V4 Controle de acesso | sim (risco aceito) | só o UUID da sessão protege o `/ws`; a Taqciti só lê (`AgpSocket` sem `send`) |
| V5 Validação de entrada | sim | `toAgpQuestion`/`parseAgpMessage` com lista branca e tetos (id ≤128, texto ≤1000, bloco ≤64, ≤30 itens); mensagens inválidas ignoradas |
| V6 Criptografia | n/a | `buildAgpSocketUrl` usa `wss:` para backend `https:` e `ws:` só para loopback (validado por `isValidAgenteBackendUrl`) |
| V13/Privacidade (LGPD) | sim | `tabs` dá leitura de URLs: **não logar nem gravar URL de aba**; o texto das perguntas vem do backend e fica só em `chrome.storage.local` |

### Padrões de ameaça conhecidos

| Padrão | STRIDE | Mitigação |
|--------|--------|-----------|
| Quem tem o UUID da sessão lê as perguntas e manda comandos no `/ws` | Information disclosure / Tampering | risco aceito (D-10); registrar no plano e na verificação; nada muda no backend |
| Backend/URL maliciosa lotando o `storage.local` | DoS | tetos por campo e ≤30 itens (já feito, WR-03) |
| Conectar sem necessidade gasta IA | Elevation/custo | D-11 (conectar só em `recording` + envio ligado) |
| Permissão `tabs` ampliando a superfície de privacidade | Information disclosure | nenhum log/gravação de URL; comparar só o host e a sala em memória |
| Laço de reconexão batendo no backend | DoS | backoff exponencial e parada no 4004 (D-12, não reabrir) |

## Divisão sugerida em planos (para o planejador; Claude's Discretion)

Arquivos disjuntos permitem paralelismo na onda 1. Cada task segue as 7 seções do `CLAUDE.md`; correção e refator nunca no mesmo commit.

| Onda | Plano | Conteúdo | Arquivos principais | Depende de |
|------|-------|----------|---------------------|-----------|
| 1 | 10-01 | D-02 (WR-05): `isClosing` em `prepareResume` + teste que falha sem a correção + ligação na composição | `agenteBindResume.ts`, `agenteBindFlow.ts`, `agenteAssociation.ts`, `agenteBindFlow.test.ts` | — |
| 1 | 10-02 | D-03: evento de máquina + porta de outras abas + DA-3/DA-4 | `machine.ts`, `meetingTabClosed.ts`, `meetingTabNavigated.ts`, novo `meetingRoomTabs.ts`, `index.ts` (1 ligação) | — |
| 1 | 10-03 | D-11 + M-1: decisão pura, ramo `hold`, `paused` no store e no painel, hidratação do feed salvo | `agpTarget.ts`, `agpQuestionsFeed.ts`, `agpQuestionsFeedInstance.ts`, `agpQuestionsStore.ts`, `AgpQuestionsPanel.tsx` + testes | — |
| 2 | 10-04 | M-2..M-5 (comportamento/acessibilidade) e, **em commit separado**, M-6 (espaçamento mecânico) | `AgpQuestionsPanel.tsx`, `AgpLiveTabs.tsx`, `LiveScreen.tsx` | 10-03 (mesmos arquivos) |
| 2 | 10-05 | D-04: `tabs` em `manifest.config.ts` + `manifest.test.ts` (**commit isolado e destacado**; medir avisos) | `manifest.config.ts` | 10-02 (decisão do que o DA-4 espera) |
| 3 | 10-06 | D-05: `index.test.ts` de caracterização (commit 1) e divisão do `index.ts` (commit 2, sem editar testes) | `index.ts`, `bootstrap.ts`, `browserListeners.ts`, `messageRouter.ts` | 10-01, 10-02, 10-03, 10-05 (todos que tocam `index.ts` antes) |
| 3 | 10-07 | D-06 (marcar os 3 documentos), reescrever o `10-UAT.md` (12 testes), corrigir os textos D-09/A-4; D-07 (frase no `CLAUDE.md`) **só quando a Fase 10 entrar na `main`** | `.planning/*.md`, `10-UAT.md`, `CLAUDE.md` | todos |

Depois: build local com as variáveis, UAT no Chrome real (D-13/D-15), `/gsd-ui-review 10` (D-14), `/gsd-code-review 10`, `/gsd-verify-work 10`. Fases seguintes (10.1) ficam **fora**.

## Fontes

### Primárias (confiança ALTA)
- Código lido nesta sessão: `taqciti/src/background/{index,agenteSessionFinisher,agenteSessionFinisherInstance,agenteBindFlow,agenteBindResume,agenteAssociation,agenteAssociationService,agenteAssociationLifecycle,agenteFreshStart,meetingTabClosed,meetingTabNavigated,sessionController,agpQuestionsFeed,agpQuestionsFeedInstance,agpBrowserSocket,agpBackendSmoke.test}.ts`, `features/agente/{associationClose,associationSend,agpTarget,agpQuestions}.ts`, `features/meeting/machine.ts`, `shared/config/{agpQuestionsStore,agenteConfig,agenteRoutes}.ts`, `shared/types/domain.ts`, `content/{index,controller}.ts`, `sidepanel/components/{AgpQuestionsPanel,AgpLiveTabs,AgenteEndSlot}.tsx`, `sidepanel/screens/LiveScreen.tsx`, `content/ui/PanelApp.tsx`, `manifest.config.ts`, `vitest.config.ts`, `package.json`; `backend/app/routers/ws.py`, `backend/app/services/pipeline.py`.
- Documentos do projeto: `10-CONTEXT.md`, `10-UI-SPEC.md`, `10-REVIEW.md`, `10-UAT.md`, `FASE-10-INTEGRACAO-RESULTADO.md`, `CLAUDE.md`, `TESTES-MANUAIS-POS-FASE-10.md`.
- Comandos executados nesta sessão (resultados na tabela de validação).

### Secundárias (confiança MÉDIA, documentação oficial)
- https://developer.chrome.com/docs/extensions/reference/api/tabs — `Tab.url`, `changeInfo.url`, permissão `tabs` vs host permissions.
- https://developer.chrome.com/docs/extensions/develop/concepts/permission-warnings — suprimir o aviso do `tabs` com `<all_urls>`; desativação até aceitar permissão nova.
- https://developer.chrome.com/docs/extensions/reference/permissions-list — aviso "Read your browsing history." do `tabs`.
- https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns — esquemas permitidos por `<all_urls>`.
- https://developer.chrome.com/docs/extensions/reference/api/permissions — permissões que não podem ser opcionais; pedido exige gesto do usuário.
- https://developer.chrome.com/docs/extensions/reference/api/management — `getPermissionWarningsByManifest` sem permissão `management`.
- https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle — 30 s de inatividade; WebSocket ativo estende a vida do worker (Chrome 116).

### Terciárias (confiança BAIXA, a validar no UAT)
- Resultados de busca (fóruns/Bugzilla) sobre `changeInfo.url` exigir permissão explícita para a URL; usados só para a suposição A1.

## Metadados

**Confiança por área:**
- Pilha padrão: ALTA — nenhum pacote novo; versões lidas do `package.json` e do `vitest` em execução.
- Arquitetura/caminhos de código: ALTA — todos os arquivos citados foram abertos e as linhas conferidas nesta sessão.
- Comportamento do Chrome (A1, A2): MÉDIA — a doc oficial cobre a supressão do aviso, mas não a regra de `changeInfo.url` para `chrome://`; prova só no Chrome real.
- Armadilhas: ALTA para as de código (leitura direta), MÉDIA para o "Participar também" (A4, nunca observado).

**Data da pesquisa:** 2026-10-28
**Válida até:** 2026-11-28 (o código muda a cada plano executado; refazer as linhas citadas se os arquivos mudarem antes da execução)
