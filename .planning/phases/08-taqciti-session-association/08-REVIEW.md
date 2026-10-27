---
phase: 08-taqciti-session-association
reviewed: 2026-10-26T21:10:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - taqciti/src/background/meetingTabNavigated.test.ts
  - taqciti/src/background/meetingTabNavigated.ts
  - taqciti/src/background/meetingTabNavigatedFlow.test.ts
  - taqciti/src/content/providers/googleMeet/GoogleMeetProvider.ts
  - taqciti/src/content/providers/googleMeet/selectors.ts
  - taqciti/src/features/meeting/meetingCode.test.ts
  - taqciti/src/features/meeting/meetingCode.ts
findings:
  critical: 0
  warning: 9
  info: 15
  total: 24
status: issues_found
---

# Fase 8: Relatório de Code Review (revisão incremental do plano 08-28)

**Revisado em:** 2026-10-26
**Profundidade:** standard
**Arquivos revisados:** 7
**Status:** issues_found

## Resumo

Esta é uma revisão incremental. Ela cobre só o plano de fechamento de lacuna 08-28 (CR-02), ou seja, os
commits de código desde `dc4e40e`:

- `ed6b961`: o service worker passa a reconhecer a sala no endereço `/meet/<código>` (correção do CR-02);
- `2b40de1`: o content script passa a usar a mesma `meetingCodeFromPath` do service worker, e o
  `MEETING_CODE_PATTERN` sai de `selectors.ts`.

Li os 7 arquivos inteiros no estado atual. Também conferi quem chama o que mudou: `background/index.ts:118-122`
(o `chrome.tabs.onUpdated`), `sessionController.dispatch` (`sessionController.ts:190-209`), o
`MEETING_FINISHED` da máquina (`machine.ts:453-454`) e as outras comparações de `meetingCode` no código
(`machine.ts:210,226`, `agenteFreshStart.ts:33`, `naming.ts:11,27`). Procurei também se sobrou algum uso do
`MEETING_CODE_PATTERN` ou outra regra que tire a sala da URL. Não sobrou: as únicas regras ficaram em
`meetingCode.ts`, mais uma cópia da gramática do código em `naming.ts` (IN-14). Os testes dos arquivos
revisados passam (6 arquivos, 106 testes) e o `tsc --noEmit` do `taqciti/` não acusa erro.

**O CR-02 está resolvido.** Agora há uma regra só, com dois modos da mesma gramática. O modo exato é usado
pelo content script e o modo com subcaminho pelo service worker. Tudo o que o modo exato aceita, o modo com
subcaminho também aceita, com o mesmo código. Então o service worker nunca encerra, por mudança de URL, uma
reunião que o content script ainda considera ao vivo. Isso fecha a segunda metade do CR-02 (o content script
não anunciar a reunião de novo). Essa metade só acontecia quando as duas regras discordavam, e agora elas
não discordam mais. Os testes cobrem os casos pedidos no achado original: `/meet/<código>`, `?authuser=1`,
`#hash` e a troca `/<código>` → `/meet/<código>`. Há também um teste de fluxo que usa a máquina de estados
de verdade.

Nenhum achado novo é crítico ou warning. Os três achados novos (IN-13 a IN-15) são de manutenção:

- a regra de maiúsculas e minúsculas na comparação de códigos ficou espalhada (IN-13);
- ainda existe uma terceira cópia da gramática do código em `naming.ts` (IN-14);
- falta um teste que trave a propriedade que de fato fecha o CR-02: o que o modo exato aceita, o modo com
  subcaminho também aceita (IN-15).

Os achados WR-01 a WR-09 e IN-01 a IN-12 da revisão anterior ficam abaixo com os mesmos IDs. Eles estão em
arquivos que **não** mudaram nesta rodada, por isso não foram reconferidos linha a linha. O texto foi mantido
como estava em 2026-10-26T20:00:00Z.

## Resolvidos desde a revisão anterior

### CR-01: Uma fala para sessão inexistente trava a fila durável de envio para sempre (HTTP 500 + "retirada-nunca")

**Resolvido em:** `664c033`. Já foi conferido na re-revisão anterior e não muda nesta rodada.

### CR-02: Reunião no endereço novo `/meet/abc-defg-hij` é encerrada no meio da call por qualquer mudança de URL, e a captura para em silêncio

