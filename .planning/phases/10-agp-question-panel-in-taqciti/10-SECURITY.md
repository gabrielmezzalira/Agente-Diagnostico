---
phase: "10"
slug: "agp-question-panel-in-taqciti"
status: draft
# threats_open = ameaças ABERTAS com severidade igual ou acima de workflow.security_block_on (o portão que bloqueia)
threats_open: 0
threats_open_nonblocking: 1
threats_total: 21
threats_closed: 20
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
verdict: OPEN_THREATS
created: "2026-10-30"
---

# Fase 10 — Segurança

> Contrato de segurança da fase: registro de ameaças, riscos aceitos e trilha de auditoria.
> Auditoria retroativa (`/gsd-secure-phase 10`), estado B (havia PLAN.md com `<threat_model>` e SUMMARY.md, mas
> nenhum SECURITY.md). O registro foi montado dos 12 PLAN.md; cada mitigação foi conferida no código implementado.

**Veredito: OPEN_THREATS — 1 ameaça aberta (T-10-21, severidade `medium`, abaixo do limiar `high`, não bloqueante).
Nenhuma ameaça bloqueante. As 6 ameaças de severidade `high` (T-10-04, T-10-05, T-10-12, T-10-15, T-10-18, T-10-19)
estão fechadas com evidência no código.**

Como a auditoria foi feita: nível ASVS 1 (verificação de presença da mitigação, no nível de leitura do código e de
busca textual), mais a execução dos testes ligados às ameaças (254 testes da Taqciti em 11 arquivos e 8 testes do
site, todos passando). Nenhum arquivo de código ou de teste foi alterado. Nenhum arquivo de segredo foi aberto.

---

## Fronteiras de confiança

| Fronteira | Descrição | Dados que cruzam |
|-----------|-----------|------------------|
| Service worker da Taqciti → backend (`POST /webhook/extension`, `POST .../finish`) | Envio em partes e encerramento da sessão do Agente | Transcrição da reunião (dado pessoal, LGPD) e chave `x-agente-key` |
| Abas do navegador → service worker (`chrome.tabs.query`, `tabs.onUpdated`) | O worker lê a URL das abas do Meet para decidir "mesma sala" | URL de aba (comparada só em memória) |
| Content script do Meet → service worker (`meet/detected`, `meet/ended`, `meet/chunk`) | Mensagens validadas por esquema zod; `sender.tab` vem do Chrome | Eventos da call e legendas |
| Backend `/ws/{session_id}` → service worker da Taqciti | `initial_state`, `question_new`, `question_expired` (entrada não confiável, filtrada por lista branca) | Perguntas geradas por IA (o `initial_state` também traz transcrição, red flags e budget, que a Taqciti descarta) |
| Service worker → `chrome.storage.local` (`taq:agpQuestions`) → painel React | O que a interface lê | Perguntas (texto até 1000 caracteres, lente, bloco) |
| Distribuição da extensão → navegador de quem já a tem | Atualização com permissão nova (`tabs`) pode exigir reaceite | Permissões do manifesto |
| Web app (`/extension`) → pessoa que opera a call | Página estática de ajuda | Só texto fixo |
| Roteiro de UAT → pessoa que testa com o Supabase de produção | O backend local grava em produção | Clientes e sessões `ZZ-TESTE-*` |
| Pessoa que testa → chave do Gemini (backend local) | Segredo manipulado só pelo humano | Chave de API |
| Executor → `CLAUDE.md` | Regras lidas por toda pessoa e todo agente | Texto do manual |

---

## Registro de ameaças

