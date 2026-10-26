---
phase: 08-taqciti-session-association
reviewed: 2026-10-26T20:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - backend/app/core/exceptions.py
  - backend/app/repositories/transcript_chunks_repository.py
  - backend/app/routers/webhook.py
  - backend/tests/test_webhook_idempotency.py
  - taqciti/src/content/providers/googleMeet/GoogleMeetProvider.test.ts
  - taqciti/src/content/providers/googleMeet/selectors.ts
  - taqciti/src/content/ui/PanelApp.tsx
  - taqciti/src/content/ui/panel.css
  - taqciti/src/content/ui/panelLayout.test.ts
  - taqciti/src/shared/ui/Button.tsx
  - taqciti/src/sidepanel/components/AgenteBindingBar.test.tsx
  - taqciti/src/sidepanel/components/AgenteBindingBar.tsx
  - taqciti/src/sidepanel/components/AgenteEndSlot.test.tsx
  - taqciti/src/sidepanel/components/AgenteEndSlot.tsx
  - taqciti/src/sidepanel/components/AgenteLiveSlot.test.tsx
  - taqciti/src/sidepanel/components/AgenteLiveSlot.tsx
  - taqciti/src/sidepanel/components/ClientPicker.test.tsx
  - taqciti/src/sidepanel/components/ClientPicker.tsx
findings:
  critical: 1
  warning: 9
  info: 12
  total: 22
status: issues_found
---

# Fase 8: Relatório de Code Review (re-revisão)

**Revisado em:** 2026-10-26
**Profundidade:** standard
**Arquivos revisados:** 18
**Status:** issues_found

## Resumo

Esta é uma re-revisão da Fase 8. A revisão anterior (commit `3da8fd1`, 2026-10-22) cobriu cerca de 100
arquivos e achou 16 problemas. Desde então entraram 7 commits de código, que mexeram só nos 18 arquivos
listados acima:

- `664c033`: fala para sessão inexistente devolve 404 (correção do CR-01);
- `861db11`: o Meet passou a ser reconhecido também no endereço `/meet/abc-defg-hij`;
- `5f20a3d`, `0a9c23e`, `ca1993a`, `79690b8`: ajustes de layout do seletor de cliente e do painel;
- `14e94cd`: botão "Selecionar cliente" em verde sólido (variante `solid` do `Button`).

Fiz duas coisas. Primeiro, li os 18 arquivos no estado atual, olhando para o que mudou e para como isso
conversa com o código em volta. Segundo, reabri o código citado em cada um dos 16 achados anteriores para
ver se ele ainda existe. Os outros ~80 arquivos que não mudaram não foram varridos de novo atrás de
problemas novos; neles só reconferi os achados antigos.

**O CR-01 está resolvido.** O repositório agora traduz `23503` (FK) e `22P02` (id que não é UUID) em
`SessionNotFoundError`, o router devolve 404, e na Taqciti o 404 cai em `rejected` (`sendRetryPolicy.ts:40-45`):
a fala sai da fila e a fila anda. Os testes novos cobrem os dois códigos e confirmam que outros erros de banco
continuam virando erro de servidor.

**O ponto mais grave desta rodada é novo e vem do `861db11`.** O content script passou a aceitar reuniões
em `/meet/abc-defg-hij`, mas o service worker continua usando outra regra para decidir se a aba "ainda está na
sala" (`meetingTabNavigated.ts`). Essa regra olha só o primeiro pedaço do caminho. No formato novo, esse
pedaço é `meet`, então qualquer mudança de URL na aba durante a reunião (um `?authuser`, um `#hash` ou a
própria reescrita de endereço do Meet) encerra a reunião no meio da call. Como o content script não anuncia a
reunião de novo, a captura para em silêncio até o fim da chamada (CR-02).

Os ajustes de layout resolvem o caso do painel no tamanho "regular", mas a tela "Transcrição salva" no
tamanho compacto (320 px) continua com a lista zerada, porque o `AgenteEndSlot` não aumenta o painel como o
`AgenteLiveSlot` faz (WR-09). Os oito warnings e os sete infos da revisão anterior continuam todos presentes.

## Resolvidos desde a revisão anterior

### CR-01: Uma fala para sessão inexistente trava a fila durável de envio para sempre (HTTP 500 + "retirada-nunca")