**Resolvido em:** `ed6b961` (fix) e `2b40de1` (refactor do content script), plano 08-28.

**Conferido em:**
- `taqciti/src/features/meeting/meetingCode.ts:23-34`: uma única gramática (`CODE`) com o prefixo `meet/`
  opcional e sem diferenciar maiúsculas e minúsculas. `EXACT_PATH` exige `$` logo depois do código e
  `SUBPATH_PATH` aceita `(?:/|$)`. Nenhuma das duas regex usa as flags `g` ou `y`, então `exec` não guarda
  estado de uma chamada para outra.
- `taqciti/src/background/meetingTabNavigated.ts:37-39`: o host é comparado exatamente (`meet.google.com`, e
  `meet.google.com.evil.com` é recusado). Depois vem `meetingCodeFromPath(..., { allowSubpath: true })`,
  comparado sem diferenciar maiúsculas e minúsculas. Um `null` conta como "saiu", o que é correto.
- `taqciti/src/content/providers/googleMeet/GoogleMeetProvider.ts:146-150`: o modo exato tem o mesmo
  comportamento do `MEETING_CODE_PATTERN` antigo (que tinha a mesma regex). O `GoogleMeetProvider.test.ts:128-140`
  continua cobrindo `/meet/<código>` e as recusas.
- `taqciti/src/content/providers/googleMeet/selectors.ts`: o `MEETING_CODE_PATTERN` foi removido. Não
  sobrou nenhum import dele (busca no `taqciti/src`).
- Corrida: `sessionController.dispatch` aplica `transition` de forma síncrona antes do primeiro `await`
  (`sessionController.ts:191-195`), e `MEETING_FINISHED` fora de uma fase ativa devolve o mesmo estado
  (`machine.ts:454`). Duas notificações de `onUpdated` seguidas não conseguem encerrar a reunião duas vezes.
  O teste de fluxo (`meetingTabNavigatedFlow.test.ts:60-68`) segue esse mesmo modelo.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: As rotas novas da extensão ficam abertas a qualquer um quando `EXTENSION_SHARED_KEY` não está definida

_(da revisão de 2026-10-22; arquivo fora do escopo desta rodada, não reconferido)_

**Arquivos:** `backend/app/routers/webhook.py:23-30`, `backend/app/routers/extension_clients.py:37-71`, `backend/app/main.py:47-53`

**Problema:** `verify_extension_key` só valida quando a env var existe (`if not expected: return`), e o mesmo
gate protege `GET/POST /clients`, abrir e encerrar sessão. Com `allow_origins=["*"]`, qualquer site aberto no
navegador de alguém da equipe pode listar os clientes e criar projetos se a variável estiver ausente no Railway.

**Correção:** falhar fechado nas rotas novas (503/401 sem chave configurada), mantendo o opt-in só no POST de
chunk legado. Mudar o contrato é **DECISÃO EM ABERTO**. No mínimo, conferir a variável em produção antes do merge.

### WR-02: Apagar a reunião do histórico (ou a evicção) deixa a sessão do Agente aberta para sempre, gastando Gemini

_(da revisão de 2026-10-22; arquivo fora do escopo desta rodada, não reconferido)_

**Arquivos:** `taqciti/src/background/index.ts:227-235`, `taqciti/src/background/history.ts:45-63`, `taqciti/src/background/agenteSessionFinisherInstance.ts:97-100`

**Problema:** `ui/history/delete` faz `deleteRecord` + `removeAssociation` sem olhar o estado. Uma associação
`linked`/`sent`/`send-failed` com sessão ainda não encerrada perde o finish: o próximo alarme encontra
`association === null` e só limpa o alarme. A evicção em `upsertRecord` tem o mesmo efeito.

**Correção:** antes de remover, pedir o encerramento (`agenteSessionFinisher.evaluate`) ou deixar uma "lápide"
com `sessionId`/`origin`/`finishBy`. Na evicção, proteger as associações que ainda são `isEligibleForClose`.

### WR-03: HTTP 401/403 descarta, uma a uma, todas as falas da fila durável, e corrigir a chave apaga o que sobrou

_(da revisão de 2026-10-22; arquivo fora do escopo desta rodada, não reconferido)_

**Arquivos:** `taqciti/src/features/agente/sendRetryPolicy.ts:40-45`, `taqciti/src/background/agenteSendSettle.ts:64-72`, `taqciti/src/background/agenteStreamerInstance.ts:114-118`, `taqciti/src/background/agenteStreamDestination.ts:93`