| Threat ID | Categoria | Componente | Severidade | Disposição | Mitigação encontrada (evidência) | Status |
|-----------|-----------|------------|------------|------------|----------------------------------|--------|
| T-10-01 | Tampering | `prepareResume` / marcas `finishBy`/`finishTries` | medium | mitigate | `taqciti/src/background/agenteBindResume.ts:59` recusa com `invalid-state` quando `deps.isClosing?.(meetingId) === true`, antes do `send-resumed` (linha 69). Ligado em produção por `agenteAssociation.ts:62` (`agenteSessionFinisher.isClosing`) e implementado em `agenteSessionFinisherInstance.ts:177`. Teste pela composição real em `agenteBindResume.test.ts` (isClosing não injetado). | closed |
| T-10-02 | Tampering | Janela entre a checagem de `isClosing` e a gravação de `send-resumed` | low | accept | Risco aceito no plano 10-01 (janela de milissegundos herdada do desenho assíncrono). Ver Riscos Aceitos. | closed |
| T-10-03 | Information Disclosure | `meetingRoomTabs.ts` (leitura de `tab.url`) | medium | mitigate | O módulo só importa `./meetingTabNavigated` (que importa `meetingTabClosed`, `machine` e `meetingCode`); nenhum importa logger nem storage; busca por `logger`/`storage`/`console` nos quatro módulos só acha o comentário. A memória é `Map<number,string>` (id da aba → código da sala) e `Set<number>`, só em RAM. A URL nunca é guardada. Nenhum `logger.*` do worker cita URL. | closed |
| T-10-04 | Denial of Service | Encerramento da reunião (custo de IA) com duas abas | high | mitigate | `meetingTabClosed.ts` `handOffMeetingOrFinish`: consulta rejeitada ou ausente vira "sem outra aba" e dispara `MEETING_FINISHED` (D-17). `findOtherRoomTab` só aceita aba na memória "entrou na call", com mesmo código e URL ainda na sala. `noteTabCaptionActivity` só é chamado em `meet/chunk` e respeita `tabsLeftCall`. Testes: `meetingTwoTabs.test.ts` (sequência dona→restante = 1 encerramento; consulta rejeita = encerra; pré-entrada não segura; legenda atrasada não ressuscita aba). | closed |
| T-10-05 | Elevation of Privilege (custo) | Conexão ao `/ws` cria o pipeline de IA | high | mitigate | `agpTarget.ts` `decideAgpFollow`: só `follow` com fase `recording`, vínculo explícito (`selectAgpTarget`: origem, `sessionId`, estado `linked`, sessão não encerrada) e `streamingEnabled`; senão `hold` (fecha socket e timer via `detach`) ou `none`. O único `new WebSocket` do código é `agpBrowserSocket.ts:9`, alcançado só por `agpQuestionsFeed.connect`. `buildAgpSocketUrl` exige URL de backend válida (https ou loopback) e `sessionId` em formato UUID. Teste de composição `agpQuestionsFeedInstance.test.ts` (1 socket só gravando + vínculo + envio ligado). | closed |
| T-10-06 | Information Disclosure | Hidratação do feed salvo após o sono do worker | medium | mitigate | `agpQuestionsFeedHold.ts` `heldFromStored` devolve `null` se `stored.sessionId !== sessionId`; `decideAgpResume`/`decideAgpHold` nunca levam perguntas de outra sessão. Testes em `agpQuestionsFeedHold.test.ts` (storage de outra sessão = lista vazia). | closed |
| T-10-07 | Denial of Service | Laço de reconexão ao alternar pausa/retomada | medium | mitigate | `agpQuestionsFeed.ts`: espera crescente 1 s→30 s (`agpReconnectDelayMs`); código 4004 para de vez (`endedByBackend`, sem timer); `attempt` só zera no `initial_state` (linha 128); `hold` fecha o socket e limpa o timer. Testes de 4004 em `agpQuestionsFeed.test.ts` e `agpQuestionsFeedHold.test.ts`. | closed |
| T-10-08 | Information Disclosure / Tampering | `/ws/{session_id}` sem autenticação | medium | accept | Aceito no D-10 até o login do AGM. Verificado que a Taqciti só lê: a interface `AgpSocket` não tem `send` e nenhum `.send(` existe nos módulos `agp*`; teste de composição afirma que nenhum socket recebeu `send`; o 4004 segue barrando sessão encerrada; `backend/app/routers/ws.py` não mudou na fase. Escopo real do risco descrito em Riscos Aceitos. | closed |
| T-10-09 | Information Disclosure | Permissão `tabs` (leitura de URL de toda aba) | medium | mitigate | Único uso novo de URL de aba: `meetingRoomTabs.ts`/`meetingTabNavigated.ts` e o listener de `browserListeners.ts`, todos só em memória. Nenhum log nem gravação de URL. `manifest.test.ts` trava a lista de permissões e `host_permissions: ['<all_urls>']`. | closed |
| T-10-10 | Denial of Service | Atualização da extensão desativa até reaceitar | medium | accept | Aceito na decisão D-04; commit isolado e reversível. Ver Riscos Aceitos e Itens Pendentes. | closed |
| T-10-11 | Information Disclosure | Textos da página `/extension` | low | mitigate | `frontend/src/lib/taqcitiInstall.test.ts` varre `allPageTexts()` (inclui `TAQCITI_AGP_TAB_NOTES`) contra `chave`, `x-agente-key`, `agenteapikey`, `localhost`, `url do backend`; 8 testes passam. | closed |
| T-10-12 | Denial of Service (custo) | Reunião presa ao vivo depois de as duas abas saírem da call | high | mitigate | `meetingEndedInTab.ts` marca a aba que avisou como fora da call (`markLeftCall`) antes de decidir; aviso de aba não dona não encerra, o da dona segue o D-03; consulta rejeitada = encerra (D-17). `messageRouter.ts` passa `markLeftCall: markTabLeftCall`. Testes `meetingEndedTwoTabs.test.ts` ("duas saídas da call com o adaptador real", exatamente 1 `MEETING_FINISHED`). | closed |
| T-10-13 | Spoofing | `meet/ended` forjado por página | low | accept | Manifesto sem `externally_connectable`; nenhum `onMessageExternal`/`onConnectExternal` em `taqciti/src`; mensagens validadas por zod (`shared/services/messaging.ts`, teste "descarta mensagem inválida pelo esquema zod"); `sender.tab` preenchido pelo Chrome. | closed |
| T-10-14 | Tampering (injeção de HTML) | Renderização do texto da pergunta | medium | mitigate | `grep -c dangerouslySetInnerHTML AgpQuestionsPanel.tsx` = 0; nenhum `dangerouslySetInnerHTML`/`innerHTML`/`insertAdjacentHTML`/`outerHTML`/`document.write`/`eval` em `taqciti/src` (fora de testes). O texto entra como `{question.text}` (nó de texto do React). Teto de 1000 caracteres e lista branca em `agpQuestions.ts` (`toAgpQuestion`), reaplicada ao reler o storage. | closed |
| T-10-15 | Denial of Service | Registro dos listeners após a divisão do `index.ts` | high | mitigate | `index.ts` chama `registerAgpQuestionsFeed`, `registerBrowserListeners` e `registerMessageRouter` de forma síncrona no topo; cada um assina o `chrome.*.onX.addListener` na hora e espera o `ready` por dentro. `index.test.ts` ("registra os 7 listeners ... com o ready ainda pendente") passa. | closed |
| T-10-16 | Information Disclosure | Textos novos da UI (aviso da saída larga, `aria-label`) | low | accept | Aceito no plano 10-09: textos fixos do produto, sem dado de sessão, cliente ou URL. | closed |
| T-10-17 | Information Disclosure / Tampering | Dados de teste no Supabase de produção | medium | mitigate | `10-UAT.md` (preparo item 5) e `.planning/TESTES-MANUAIS-POS-FASE-10.md` exigem clientes `ZZ-TESTE-<assunto> <data>`, proíbem cliente real e mandam apagar por id no fim; 14 ocorrências de `ZZ-TESTE` no roteiro. Restam dados de teste antigos ainda não apagados (ver Itens Pendentes). | closed |
| T-10-18 | Information Disclosure | Chave do Gemini (crédito D-13) | high | mitigate | `10-UAT.md` (preparo item 6): recarregar ou trocar a chave é ação humana; "ninguém abre nem cola o conteúdo de arquivos de segredo"; nenhum passo manda abrir `.env`. Varredura nos arquivos rastreados: nenhuma chave `AIza...` nem JWT. | closed |
| T-10-19 | Information Disclosure | Chave do Gemini durante a recarga de crédito | high | mitigate | `10-11-SUMMARY.md` registra que nenhum arquivo `.env` foi aberto e que a recarga é feita por quem tem a chave; a evidência gravada não leva segredo (varredura de padrões de chave sem ocorrência). | closed |
| T-10-20 | Tampering | Clientes e sessões de teste no Supabase de produção | medium | mitigate | Regra `ZZ-TESTE-*` e limpeza por id, com a trava `client like 'ZZ-TESTE%'`, documentada no `10-UAT.md` e no `TESTES-MANUAIS-POS-FASE-10.md` (item M9). O plano 10-11 não rodou, então nenhum dado novo foi criado por ele; a limpeza dos dados antigos segue pendente. | closed |
| T-10-21 | Tampering | `CLAUDE.md` (manual do projeto) | medium | mitigate | Parte técnica provada: `git show --numstat b64d8b6` = `3 0 CLAUDE.md` (só acréscimo, só esse arquivo); o texto acrescentado descreve corretamente o que o código faz (só leitura). **Falta a aprovação humana do texto** ("d07-ok" ou "d07-reverter"), adiada por decisão do usuário. | open — abaixo do limiar `high` (não bloqueante) |