**Resolvido em:** `664c033` (fix(08): fala para sessao inexistente devolve 404 em vez de travar a fila)

**Conferido em:**
- `backend/app/repositories/transcript_chunks_repository.py:13-19,43-48`: `23503`/`22P02` viram
  `SessionNotFoundError`; o resto continua sendo relançado.
- `backend/app/routers/webhook.py:43-53`: `SessionNotFoundError` vira `HTTPException(404)` antes do
  `create_task`, então nenhum pipeline sobe para uma sessão que não existe.
- `backend/app/core/exceptions.py`: exceção de domínio sem dependência de HTTP. A camada ficou como manda o
  CLAUDE.md.
- Lado Taqciti, sem mudança: 404 cai em `rejected` (`sendRetryPolicy.ts:43-44`), sai da fila
  (`agenteSendSettle.ts:64-71`) e a barra mostra "confira o ID da sessão" (`agenteStatus.ts:102-104`).
- Testes: `backend/tests/test_webhook_idempotency.py:178-223`.

A defesa em profundidade na Taqciti (um item preso não segurar itens de outra sessão) continua como
**DECISÃO EM ABERTO** do time. Ela não é mais necessária para os três cenários do CR-01, mas ainda vale para
qualquer 5xx persistente que não seja "sessão inexistente". O comentário que descreve o comportamento antigo
ficou desatualizado (ver IN-11).

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-02: Reunião no endereço novo `/meet/abc-defg-hij` é encerrada no meio da call por qualquer mudança de URL, e a captura para em silêncio

**Arquivos:**
- `taqciti/src/background/meetingTabNavigated.ts:28-38,49-50`
- `taqciti/src/content/providers/googleMeet/selectors.ts:59-60`
- `taqciti/src/background/index.ts:118-122`
- `taqciti/src/content/providers/googleMeet/GoogleMeetProvider.ts:394-402`

**Problema:** o `861db11` ensinou o content script a reconhecer `meet.google.com/meet/abc-defg-hij`
(`MEETING_CODE_PATTERN` agora aceita o prefixo `meet/`). Só que o service worker tem uma segunda regra, própria,
para decidir se a aba continua na sala, e ela não foi atualizada:

```ts
const [firstSegment] = parsed.pathname.split('/').filter(Boolean);
return firstSegment?.toLowerCase() === meetingCode.toLowerCase();
```

Em `/meet/abc-defg-hij`, `firstSegment` é `"meet"`, e o resultado é sempre `false`. O `chrome.tabs.onUpdated`
(`index.ts:118-122`) chama `onMeetingTabNavigated` a cada `changeInfo.url`, inclusive em navegação dentro do
mesmo documento (`pushState`/`replaceState`). Com a reunião ao vivo, isso dispara `MEETING_FINISHED`
(`meetingTabNavigated.ts:49-50`). O resultado:

1. A reunião passa para `ended` no meio da call. O painel mostra "Transcrição salva", a associação recebe
   `meeting-ended` e o agendador de encerramento da sessão do Agente é acionado.
2. O content script não percebe nada: `GoogleMeetProvider.poll()` só chama `onMeetingStart` quando
   `!this.inMeeting` (`GoogleMeetProvider.ts:394-402`), e ele continua `inMeeting = true`. Então a reunião não é
   anunciada de novo, a retomada da mesma sala (`machine.ts`, `REJOIN_RESUME_WINDOW_MS`) não acontece, e as falas
   seguintes deixam de ser gravadas no histórico e enviadas ao Agente até a pessoa sair e entrar de novo.

O próprio módulo diz que "Mesma sala (recarregar, mudar `?query` ou `#hash`): nada", e os testes cobrem
`?authuser=1` e `#fim` (`meetingTabNavigated.test.ts:46-49`), mas só no formato antigo. O gatilho mais provável é
justamente o motivo do commit: "desde que o Meet passou a reescrever o endereço". Se a reescrita
`/abc-defg-hij` → `/meet/abc-defg-hij` acontecer **depois** de a reunião ter sido detectada, a reunião acaba no
mesmo instante. O UAT de 2026-10-26 passou no Meet real, o que sugere que, nos cenários testados, a reescrita
aconteceu antes da detecção (na tela de pré-entrada). Mas basta qualquer mudança de URL depois disso no formato
novo para cair aqui.