**Problema:** 401/403 são tratados como `rejected` e saem da fila um a um. Trocar a chave muda o `queueKey`
(URL + chave), e o `syncDestination` chama `sender.cancelAll()`. Um erro de configuração vira perda definitiva
no Agente.

**Correção:** tratar 401/403 como `hold`, com aviso de chave na barra, e fazer o `queueKey` usar só a URL.
Mexe na política da Fase 7: **DECISÃO EM ABERTO**.

### WR-04: "Continuar envio" pode pular palavras do último segmento que estava sendo falado na hora do vínculo

_(da revisão de 2026-10-22; arquivo fora do escopo desta rodada, não reconferido)_

**Arquivos:** `taqciti/src/background/agenteBindResume.ts:57-61`, `taqciti/src/background/agenteBindFlow.ts:158-159`, `taqciti/src/features/agente/meetingUploader.ts:41-43`

**Problema:** `prepareResume` replaneja com os `record.segments` completos e recomeça em
`startAt = sendProgress.done`. O segmento que cresceu depois do clique fica antes de `done` e nunca é
reenviado. Mesmo que fosse, o mesmo `chunk_id` `bulk:{meetingId}:{index}` seria descartado como duplicata.

**Correção:** guardar por `key` as palavras já enviadas e, na retomada, mandar só a diferença com um `chunk_id`
diferente (ex.: `bulk:{meetingId}:{index}:{wordsFrom}`).

### WR-05: Reinício do service worker durante o vínculo ao vivo corta o envio pelo resto da reunião, sem saída

_(da revisão de 2026-10-22; arquivo fora do escopo desta rodada, não reconferido)_

**Arquivos:** `taqciti/src/background/agenteAssociationLifecycle.ts:122-125`, `taqciti/src/background/agenteBindResume.ts:42-44`

**Problema:** o caso é uma associação `linking` **com** `sessionId`. Ela cai em `link-failed: 'send'` e vai
para `send-failed`. Com a reunião ao vivo, o destino fica `idle` e o `prepareResume` recusa com
`live → invalid-state`. A barra mostra "O envio parou…" sem botão nem caminho para religar.

**Correção:** no boot, se a reunião está ao vivo e a associação está `linking` com sessão, relançar o envio em
partes a partir de `sendProgress.done`. Outra opção é permitir `resume-send` com a reunião ao vivo.

### WR-06: Checagem de cliente duplicado no backend não é atômica e não bate com a regra da Taqciti

_(da revisão de 2026-10-22; arquivo fora do escopo desta rodada, não reconferido)_

**Arquivos:** `backend/app/services/extension_session_service.py:30-34,88-99`, `taqciti/src/features/agente/clientSearch.ts:12-14`

**Problema:** `create_client` lê os nomes e depois insere, sem índice único. O backend normaliza com NFKD +
`casefold()`, e a Taqciti com NFD + `toLocaleLowerCase('pt-BR')`.

**Correção:** índice único funcional (`lower(unaccent(client))`) com `23505` → 409, e a mesma normalização nos
dois lados. O índice muda o schema: **DECISÃO EM ABERTO**.

### WR-07: Edição de projeto não consegue limpar campos (DMS "Limpar", budget, vínculo DocuData), e a UI promete que consegue

_(da revisão de 2026-10-22; arquivo fora do escopo desta rodada, não reconferido)_

**Arquivos:** `backend/app/routers/projects.py:100-102`, `frontend/src/pages/ProjectFormPage.tsx:95-106,203`

**Problema:** `update_project` usa `exclude_none=True`, e o formulário tira os campos vazios do payload.
"Limpar" o DMS, apagar o budget ou a descrição não tem efeito depois de salvar.

**Correção:** `exclude_unset=True` no backend e `null` explícito no formulário para os campos limpos. Muda o
contrato do PUT: **DECISÃO EM ABERTO**.

### WR-08: `taq:history` continua com leitura-modifica-grava sem fila, agora com mais escritores concorrentes

_(da revisão de 2026-10-22; arquivo fora do escopo desta rodada, não reconferido)_

**Arquivos:** `taqciti/src/background/history.ts:45-63,70-85`, `taqciti/src/background/agenteAssociationService.ts:74-78`