*Status: open · closed · open — abaixo do limiar `high` (não bloqueante)*
*Severidade: critical > high > medium > low — só ameaças abertas com severidade igual ou acima de `workflow.security_block_on` (`high`) contam para `threats_open`.*
*Disposição: mitigate (implementação exigida) · accept (risco documentado) · transfer (terceiros)*

---

## Riscos aceitos

| Risk ID | Ameaça | Justificativa | Aceito por | Data |
|---------|--------|---------------|------------|------|
| AR-10-01 | T-10-02 | Janela de milissegundos entre a checagem de `isClosing` e a gravação de `send-resumed`, herdada do desenho assíncrono; o pior caso é o comportamento anterior à fase. | Plano 10-01 (RESEARCH, Armadilha 4) | 2026-10-30 (confirmado na auditoria) |
| AR-10-02 | T-10-08 | `/ws/{session_id}` sem autenticação até o login do AGM (D-10, na mesma linha do D-08 da Fase 9). **Escopo real, para o registro de LGPD:** quem tem o UUID da sessão recebe no `initial_state` a transcrição completa, os red flags, a cobertura e o budget (não só as perguntas), pode mandar `generate_questions`, `force_classify`, `pin/dismiss/use_question` e `finish_session`, e a conexão cria o pipeline de IA do backend (custo). A fase não piora nada: a Taqciti só lê (sem `send`) e só abre o socket gravando + vínculo explícito + envio ligado (T-10-05). O UUID v4 não é adivinhável, mas aparece na URL do WebSocket. | Decisão D-10 do time (10-CONTEXT.md) | 2026-10-30 (confirmado na auditoria) |
| AR-10-03 | T-10-10 | A permissão `tabs` pode pedir reaceite para quem já tem a extensão (extensão desativada até aceitar). Decisão D-04 (`costly`) do time; distribuição indefinida (Fase 9); commit isolado, reversível com um `git revert`. | Decisão D-04 do time (10-CONTEXT.md) | 2026-10-30 (confirmado na auditoria) |
| AR-10-04 | T-10-13 | `meet/ended` forjado por página: sem `externally_connectable`, sem listeners externos e com `sender.tab` preenchido pelo Chrome, uma página comum não alcança o worker. | Plano 10-06 | 2026-10-30 (confirmado na auditoria) |
| AR-10-05 | T-10-16 | Textos novos da UI são fixos do produto e não mostram dado de sessão, cliente ou URL. | Plano 10-09 | 2026-10-30 (confirmado na auditoria) |

