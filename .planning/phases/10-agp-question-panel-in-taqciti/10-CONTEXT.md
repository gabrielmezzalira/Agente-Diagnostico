# Phase 10: AGP Question Panel in Taqciti - Context

**Gathered:** 2026-10-28
**Status:** Ready for planning. Sem DECISÃO EM ABERTO: as 4 decisões que o `10-PLAN.md` do Gabriel deixava para o time foram tomadas aqui.

<domain>
## Phase Boundary

Durante a call, as perguntas de discovery geradas pelo backend (cada uma com a lente **Produto** ou **Dados**)
aparecem em quase tempo real numa aba **"AGP"** dentro da Taqciti (`taqciti/`), **só** para a sessão vinculada de
forma explícita (Fase 8). A aba **só mostra**: reaproveita o `/ws/{session_id}` (`initial_state`, `question_new`,
`question_expired`) e nunca recalcula nem inventa pergunta. Sem vínculo, mostra um aviso, nunca perguntas de
sessão "adivinhada". Não pode atrapalhar a captura/envio (Fases 7-8) nem a tela de perguntas do web app (Fase 5).

Requisito: **TAQ-05**. Critérios de sucesso: os 4 do ROADMAP (Fase 10), **sem alteração**.

**Ponto de partida desta discussão:** o Gabriel já implementou a fase (13 commits, branch
`origin/feat/fase-10-agp-question-panel`) e o código **já está integrado** na branch `feat/fase-10-agp-integracao`
(merge `d896c64` sobre a Fase 9; 1513 testes verdes, fumaça AGP contra o roteador WebSocket real 3/3). Falta: ver a
aba no Chrome real, decisões de projeto e correções acordadas abaixo. O trabalho da fase é **fechar lacunas**, não refazer.

Fora do escopo: ações na aba (gerar/fixar/descartar), que vão para a Fase 10.1 (ver `<deferred>`); login do AGM;
retirada da geração de PRD (trabalho à parte).

</domain>

<decisions>
## Implementation Decisions

### Como tratar o código do Gabriel
- **D-01:** **Adotar o código como está e fechar as lacunas.** O `/gsd-plan-phase 10` gera planos **só** para: as
  correções de D-02 a D-05, a validação real (D-13 a D-15) e a formalização (docs). Nada do que o Gabriel fez é
  reescrito sem motivo. A fase ganha CONTEXT, planos e VERIFICATION do GSD. Os 7 testes do `10-UAT.md` são a base
  do UAT, ampliados para cobrir as correções.
- **D-02:** **WR-05 entra:** "Continuar envio" (`resumeStoppedSend`/`prepareResume`) passa a conferir
  `agenteSessionFinisher.isClosing(meetingId)` antes de limpar as marcas de encerramento. É correção de
  **comportamento** (código da Fase 8), em commit próprio.
- **D-03:** **Reunião aberta em duas abas entra** ("Participar também"): fechar ou navegar a segunda aba não pode
  encerrar a reunião da primeira (vale para DA-3 e DA-4). Mexe nas regras de encerramento; comportamento novo,
  testado e em commit próprio.
- **D-04:** **WR-06 entra, com a permissão `tabs` no manifesto**, para a DA-4 disparar também ao ir para `chrome://`
  (Nova Guia), `file://`, `about:` e `data:`.
  — **Reversibility:** costly — o Chrome **desativa a extensão em quem já a tem** até a pessoa reaceitar a permissão
  nova, e o aviso de instalação passa a dizer que a extensão lê o histórico de navegação. Como a distribuição
  ainda não foi definida (CONTEXT da Fase 9), o custo de comunicação hoje é pequeno. O plano deve sinalizar
  isso em destaque e ficar em commit separado do resto, para ser revertido sozinho.
- **D-05:** **Dividir `taqciti/src/background/index.ts` (>200 linhas)** entra, mas como **refatoração pura**, em
  commit separado, **depois** das correções, sem mudar comportamento (regra do `CLAUDE.md`: nunca misturar correção
  com refator). Teste de regressão antes e depois (mesma saída dos testes existentes).
- **D-06:** Os documentos velhos `.planning/RETOMAR-AQUI.md`, `.planning/PENDENCIAS-FASE-08.md` e
  `.planning/PENDENCIAS-FASE-10.md` são **marcados como superados** com um aviso no topo apontando para este
  CONTEXT e o ROADMAP. **Não apagar.**