**Problema:** `upsertRecord`, `patchRecord` e `deleteRecord` leem o array inteiro e gravam de volta sem
serialização, em paralelo com o `discard` e a evicção.

**Correção:** usar o mesmo padrão `enqueue` + cache dos stores novos (uma fila única de escrita no service
worker).

### WR-09: Na tela "Transcrição salva" com o painel compacto (320 px), o seletor de cliente continua com a lista em 0 px

_(da revisão de 2026-10-26; arquivo fora do escopo desta rodada, não reconferido)_

**Arquivos:** `taqciti/src/sidepanel/components/AgenteEndSlot.tsx:69-72,136-143`, `taqciti/src/content/ui/PanelApp.tsx:134-138,681`, `taqciti/src/sidepanel/components/ClientPicker.tsx:44-52`

**Problema:** o `AgenteLiveSlot` aumenta o painel para `regular` ao abrir o seletor, e o `AgenteEndSlot` não
faz isso. No painel `compact` (320 px), a parte fixa do seletor ocupa a altura toda, a lista fica com 0 px e o
rodapé passa da borda.

**Correção:** passar `panelSize`/`onPanelSizeChange` para o `AgenteEndSlot` e, quando `surface === 'panel'`
e o painel estiver em `compact`, chamar `onPanelSizeChange('regular')` ao abrir o seletor. Teste semente no
`AgenteEndSlot.test.tsx`.

## Info

### IN-01: Service lança `HTTPException` e o finish async chama o cliente Supabase síncrono no event loop

_(da revisão de 2026-10-22; não reconferido nesta rodada)_

**Arquivo:** `backend/app/services/extension_session_service.py:15,92,107,117-135`
**Problema:** o service importa e lança `HTTPException`, e `finish_session` é `async def` chamando o
repositório síncrono.
**Correção:** exceções de domínio em `core/exceptions.py`, traduzidas no router; repositório via `run_in_threadpool`.

### IN-02: Lock por sessão vaza quando a construção do pipeline falha; tasks do webhook sem referência

_(da revisão de 2026-10-22; não reconferido nesta rodada)_

**Arquivos:** `backend/app/services/pipeline.py:648-656`, `backend/app/routers/webhook.py:60-62,109`
**Problema:** se `_build_pipeline` lança uma exceção, o `self._locks.pop(...)` nunca roda. Os `create_task`
do webhook ficam sem referência guardada e sem tratamento de exceção.
**Correção:** `try/finally` para o pop; guardar as tasks num `set` com `add_done_callback(discard)` e logar a exceção.

### IN-03: `useMeetingAssociation` mostra por um instante a associação da reunião anterior

_(da revisão de 2026-10-22; não reconferido nesta rodada)_

**Arquivo:** `taqciti/src/shared/hooks/useMeetingAssociation.ts:64-70`
**Problema:** quando `meetingId` troca, `association` não é zerada antes da nova assinatura.
**Correção:** `setAssociation(null)` no início do efeito.

### IN-04: `ProjectDetailPage` não zera nem cancela o readiness ao trocar de sessão

_(da revisão de 2026-10-22; não reconferido nesta rodada)_

**Arquivo:** `frontend/src/pages/ProjectDetailPage.tsx:66-75`
**Problema:** o efeito não zera `readiness` e não ignora resposta atrasada da sessão anterior.
**Correção:** `setReadiness(null)` no início e flag `let current = true` com cleanup.

### IN-05: "Continuar envio" e "Descartar" ignoram a falha do comando

_(da revisão de 2026-10-22; não reconferido nesta rodada)_

**Arquivo:** `taqciti/src/sidepanel/components/AgenteEndSlot.tsx:85-100`
**Problema:** `handleResume` descarta o resultado de `resumeSend()`, e `handleDiscard` só olha `result.ok` para
navegar, sem mostrar o erro.
**Correção:** guardar o erro num estado, mostrar uma linha de aviso e desabilitar o botão durante o comando.

### IN-06: Definições de "reunião ao vivo" e listas de estados duplicadas em vários arquivos

_(da revisão de 2026-10-22; não reconferido nesta rodada)_