*Riscos aceitos não voltam a aparecer em auditorias futuras.*

---

## Itens pendentes (não bloqueantes)

| # | Ameaça | O que falta | Quem resolve | Quando |
|---|--------|-------------|--------------|--------|
| 1 | T-10-21 | Ler `git show b64d8b6 -- CLAUDE.md` (3 linhas, seção 10) e responder "d07-ok" ou "d07-reverter". Ao responder "d07-ok", a ameaça fecha e o `threats_open_nonblocking` vai a 0. | Usuário | Antes do merge da Fase 10 na `main` |
| 2 | T-10-17 / T-10-20 | Apagar do Supabase de produção os dados de teste antigos que ainda existem: o projeto `ZZ-TESTE-D20…` e a sessão da prova SC1 (ids no `TESTES-MANUAIS-POS-FASE-10.md`, item M9), sessões primeiro e projeto depois, com a trava `client like 'ZZ-TESTE%'`. Depois, apagar também o que o UAT 10-11 vier a criar e anotar os ids no `10-UAT.md`. | Usuário (autoriza a exclusão em produção) | No fim da Fase 10, junto com o UAT em Chrome real |
| 3 | T-10-10 / T-10-09 | Medir os avisos de permissão da instalação com `chrome.management.getPermissionWarningsByManifest` (teste 10 do UAT). Sem isso, a afirmação "o aviso da `tabs` não aparece porque `<all_urls>` já é pedido" segue sem medição. | Usuário (UAT em Chrome real, adiado) | Verificação final da fase |
| 4 | T-10-14 / T-10-03 | Opcional, de baixo custo: trocar os portões de grep feitos uma vez por travas permanentes, por exemplo a regra `react/no-danger` no ESLint da Taqciti e um teste que falhe se `meetingRoomTabs.ts`, `meetingTabNavigated.ts` ou `meetingTabClosed.ts` passarem a importar `@/shared/services/*`. Hoje a proteção contra regressão é só a revisão humana. | Time (decisão de adicionar) | Quando houver oportunidade; não bloqueia a fase |

---

## Trilha de auditoria

| Data da auditoria | Ameaças | Fechadas | Abertas | Executado por |
|-------------------|---------|----------|---------|---------------|
| 2026-10-30 | 21 | 20 | 1 (0 bloqueantes) | `/gsd-secure-phase 10` (verificação inline, ASVS 1; subagente `gsd-security-auditor` não foi acionado: ferramenta de agentes indisponível nesta execução e o atalho de nível 1 dispensa a rodada profunda) |

---

## Aprovação

- [x] Todas as ameaças têm disposição (mitigate / accept)
- [x] Riscos aceitos documentados no log de riscos aceitos
- [x] `threats_open: 0` (nenhuma ameaça aberta com severidade igual ou acima de `high`)
- [ ] `threats_open_nonblocking: 0` (falta a aprovação humana do D-07, T-10-21)
- [ ] `status: verified` na frontmatter (depende do item acima)

**Aprovação:** pendente — fechar T-10-21 com a resposta "d07-ok" do usuário.