- **D-07:** Quando a Fase 10 entrar na `main`, o `CLAUDE.md` ganha uma frase corrigindo o trecho que diz que a
  Taqciti não usa o WebSocket: com a aba AGP ela usa `/ws/{session_id}` (somente leitura).

### O que a aba faz
- **D-08:** **Na Fase 10 a aba só mostra.** Gerar, fixar, descartar (e marcar como usada) **não** entram.
  O que você pediu (não precisar sair do Meet) vira a **Fase 10.1**, a inserir no roadmap (ver `<deferred>`).
- **D-09:** **Divergência aceita e documentada** até a 10.1: o backend não avisa por WebSocket quando alguém
  fixa/descarta no site. Pergunta descartada no site continua na Taqciti até o TTL ou reconexão; fixada no site
  some no TTL. Sem código novo e sem aviso na tela; o UAT e a página de ajuda explicam.
  — **Reversibility:** reversible — é só texto; a 10.1 resolve de verdade.

### Segurança e custo do WebSocket
- **D-10:** **Aceitar o `/ws/{session_id}` sem autenticação até o login do AGM**, na mesma linha de D-08 (Fase 9) e
  D-17 (Fase 8). **Nada muda no backend.** Registrar o risco de LGPD: quem tiver o id da sessão (UUID) lê as
  perguntas e, por esse mesmo endpoint, pode mandar `generate_questions`, `pin_question`, `dismiss_question` e
  `finish_session`. A Taqciti só lê. O 4004 continua impedindo conexão em sessão encerrada.
  — **Reversibility:** costly — fechar isso depois mexe no contrato do `/ws` que o web app (Fase 5) também usa.
- **D-11:** **O feed só conecta com a reunião em `recording`, vinculada de forma explícita e com o envio ao Agente
  ligado (`streamingEnabled`)** (resolve o WR-04). Em pausa, sem legendas (`captionsRequired`) ou com o envio
  desligado, fecha a conexão e **mantém na tela as perguntas já recebidas**; ao voltar a gravar, reconecta e recebe
  o `initial_state`. Motivo: conectar cria o pipeline de IA e gasta Gemini. Muda comportamento do
  `agpQuestionsFeed.ts` / `agpTarget.ts`, em commit próprio, com teste de tabela para cada estado.
- **D-12:** Backoff de reconexão, parada no 4004 e a regra "sem relógio local para expirar pergunta" (correções
  CR-01/WR-01/WR-02/WR-03/WR-07 do `10-REVIEW.md`) **ficam como o Gabriel deixou**. Não reabrir.

### Como provar que funciona
- **D-13:** **A fase só fecha com a prova no Chrome real e com IA de verdade:** os testes 2 e 3 do `10-UAT.md` têm
  que mostrar uma pergunta real, com a lente certa, chegando na Taqciti e expirando. Por isso o **Gemini precisa
  estar com crédito** antes do `/gsd-verify-work 10` (quem tem acesso à chave recarrega ou troca; **o assistente
  nunca abre o `.env`**). Enquanto não houver crédito, rodar só os testes que não dependem de IA (1, 4, 5, 6, 7).
  O backend falso (`taqciti/scripts/agp-fake-backend.py`) e a fumaça `agpBackendSmoke` continuam como teste
  **automático**, nunca como prova final.
- **D-14:** **Rodar `/gsd-ui-phase 10` antes de planejar** (o ROADMAP marca `UI hint: yes`). O UI-SPEC fixa: emblemas
  Produto/Dados, estados (sem vínculo, vazio, reconectando, com perguntas), contador na aba, painel compacto
  dentro do Meet e tela larga. Depois da execução, `/gsd-ui-review 10` audita contra ele.
- **D-15:** O UAT ganha testes para as correções: WR-05 (continuar envio durante encerramento), duas abas na mesma
  call, ida para `chrome://` com a DA-4, e o feed fechando em pausa/envio desligado (D-11). O build da Taqciti para
  teste local deve ser refeito com `VITE_AGENTE_BACKEND_URL=http://127.0.0.1:8000 VITE_AGENTE_STREAMING_ENABLED=true`
  (o `dist` atual foi sobrescrito com o endereço padrão) e dar ↻ em `chrome://extensions`.

### Decisões tomadas no `/gsd-plan-phase 10` (2026-10-28, após a pesquisa)
- **D-16:** **O D-03 inclui `meet/ended` vindo de aba que não é a dona.** Hoje `background/index.ts` ignora
  `sender.tab` e a 2ª aba encerra a reunião inteira ao sair da call. Passa a valer a mesma regra do D-03: a 2ª aba
  nunca encerra a reunião da 1ª. Comportamento novo, testado, em commit próprio dentro do trabalho do D-03.