**Correção:** uma única função pura que extrai o código da sala, usada pelo content script e pelo service
worker, para as duas regras não divergirem de novo:

```ts
// src/features/meeting/meetingCode.ts (puro, sem DOM nem chrome)
const MEET_ROOM_PATH = /^\/(?:meet\/)?([a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3})(?:\/|$)/i;
export function meetingCodeFromPath(pathname: string): string | null {
  return MEET_ROOM_PATH.exec(pathname)?.[1]?.toLowerCase() ?? null;
}

// meetingTabNavigated.ts
if (parsed.hostname !== MEET_HOST) return false;
return meetingCodeFromPath(parsed.pathname) === meetingCode.toLowerCase();
```

(`MEETING_CODE_PATTERN` do content continua exigindo `$` logo depois do código; o service worker aceita sufixo,
como hoje.) Junto com a correção, acrescentar ao `meetingTabNavigated.test.ts` os casos
`https://meet.google.com/meet/${ROOM}`, `.../meet/${ROOM}?authuser=1` e a troca `/${ROOM}` → `/meet/${ROOM}`, todos
esperando "nada acontece".

## Warnings

### WR-01: As rotas novas da extensão ficam abertas a qualquer um quando `EXTENSION_SHARED_KEY` não está definida

_(da revisão de 2026-10-22, reconferido)_

**Arquivos:** `backend/app/routers/webhook.py:23-30`, `backend/app/routers/extension_clients.py:37-71`, `backend/app/main.py:47-53`

**Problema:** continua igual. `verify_extension_key` só valida quando a env var existe (linha 27-28:
`if not expected: return`), e o mesmo gate protege `GET/POST /clients`, abrir e encerrar sessão
(`extension_clients.py:39,48,57`). Com `allow_origins=["*"]` (`main.py:49`), qualquer site aberto no navegador
de alguém da equipe pode listar os clientes e criar projetos se a variável estiver ausente no Railway.

**Correção:** falhar fechado nas rotas novas (503/401 sem chave configurada), mantendo o opt-in só no POST de
chunk legado. Mudar o contrato é **DECISÃO EM ABERTO**; no mínimo, conferir a variável em produção antes do merge.

### WR-02: Apagar a reunião do histórico (ou a evicção) deixa a sessão do Agente aberta para sempre, gastando Gemini

_(da revisão de 2026-10-22, reconferido)_

**Arquivos:** `taqciti/src/background/index.ts:227-235`, `taqciti/src/background/history.ts:45-63`, `taqciti/src/background/agenteSessionFinisherInstance.ts:97-100`

**Problema:** sem mudança. `ui/history/delete` faz `deleteRecord` + `removeAssociation` sem olhar o estado.
Uma associação `linked`/`sent`/`send-failed` com sessão ainda não encerrada perde o finish: o próximo alarme
encontra `association === null` e só limpa o alarme (`agenteSessionFinisherInstance.ts:99`). A evicção em
`upsertRecord` (`history.ts:53-62`) tem o mesmo efeito.

**Correção:** antes de remover, pedir o encerramento (`agenteSessionFinisher.evaluate`) ou deixar uma "lápide"
com `sessionId`/`origin`/`finishBy`; na evicção, proteger associações que ainda são `isEligibleForClose`.

### WR-03: HTTP 401/403 descarta, uma a uma, todas as falas da fila durável, e corrigir a chave apaga o que sobrou

_(da revisão de 2026-10-22, reconferido)_

**Arquivos:** `taqciti/src/features/agente/sendRetryPolicy.ts:40-45`, `taqciti/src/background/agenteSendSettle.ts:64-72`, `taqciti/src/background/agenteStreamerInstance.ts:114-118`, `taqciti/src/background/agenteStreamDestination.ts:93`

**Problema:** sem mudança. 401/403 são `rejected` e saem da fila uma a uma. Trocar a chave muda `queueKey`
(URL + chave, `agenteStreamDestination.ts:93`) e `syncDestination` chama `sender.cancelAll()`
(`agenteStreamerInstance.ts:116`). Um erro de configuração vira perda definitiva no Agente.

**Correção:** tratar 401/403 como `hold`, com aviso de chave na barra, e fazer `queueKey` usar só a URL (o
request já é remontado com a chave atual). Mexe na política da Fase 7: **DECISÃO EM ABERTO**.