**Arquivos:** `taqciti/src/background/agenteBindFlow.ts:49-55`, `taqciti/src/background/agenteAssociationService.ts:30-34`, `taqciti/src/background/agenteAssociationLifecycle.ts:35-44`, `taqciti/src/shared/hooks/useLiveMeetingManualBind.ts:15-16`, `taqciti/src/background/sessionController.ts:59-61`
**Problema:** o mesmo conceito é definido em vários lugares. O CR-02 foi exatamente esse padrão (duas regras
para "qual é a sala"), e o plano 08-28 resolveu só esse caso. Note que `meetingTabNavigated.ts:50` repete à mão
a lista `captionsRequired`/`recording`/`paused`, que já existe como `ACTIVE_PHASES` em `machine.ts:74`.
**Correção:** exportar uma única `isMeetingLive`/`LIVE_PHASES` e `BEFORE_LINK` e importar nos outros arquivos.

### IN-07: Código duplicado entre containers e raízes de composição

_(da revisão de 2026-10-22; não reconferido nesta rodada)_

**Arquivos:** `taqciti/src/background/agenteStreamer.ts:33-38`, `taqciti/src/background/agenteAssociation.ts:27-32`, `taqciti/src/sidepanel/components/AgenteLiveSlot.tsx:40-43,105-114`, `taqciti/src/sidepanel/components/AgenteEndSlot.tsx:40-43,74-83`
**Problema:** `defaultSend`, `toPickerError` e `handleBind` aparecem duplicados.
**Correção:** `defaultSend` num módulo compartilhado; `toPickerError` + `handleBind` num hook `useBindCommand`.

### IN-08: `recall_webhook` acessa o banco direto no router e não recebeu o tratamento do CR-01

_(da revisão de 2026-10-26; não reconferido nesta rodada)_

**Arquivo:** `backend/app/routers/webhook.py:67-111`
**Problema:** a rota do Recall faz `db.table(...)` dentro do router, e um `session_id` de uma sessão apagada
continua estourando `23503` → 500. O Recall.ai reenvia webhooks que recebem 5xx.
**Correção:** usar `TranscriptChunksRepository.insert_chunk` e mover a busca por `recall_bot_id` para um
repositório, com `SessionNotFoundError` → 404.

### IN-09: A regra `data-picker-takeover` também esconde os toasts e o aviso de captura parada

_(da revisão de 2026-10-26; não reconferido nesta rodada)_

**Arquivos:** `taqciti/src/content/ui/panel.css:97-99`, `taqciti/src/content/ui/PanelApp.tsx:873-926`, `taqciti/src/sidepanel/components/AgenteLiveSlot.tsx:82-87`
**Problema:** com o seletor aberto, os toasts e o aviso "As legendas do Meet pararam de chegar" ficam
escondidos. O seletor `:has(> [data-picker-takeover])` também não tem escopo.
**Correção:** deixar os avisos fora da regra (ex.: `data-picker-keep`) ou mostrar os toasts fora do corpo do painel.

### IN-10: Testes que leem o código-fonte como texto são frágeis

_(da revisão de 2026-10-26; não reconferido nesta rodada)_

**Arquivos:** `taqciti/src/content/ui/panelLayout.test.ts:15-22`, `taqciti/src/sidepanel/components/AgenteLiveSlot.test.tsx:16-17,244-248`
**Problema:** o teste depende de as classes estarem na mesma linha e de `process.cwd()` ser `taqciti/`.
**Correção:** `resolve(dirname(fileURLToPath(import.meta.url)), ...)` e uma regex que tolere quebra de linha,
ou exportar a constante de classes.

### IN-11: Comentário da política de reenvio ficou desatualizado com o CR-01

_(da revisão de 2026-10-26; não reconferido nesta rodada)_

**Arquivo:** `taqciti/src/features/agente/sendRetryPolicy.ts:29-31`
**Problema:** o comentário ainda diz que o webhook devolve 500 para QUALQUER erro de banco.
**Correção:** atualizar o comentário: sessão inexistente agora volta 404 (`rejected`).

### IN-12: O status de entrega é global, e um 404 de uma sessão antiga aparece na barra da reunião atual

_(da revisão de 2026-10-26; não reconferido nesta rodada)_

**Arquivos:** `taqciti/src/features/agente/bindingView.ts:25-31`, `taqciti/src/background/agenteSendSettle.ts:68-71`
**Problema:** `taq:agenteDelivery` é um só para a fila inteira, então a barra da reunião atual mostra o 404
de itens antigos de outra sessão.
**Correção:** guardar o `sessionId` do último item no status e só mostrar `rejected` quando ele for a sessão
exibida.

### IN-13: A regra de maiúsculas e minúsculas do código da sala continua espalhada, cada lugar decide de um jeito