- **D-17:** **Se a consulta de "outra aba na mesma sala" (`chrome.tabs.query`) falhar, encerrar** — falha segura,
  igual ao comportamento de hoje; a IA nunca fica gastando sem ninguém na call.
- **D-18:** **A recusa do "Continuar envio" durante o encerramento (D-02) é silenciosa.** Sem texto novo de UI;
  documentado no UAT (teste da WR-05).
- **D-19:** **Sem backend falso estendido para o UAT.** Os testes manuais que precisam de pergunta já recebida
  esperam o Gemini com crédito, junto com os testes 2 e 3 (D-13). `agp-fake-backend.py` não muda.
- **Correção de texto (pesquisa, Armadilha 7):** o backend **não** emite `question_expired` para pergunta fixada
  ou descartada no site (`pipeline.py:164` só expira `queued`; `pin_question` em `ws.py` muda o status em memória).
  Então, no D-09, pergunta fixada **ou** descartada no site continua na Taqciti **até reconectar**. Os textos do
  D-09, do UI-SPEC (A-4) e do UAT devem dizer isso. É só texto; nenhuma decisão de código muda.

### Claude's Discretion
- Nomes de arquivos/funções dos ajustes, textos exatos das mensagens do painel (dentro do que o UI-SPEC definir).
- Como o WR-05 e a regra de duas abas são testados (unitário vs integração), desde que cada um tenha um teste que
  falha sem a correção.
- Divisão dos planos em ondas e ordem dos commits, respeitando: correção e refator nunca no mesmo commit; a
  permissão `tabs` (D-04) em commit separado.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Fase 10 (trabalho do Gabriel e estado atual)
- `.planning/phases/10-agp-question-panel-in-taqciti/10-PLAN.md` — plano original (7 seções): passos, riscos, rollback e as duas decisões que ele deixou em aberto (resolvidas em D-08 e D-10 aqui).
- `.planning/phases/10-agp-question-panel-in-taqciti/10-REVIEW.md` — revisão de código: CR-01/02 e WR-01/02/03/07/08 já corrigidos; WR-04/05/06, duas abas e IN-04 tratados em D-02 a D-05 e D-11.
- `.planning/phases/10-agp-question-panel-in-taqciti/10-UAT.md` — 7 testes manuais (nunca executados), base do UAT.
- `.planning/FASE-10-INTEGRACAO-RESULTADO.md` — o que foi integrado e verificado em 2026-10-28 e a lista do que falta.
- `.planning/PENDENCIAS-FASE-10.md` — checklist do Gabriel (a ser marcado como superado, D-06).

### Contratos e decisões anteriores
- `.planning/ROADMAP.md` (Fase 10) — Goal, 4 critérios de sucesso e a nota de que vive em `taqciti/`.
- `.planning/REQUIREMENTS.md` — TAQ-05.
- `.planning/phases/08-taqciti-session-association/08-CONTEXT.md` — vínculo explícito (D-01..D-03), rotas da extensão sob `/webhook/extension` (D-16), `GET /projects` aberto como risco de LGPD (D-17).
- `.planning/phases/09-cutover-retire-custom-extension/09-CONTEXT.md` — sem chave até o login do AGM (D-08), rótulo `extension` no backend fica (D-00a), distribuição da Taqciti ainda por definir.
- `.planning/INTEGRACAO-MASTER-ANALISE.md` — método de integração com `master` (fora desta fase, mas condiciona o PR).

### Backend (só leitura nesta fase)
- `backend/app/routers/ws.py` — `/ws/{session_id}`: sem autenticação; aceita comandos do cliente; cria o pipeline ao conectar.
- `backend/app/services/pipeline.py` (`question_expired`, perto da linha 197) — único evento de saída de pergunta além de `question_new`; não há evento de pin/dismiss.
- `backend/app/routers/webhook.py` (`verify_extension_key`) e `backend/app/routers/extension_clients.py` — padrão do gate `x-agente-key` (relevante só para a 10.1).