### WR-04: "Continuar envio" pode pular palavras do último segmento que estava sendo falado na hora do vínculo

_(da revisão de 2026-10-22, reconferido)_

**Arquivos:** `taqciti/src/background/agenteBindResume.ts:57-61`, `taqciti/src/background/agenteBindFlow.ts:158-159`, `taqciti/src/features/agente/meetingUploader.ts:41-43`

**Problema:** sem mudança. `prepareResume` replaneja com `record.segments` completos e recomeça em
`startAt = sendProgress.done` (`agenteBindResume.ts:57-61`). O segmento que cresceu depois do clique fica
antes de `done` e nunca é reenviado. Mesmo que fosse, o `chunk_id` `bulk:{meetingId}:{index}` igual seria
descartado como duplicata.

**Correção:** guardar por `key` as palavras já enviadas e, na retomada, mandar o delta com um `chunk_id`
diferente (ex.: `bulk:{meetingId}:{index}:{wordsFrom}`).

### WR-05: Reinício do service worker durante o vínculo ao vivo corta o envio pelo resto da reunião, sem saída

_(da revisão de 2026-10-22, reconferido)_

**Arquivos:** `taqciti/src/background/agenteAssociationLifecycle.ts:122-125`, `taqciti/src/background/agenteBindResume.ts:42-44`