**Arquivos:**
- `taqciti/src/features/meeting/meetingCode.ts:15` ("quem compara decide a caixa")
- `taqciti/src/background/meetingTabNavigated.ts:39` (compara sem diferenciar)
- `taqciti/src/features/meeting/machine.ts:210,226` (compara diferenciando)
- `taqciti/src/background/agenteFreshStart.ts:33` (compara diferenciando)
- `taqciti/src/content/providers/googleMeet/GoogleMeetProvider.ts:398` (compara diferenciando)

**Problema:** o 08-28 juntou num lugar só a regra que extrai o código, mas deixou com quem chama a decisão
sobre maiúsculas e minúsculas. O resultado é que o service worker considera `/ABC-DEFG-HIJ` a mesma sala que
`abc-defg-hij`, e a máquina e o `agenteFreshStart` não. Hoje isso não quebra nada: o código só é extraído no
content script, e o Meet usa minúsculas. Mas se o código chegar em maiúsculas, por exemplo num link digitado
à mão que o Meet não normaliza, a reentrada na mesma sala dentro de `REJOIN_RESUME_WINDOW_MS`
(`machine.ts:226`) vira uma reunião nova, e o provider zera falantes e tiles (`resetRoomIdentity`). É o
mesmo tipo de divergência que gerou o CR-02: um conceito só, várias regras.
**Correção:** normalizar o código em um único ponto. A forma mais simples é o `meetingCodeFromPath` devolver
`.toLowerCase()`, como estava na sugestão original do CR-02. Assim, todas as comparações com `===` ficam
corretas sem mudança, e o `toLowerCase()` em `meetingTabNavigated.ts:39` pode continuar como defesa para
estados antigos já persistidos. Isso muda o valor guardado em `session.meetingCode` e o caso "caixa
preservada" dos testes (`meetingCode.test.ts:15,52-54`). Ajustar os dois juntos.

### IN-14: Terceira cópia da gramática do código da sala em `naming.ts`

**Arquivo:** `taqciti/src/features/meeting/naming.ts:11`
**Problema:** `MEETING_CODE = /^[a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3}$/i` repete a mesma gramática do `CODE`
em `meetingCode.ts:23`. Se o formato do código mudar, só um dos dois vai ser atualizado. Aí o
`cleanMeetingTitle` passa a tratar o código cru como um nome escolhido pela pessoa ("Meet - <código>" vira o
título), e a auto-nomeação deixa de acontecer.
**Correção:** exportar de `meetingCode.ts` um `isMeetingCode(text: string): boolean` (ou a string `CODE`) e
usá-lo em `naming.ts`.

### IN-15: Não há teste que trave a propriedade que de fato fecha o CR-02 ("o modo exato está contido no modo com subcaminho")

**Arquivos:** `taqciti/src/features/meeting/meetingCode.test.ts:1-5,11-62`
**Problema:** o cabeçalho do teste diz que ele é "invariante" e que fica "vermelho no instante em que alguém
reintroduzir uma regra presa a um formato". Na prática, são duas tabelas separadas, uma por modo. O que
impede o CR-02 de voltar é uma relação **entre** os modos: para todo caminho em que o modo exato devolve um
código, o modo com subcaminho tem que devolver o mesmo código. Se não for assim, o service worker encerra
uma reunião que o content script considera ao vivo, e o content script nunca a anuncia de novo
(`GoogleMeetProvider.ts:397`). Se alguém mudar só o `EXACT_PATH`, por exemplo para aceitar um novo prefixo
`/_meet/`, as duas tabelas continuam verdes e a divergência volta.
**Correção:** um teste que percorra a tabela de caminhos aceitos pelo modo exato e afirme a contenção:
```ts
it.each(exactAccepted)('%s: o modo com subcaminho aceita tudo o que o exato aceita', (path) => {
  const exact = meetingCodeFromPath(path);
  expect(exact).not.toBeNull();
  expect(meetingCodeFromPath(path, { allowSubpath: true })).toBe(exact);
});
```
Melhor ainda é montar as duas regex a partir de um único `PREFIX` e de um único `CODE`, com o sufixo como
única diferença, para que a contenção venha da própria construção.

---

_Revisado em: 2026-10-26T21:10:00Z_
_Revisor: Claude (gsd-code-reviewer)_
_Profundidade: standard_