### Código da Taqciti (fase)
- `taqciti/src/background/agpQuestionsFeed.ts`, `agpQuestionsFeedInstance.ts`, `agpBrowserSocket.ts` — dono do WebSocket, reconexão, parada no 4004.
- `taqciti/src/features/agente/agpTarget.ts`, `agpQuestions.ts` — regras puras (alvo e lista de perguntas).
- `taqciti/src/shared/config/agpQuestionsStore.ts` — o que a UI lê (`chrome.storage.local`, chave `taq:agpQuestions`).
- `taqciti/src/sidepanel/components/AgpQuestionsPanel.tsx`, `AgpLiveTabs.tsx`, `screens/LiveScreen.tsx`, `content/ui/PanelApp.tsx` — UI.
- `taqciti/src/background/agenteSessionFinisher.ts`, `features/agente/associationClose.ts` — encerramento (WR-05, duas abas, DA-3/DA-4/DA-5).
- `taqciti/src/background/agpBackendSmoke.test.ts` e `taqciti/scripts/agp-fake-backend.py` — fumaça automática (`AGP_PYTHON=python` no Windows).
- `taqciti/manifest.config.ts` — manifesto da extensão, onde entra a permissão `tabs` (D-04).

### Regras do projeto
- `CLAUDE.md` — SOLID, plano de 7 seções por task, branch por fase (`feat/fase-NN-slug`), nunca ler `.env`, correção ≠ refator no mesmo commit.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `subscribeNormalized` (exportado em `agenteDeliveryStore.ts`), `isValidAgenteBackendUrl`, `isValidAgenteSessionId`, `onLocalChange`: já reaproveitados pelo feed.
- `AgpQuestionsPanel` + `AgpLiveTabs`: abas "Transcrição | AGP" no `LiveScreen` e no `PanelApp` (as duas superfícies).
- `agp-fake-backend.py` + `agpBackendSmoke.test.ts`: servidor falso e fumaça contra o roteador real, rodáveis no Windows com `AGP_PYTHON=python`.

### Established Patterns
- Regras puras com portas injetadas (socket, timers, store), sem `chrome` direto: `agpQuestionsFeed.ts` segue isso e o D-11 deve manter.
- Estado da UI via `chrome.storage.local` (o painel do Meet não lê `storage.session`).
- Decisões de contrato novo da API ficam sob `/webhook/extension` com `x-agente-key` (Fases 6 e 8); a 10 não cria contrato novo.

### Integration Points
- `taqciti/src/background/index.ts` registra o feed (1 linha) e está acima de 200 linhas (D-05).
- `chrome.storage.onChanged` (associações, config, estado da reunião) dirige o feed; D-11 acrescenta `streamingEnabled` e o estado `recording` nessa conta.
- Web app (Fase 5) usa o mesmo `/ws/{session_id}`; qualquer mudança no `/ws` quebra os dois (por isso D-10).

</code_context>

<specifics>
## Specific Ideas

- O usuário quer, no fim, **não sair do Meet** para operar as perguntas (gerar, fixar, descartar). Isso é a **Fase 10.1**.
- A Fase 10 nasce de trabalho de outra pessoa (o Gabriel); manter o código dele e o crédito dos commits. Nenhuma
  reescrita só por estilo.
- Os testes da fase precisam ser **executáveis por quem não é técnico**: cada teste do UAT diz COMO fazer, não só o "esperado".

</specifics>

<deferred>
## Deferred Ideas

- **Fase 10.1 (a inserir no roadmap com `/gsd-phase`): ações na aba AGP.** "Gerar agora", fixar, descartar e marcar
  como usada, direto na Taqciti. Pontos que a discussão dela precisa tratar: (a) o `/ws` **já aceita** os comandos
  `generate_questions`, `pin_question`, `dismiss_question` e `use_question`, mas sem autenticação, então reutilizá-los
  só é aceitável depois de D-10 ser revisto, senão a alternativa é rota(s) nova(s) sob `/webhook/extension` com
  `x-agente-key`; (b) o backend precisa **transmitir** pin/dismiss/use por WebSocket para site e Taqciti não
  divergirem; (c) "Gerar agora" gasta Gemini a cada clique; (d) é mudança de contrato da API, então plano próprio e
  decisão do time.
- Login do AGM / proteção do `/ws` (fecha D-10 e o risco de LGPD de `GET /projects`, Fase 8 D-17).
- Retirada da geração de PRD (esconder x remover): trabalho à parte, nunca misturado com esta fase.
- Distribuição da Taqciti (GitHub Release, arquivo no web app, instaladores) e comunicação da nova permissão `tabs`: definir junto com o deploy.

### Reviewed Todos (not folded)
Nenhum todo pendente casou com esta fase.

</deferred>

---

*Phase: 10-AGP Question Panel in Taqciti*
*Context gathered: 2026-10-28*