**Problema:** o código continua igual. Conferi contra o teste 19 do UAT (2026-10-26, "service worker parado
durante o vínculo ao vivo"): ele segurou **o pedido de criar sessão**, então a associação estava `linking`
**sem** `sessionId`. Esse é o ramo `link-failed: 'create-session'` (`agenteAssociationLifecycle.ts:125`), que
volta para "Sem cliente". Por isso o teste passou corretamente, mas ele não exercita o caminho deste achado.
O caso de WR-05 é `linking` **com** `sessionId` (a sessão já foi criada e o envio em partes está em
andamento). Ele cai em `link-failed: 'send'` (linha 124), que leva a `send-failed`. Ao vivo, o destino fica
`idle` e `prepareResume` recusa com `live → invalid-state` (`agenteBindResume.ts:42`). A barra mostra "O envio
parou…" sem botão nem caminho para religar.

**Correção:** no boot, se a reunião está ao vivo e a associação está `linking` com sessão, relançar o envio
em partes a partir de `sendProgress.done`; ou permitir `resume-send` ao vivo, voltando para `linking`. Vale um
teste manual que segure o **upload** (não a criação de sessão) antes do Stop.

### WR-06: Checagem de cliente duplicado no backend não é atômica e não bate com a regra da Taqciti

_(da revisão de 2026-10-22, reconferido)_

**Arquivos:** `backend/app/services/extension_session_service.py:30-34,88-99`, `taqciti/src/features/agente/clientSearch.ts:12-14`

**Problema:** sem mudança. `create_client` lê os nomes (linha 91) e depois insere, sem índice único. O backend
normaliza com NFKD + `casefold()` (linhas 32-34) e a Taqciti com NFD + `toLocaleLowerCase('pt-BR')`
(`clientSearch.ts:13`).

**Correção:** índice único funcional (`lower(unaccent(client))`) com `23505` → 409, e a mesma normalização nos
dois lados. O índice muda o schema: **DECISÃO EM ABERTO**.

### WR-07: Edição de projeto não consegue limpar campos (DMS "Limpar", budget, vínculo DocuData), e a UI promete que consegue

_(da revisão de 2026-10-22, reconferido)_

**Arquivos:** `backend/app/routers/projects.py:100-102`, `frontend/src/pages/ProjectFormPage.tsx:95-106,203`

**Problema:** sem mudança. `update_project` ainda usa `exclude_none=True` (`projects.py:101`), e o form tira os
campos vazios do payload. "Limpar" o DMS, apagar o budget ou a descrição não tem efeito depois de salvar.

**Correção:** `exclude_unset=True` no backend e `null` explícito no form para os campos limpos. Muda o contrato
do PUT: **DECISÃO EM ABERTO**.

### WR-08: `taq:history` continua com leitura-modifica-grava sem fila, agora com mais escritores concorrentes

_(da revisão de 2026-10-22, reconferido)_

**Arquivos:** `taqciti/src/background/history.ts:45-63,70-85`, `taqciti/src/background/agenteAssociationService.ts:74-78`

**Problema:** sem mudança. `upsertRecord` (`history.ts:45-63`), `patchRecord` e `deleteRecord` leem o array
inteiro e gravam de volta sem serialização, em paralelo com o `discard` e a evicção.

**Correção:** o mesmo padrão `enqueue` + cache dos stores novos (fila única de escrita no service worker).

### WR-09: Na tela "Transcrição salva" com o painel compacto (320 px), o seletor de cliente continua com a lista em 0 px

**Arquivos:**
- `taqciti/src/sidepanel/components/AgenteEndSlot.tsx:69-72,136-143`
- `taqciti/src/content/ui/PanelApp.tsx:134-138,681`
- `taqciti/src/sidepanel/components/ClientPicker.tsx:44-52` (comparar com `AgenteLiveSlot.tsx:89-93`)

**Problema:** o `0a9c23e` fez o seletor do `AgenteEndSlot` tomar o corpo do painel, e o `5f20a3d` criou a
densidade `compact`. Os dois partem da premissa escrita no próprio `ClientPicker`: "`compact` é o painel do
Meet: **564 px** de altura". O `AgenteLiveSlot` garante essa premissa ao abrir o seletor:
`if (panelSize === 'compact') onPanelSizeChange('regular')` (linha 92). O `AgenteEndSlot` não faz isso. Ele
não recebe `panelSize`/`onPanelSizeChange`, e o `MeetingScreen` também não os repassa
(`PanelApp.tsx:681`).

Com o painel em `compact` (320 px, `PanelApp.tsx:135`), a conta na tela "Transcrição salva" fica assim:
cabeçalho do painel com o título editável (≈98 px), `pb-3.5` do corpo (14), `py-1` do `MeetingScreen` (8) e
`mb-2` do dono (8). Sobram ≈192 px. A parte fixa do seletor compacto ocupa ≈222 px: cabeçalho com
subtítulo de duas linhas (≈70), busca (≈40), "Criar cliente novo" (34), rodapé (`p-1.5` + 34 = 46) e quatro
`gap-2` (32). A lista (`min-h-0 flex-1`) fica com 0 px, e o rodapé passa da borda, que é exatamente o defeito
que o commit queria corrigir. Na variante `button` (reunião aberta pelo histórico, sem o input de título),
sobram só ≈16 px de lista.

**Correção:** dar ao `AgenteEndSlot` o mesmo comportamento do `AgenteLiveSlot` quando `surface === 'panel'`:

```tsx
// AgenteEndSlot: novas props opcionais, só usadas no painel
panelSize?: PanelSize;
onPanelSizeChange?: (size: PanelSize) => void;

const openPicker = (): void => {
  setPickerError(null);
  setPickerOpen(true);
  if (surface === 'panel' && panelSize === 'compact') onPanelSizeChange?.('regular');
};
```

O `MeetingScreen` repassa `prefs.size` e `callbacks.onPrefsChange({ size })`. Um teste semente no
`AgenteEndSlot.test.tsx`: abrir o seletor com `panelSize="compact"` deve chamar `onPanelSizeChange('regular')`.

## Info

### IN-01: Service lança `HTTPException` e o finish async chama o cliente Supabase síncrono no event loop

_(da revisão de 2026-10-22, reconferido)_

**Arquivo:** `backend/app/services/extension_session_service.py:15,92,107,117-135`
**Problema:** sem mudança. O service ainda importa e lança `HTTPException` (linhas 15, 92, 107, 129, 131), e
`finish_session` é `async def` chamando `self._repo.*` síncrono. Agora já existe `app/core/exceptions.py`
(criado no `664c033`), o lugar natural para `ClientAlreadyExistsError`, `ProjectNotFoundError` etc.
**Correção:** exceções de domínio em `core/exceptions.py`, traduzidas no router (como o webhook já faz com
`SessionNotFoundError`); repositório via `run_in_threadpool`.

### IN-02: Lock por sessão vaza quando a construção do pipeline falha; tasks do webhook sem referência

_(da revisão de 2026-10-22, reconferido)_

**Arquivos:** `backend/app/services/pipeline.py:648-656`, `backend/app/routers/webhook.py:60-62,109`
**Problema:** sem mudança. Se `_build_pipeline` lança, a exceção sai do `async with` antes do
`self._locks.pop(...)` (linha 655). Os `asyncio.create_task(pipeline_manager.push_chunk(...))` do webhook
(linhas 60-62 e 109) continuam sem referência guardada e sem tratamento da exceção.
**Correção:** `try/finally` para o pop; guardar as tasks num `set` com `add_done_callback(discard)` e logar a exceção.

### IN-03: `useMeetingAssociation` mostra por um instante a associação da reunião anterior

_(da revisão de 2026-10-22, reconferido)_

**Arquivo:** `taqciti/src/shared/hooks/useMeetingAssociation.ts:64-70`
**Problema:** sem mudança. Quando `meetingId` troca para outro id não nulo, `association` não é zerada antes da
nova assinatura.
**Correção:** `setAssociation(null)` no início do efeito.

### IN-04: `ProjectDetailPage` não zera nem cancela o readiness ao trocar de sessão

_(da revisão de 2026-10-22, reconferido)_

**Arquivo:** `frontend/src/pages/ProjectDetailPage.tsx:66-75`
**Problema:** sem mudança. O efeito não zera `readiness` e não ignora resposta atrasada da sessão anterior.
**Correção:** `setReadiness(null)` no início e flag `let current = true` com cleanup.

### IN-05: "Continuar envio" e "Descartar" ignoram a falha do comando

_(da revisão de 2026-10-22, reconferido)_

**Arquivo:** `taqciti/src/sidepanel/components/AgenteEndSlot.tsx:85-100`
**Problema:** o arquivo mudou, mas este trecho não. `handleResume` (95-100) descarta o resultado de
`resumeSend()`, e `handleDiscard` (85-92) só olha `result.ok` para navegar, sem mostrar o erro. O botão não
fica desabilitado durante o comando (só o `busyRef`).
**Correção:** guardar o erro num estado e mostrar uma linha de aviso; desabilitar o botão durante o comando.

### IN-06: Definições de "reunião ao vivo" e listas de estados duplicadas em vários arquivos

_(da revisão de 2026-10-22, reconferido)_

**Arquivos:** `taqciti/src/background/agenteBindFlow.ts:49-55`, `taqciti/src/background/agenteAssociationService.ts:30-34`, `taqciti/src/background/agenteAssociationLifecycle.ts:35-44`, `taqciti/src/shared/hooks/useLiveMeetingManualBind.ts:15-16`, `taqciti/src/background/sessionController.ts:59-61`
**Problema:** sem mudança. O CR-02 é um exemplo do mesmo padrão em outro ponto: duas regras para o mesmo
conceito ("qual é a sala"), e uma foi atualizada sem a outra.
**Correção:** exportar uma única `isMeetingLive`/`LIVE_PHASES` e `BEFORE_LINK` e importar nos outros.

### IN-07: Código duplicado entre containers e raízes de composição

_(da revisão de 2026-10-22, reconferido)_

**Arquivos:** `taqciti/src/background/agenteStreamer.ts:33-38` e `taqciti/src/background/agenteAssociation.ts:27-32` (`defaultSend` idêntico); `taqciti/src/sidepanel/components/AgenteLiveSlot.tsx:40-43,105-114` e `taqciti/src/sidepanel/components/AgenteEndSlot.tsx:40-43,74-83` (`toPickerError` e `handleBind` idênticos)
**Problema:** sem mudança. Os dois slots mudaram nesta rodada e a duplicação continua.
**Correção:** `defaultSend` num módulo compartilhado; `toPickerError` + `handleBind` num hook `useBindCommand`.

### IN-08: `recall_webhook` acessa o banco direto no router e não recebeu o tratamento do CR-01

**Arquivo:** `backend/app/routers/webhook.py:67-111`
**Problema:** no mesmo arquivo do `664c033`, a rota do Recall continua fazendo `db.table("sessions")...` e
`db.table("transcript_chunks").insert(...)` dentro do router (linhas 82-88 e 101-106). Isso fere a regra "Sem
queries Supabase em routers" do CLAUDE.md. Além disso, um `session_id` vindo do metadata do bot para uma
sessão apagada continua estourando `23503` → 500. O Recall.ai reenvia webhooks que recebem 5xx.
**Correção:** usar `TranscriptChunksRepository.insert_chunk` (que já traduz FK/UUID inválido) e mover a busca
por `recall_bot_id` para um repositório, com `SessionNotFoundError` → 404 como na rota da extensão.

### IN-09: A regra `data-picker-takeover` também esconde os toasts e o aviso de captura parada

**Arquivos:** `taqciti/src/content/ui/panel.css:97-99`, `taqciti/src/content/ui/PanelApp.tsx:873-926`, `taqciti/src/sidepanel/components/AgenteLiveSlot.tsx:82-87`
**Problema:** a regra esconde todos os irmãos do dono. No corpo ao vivo, isso inclui o `LiveStats`, que é
onde o toast do painel aparece, e o aviso "As legendas do Meet pararam de chegar". Com o seletor aberto, o
toast "Agente de volta. Falas reenviadas." (disparado pelo próprio `AgenteLiveSlot`) e qualquer
outro toast somem sem ninguém ver, e a pessoa não fica sabendo que a captura caiu enquanto escolhe o cliente.
Além disso, o seletor `:has(> [data-picker-takeover])` não tem escopo: qualquer elemento futuro com esse
atributo esconde os irmãos dele.
**Correção:** manter fora da regra o que é aviso (ex.: marcar toasts/avisos com `data-picker-keep` e usar
`:not([data-picker-takeover], [data-picker-keep])`), ou mostrar os toasts num elemento fora do corpo do painel.

### IN-10: Testes que leem o código-fonte como texto são frágeis

**Arquivos:** `taqciti/src/content/ui/panelLayout.test.ts:15-22`, `taqciti/src/sidepanel/components/AgenteLiveSlot.test.tsx:16-17,244-248`
**Problema:** `panelLayout.test.ts` procura a **linha** que contém `grid-rows-[auto_minmax(0,1fr)]` e exige que
a mesma linha tenha `grid-cols-[minmax(0,1fr)]`. Se um formatador quebrar o `className` em duas linhas, o teste
falha sem que o comportamento tenha mudado. Se alguém mover a classe para uma constante, ele dá um "não achei"
enganoso. Os dois testes usam `resolve(process.cwd(), 'src/...')`, então só funcionam com o Vitest rodando a
partir de `taqciti/`. Rodado da raiz do repositório, o `readFileSync` lança.
**Correção:** `resolve(dirname(fileURLToPath(import.meta.url)), 'PanelApp.tsx')` para o caminho; para o layout,
preferir exportar a constante de classes do `<section>` e testá-la, ou procurar o padrão no arquivo inteiro com
uma regex que tolere quebra de linha.

### IN-11: Comentário da política de reenvio ficou desatualizado com o CR-01

**Arquivo:** `taqciti/src/features/agente/sendRetryPolicy.ts:29-31`
**Problema:** o comentário ainda diz que "o webhook devolve 500 para QUALQUER erro de banco". Depois do
`664c033`, FK inexistente e UUID inválido viram 404. Quem for decidir a B3-b (`AGENTE_OUTBOX_SERVER_ERROR_MAX_AGE_MS`)
lendo esse comentário vai pesar um risco que já não existe nesses casos.
**Correção:** atualizar o comentário: sessão inexistente agora é 404 (`rejected`); só as demais falhas de banco
continuam 500.

### IN-12: O status de entrega é global, e um 404 de uma sessão antiga aparece na barra da reunião atual

**Arquivos:** `taqciti/src/features/agente/bindingView.ts:25-31`, `taqciti/src/background/agenteSendSettle.ts:68-71`
**Problema:** com o CR-01 corrigido, itens antigos de uma sessão apagada agora saem da fila com 404 em vez de
ficarem presos. Só que `taq:agenteDelivery` é um só para a fila inteira, e `linkedBarView` mostra
`rejected` para qualquer reunião `linked`. Enquanto esses itens drenam, a barra da reunião **atual** diz
"Último envio recusado pelo Agente (HTTP 404), confira o ID da sessão", apontando o problema para a sessão
errada, até a próxima entrega com sucesso.
**Correção:** guardar o `sessionId` do último item no status de entrega e só mostrar `rejected` na barra quando
ele for a sessão da associação exibida.

---

_Revisado em: 2026-10-26T20:00:00Z_
_Revisor: Claude (gsd-code-reviewer)_
_Profundidade: standard_
