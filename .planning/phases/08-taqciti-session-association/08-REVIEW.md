---
phase: 08-taqciti-session-association
reviewed: 2026-10-22T12:00:00Z
depth: standard
files_reviewed: 100
files_reviewed_list:
  - backend/app/main.py
  - backend/app/models/extension.py
  - backend/app/models/projects.py
  - backend/app/repositories/extension_repository.py
  - backend/app/repositories/transcript_chunks_repository.py
  - backend/app/routers/__init__.py
  - backend/app/routers/extension_clients.py
  - backend/app/routers/projects.py
  - backend/app/routers/sessions.py
  - backend/app/routers/webhook.py
  - backend/app/services/extension_session_service.py
  - backend/app/services/pipeline.py
  - frontend/src/pages/ProjectDetailPage.tsx
  - frontend/src/pages/ProjectFormPage.tsx
  - supabase/migrations/20261011000000_add_chunk_id_to_transcript_chunks.sql
  - taqciti/manifest.config.ts
  - taqciti/src/background/agenteAssociation.ts
  - taqciti/src/background/agenteAssociationLifecycle.ts
  - taqciti/src/background/agenteAssociationService.ts
  - taqciti/src/background/agenteBindFlow.ts
  - taqciti/src/background/agenteBindResume.ts
  - taqciti/src/background/agenteBindTarget.ts
  - taqciti/src/background/agenteBindUpload.ts
  - taqciti/src/background/agenteDeliveryTracker.ts
  - taqciti/src/background/agenteFreshStart.ts
  - taqciti/src/background/agenteSendAttempts.ts
  - taqciti/src/background/agenteSender.ts
  - taqciti/src/background/agenteSendQueue.ts
  - taqciti/src/background/agenteSendSettle.ts
  - taqciti/src/background/agenteSessionFinisher.ts
  - taqciti/src/background/agenteSessionFinisherDrain.ts
  - taqciti/src/background/agenteSessionFinisherInstance.ts
  - taqciti/src/background/agenteStatusReporter.ts
  - taqciti/src/background/agenteStreamDestination.ts
  - taqciti/src/background/agenteStreamer.ts
  - taqciti/src/background/agenteStreamerBindingRecorder.ts
  - taqciti/src/background/agenteStreamerDeps.ts
  - taqciti/src/background/agenteStreamerInstance.ts
  - taqciti/src/background/agenteStreamerSender.ts
  - taqciti/src/background/history.ts
  - taqciti/src/background/httpAgenteJson.ts
  - taqciti/src/background/httpClientDirectory.ts
  - taqciti/src/background/httpSessionGateway.ts
  - taqciti/src/background/index.ts
  - taqciti/src/background/meetingTabClosed.ts
  - taqciti/src/background/meetingTabNavigated.ts
  - taqciti/src/background/sessionController.ts
  - taqciti/src/content/ui/PanelApp.tsx
  - taqciti/src/features/agente/association.ts
  - taqciti/src/features/agente/associationClose.ts
  - taqciti/src/features/agente/associationMeeting.ts
  - taqciti/src/features/agente/associationSend.ts
  - taqciti/src/features/agente/bindingView.ts
  - taqciti/src/features/agente/clientDirectory.ts
  - taqciti/src/features/agente/clientSearch.ts
  - taqciti/src/features/agente/finishPolicy.ts
  - taqciti/src/features/agente/meetingUploader.ts
  - taqciti/src/features/agente/meetingUploadRunner.ts
  - taqciti/src/features/agente/outbox.ts
  - taqciti/src/features/agente/sendRetryPolicy.ts
  - taqciti/src/features/history/eviction.ts
  - taqciti/src/features/meeting/machine.ts
  - taqciti/src/shared/config/agenteAssociationStore.ts
  - taqciti/src/shared/config/agenteConfig.ts
  - taqciti/src/shared/config/agenteDeliveryStore.ts
  - taqciti/src/shared/config/agenteOutboxStore.ts
  - taqciti/src/shared/config/agenteRoutes.ts
  - taqciti/src/shared/config/agenteStatus.ts
  - taqciti/src/shared/config/constants.ts
  - taqciti/src/shared/hooks/useAgenteConfigForm.ts
  - taqciti/src/shared/hooks/useAgenteStreamingStatus.ts
  - taqciti/src/shared/hooks/useAssociations.ts
  - taqciti/src/shared/hooks/useClientDirectory.ts
  - taqciti/src/shared/hooks/useLiveMeetingManualBind.ts
  - taqciti/src/shared/hooks/useMeetingAssociation.ts
  - taqciti/src/shared/types/agenteMessages.ts
  - taqciti/src/shared/types/messages.ts
  - taqciti/src/shared/ui/ConfirmModal.tsx
  - taqciti/src/shared/ui/Icon.tsx
  - taqciti/src/sidepanel/components/AgenteBindingBar.tsx
  - taqciti/src/sidepanel/components/AgenteDecisionCard.tsx
  - taqciti/src/sidepanel/components/AgenteEndPrompt.tsx
  - taqciti/src/sidepanel/components/AgenteEndSlot.tsx
  - taqciti/src/sidepanel/components/AgenteLiveSlot.tsx
  - taqciti/src/sidepanel/components/AgenteNudge.tsx
  - taqciti/src/sidepanel/components/AgenteNudgeAnchor.tsx
  - taqciti/src/sidepanel/components/AssociationBadge.tsx
  - taqciti/src/sidepanel/components/AssociationBadgeFor.tsx
  - taqciti/src/sidepanel/components/ClientCreateForm.tsx
  - taqciti/src/sidepanel/components/ClientPicker.tsx
  - taqciti/src/sidepanel/components/ClientPickerList.tsx
  - taqciti/src/sidepanel/components/containEscape.ts
  - taqciti/src/sidepanel/components/HistoryCard.tsx
  - taqciti/src/sidepanel/components/ManualSessionIdForm.tsx
  - taqciti/src/sidepanel/components/RecordDetail.tsx
  - taqciti/src/sidepanel/screens/AgenteConfigScreen.tsx
  - taqciti/src/test/agentePanelHarness.tsx
  - taqciti/src/test/chromeStorageMock.ts
  - taqciti/src/test/fakeClientDirectory.ts
  - taqciti/tailwind.config.ts
findings:
  critical: 1
  warning: 8
  info: 7
  total: 16
status: issues_found
---

# Fase 8: Relatório de Code Review

**Revisado em:** 2026-10-22
**Profundidade:** standard
**Arquivos revisados:** 100
**Status:** issues_found

## Resumo

Revisei os 100 arquivos de produção que a Fase 8 alterou em relação à Fase 7: backend (rotas
`/webhook/extension/*`, `chunk_id`, finish com DocuData, lock do pipeline), os três arquivos com conflito
de merge resolvido à mão (`projects.py`, `ProjectDetailPage.tsx`, `ProjectFormPage.tsx`) e toda a
Taqciti (associação reunião→cliente, fila durável, envio em partes, encerramento da sessão por alarme, UI).

No geral o código está bem organizado: o reducer da associação é puro e fácil de seguir, os stores
seguem o padrão "escritor único + fila serializada" e a chave `x-agente-key` nunca é persistida. Os três
arquivos do merge estão coerentes entre si (o `docudata_project_id` está ligado de ponta a ponta e a chave
Gemini ficou opcional nos dois lados).

O problema mais grave está na **interação entre backend e Taqciti**: uma única fala endereçada a uma
sessão que não existe mais (ou que nunca existiu, no plano B do ID manual) faz o backend responder 500 para
sempre, e a regra "retirada-nunca" da B3-b deixa essa fala no topo da fila durável. Ela passa a bloquear
**todas** as falas de **todas** as reuniões seguintes, sem saída para a pessoa além de desligar o envio
(o que apaga a fila inteira). Os outros pontos são de robustez: sessões do Agente que ficam abertas
gastando Gemini quando a reunião é apagada do histórico, rotas novas abertas quando a env var não existe,
e perda de falas em cenários de 401 e de "Continuar envio".

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Uma fala para sessão inexistente trava a fila durável de envio para sempre (HTTP 500 + "retirada-nunca")

**Arquivos:**
- `backend/app/routers/webhook.py:42-50`
- `backend/app/repositories/transcript_chunks_repository.py:33-39`
- `taqciti/src/features/agente/sendRetryPolicy.ts:33,69-77`
- `taqciti/src/background/agenteSendSettle.ts:48-51`
- `taqciti/src/background/agenteSender.ts:104-109`

**Problema:** `transcript_chunks.session_id` tem FK para `sessions(id)`. Quando a fala chega com um
`session_id` que não existe, o insert falha com `23503` (foreign_key_violation). O repositório só trata
`23505` e relança o resto; o handler global de `main.py` devolve **500**. Na Taqciti, 500 é "retryable";
esgotadas as tentativas, `classifyExhausted` devolve `'hold'` (porque `AGENTE_OUTBOX_SERVER_ERROR_MAX_AGE_MS
= null`) e o item **fica no topo da fila**. A cada 15 s o sender tenta o mesmo topo de novo, e nenhum item
atrás dele sai, inclusive os de outras sessões e de reuniões futuras, porque a fila é única e global.

Isso acontece em situações bem comuns:
1. **Plano B (ID manual):** o formulário só valida o *formato* UUID (`ManualSessionIdForm.tsx`,
   `agenteMessages.ts:16-22`). Com um UUID bem formado mas errado, se a reunião ainda não tinha segmentos
   (`parts = []`), o vínculo vai direto para `linked` e o streamer começa a mandar falas para uma sessão que
   não existe.
2. **Projeto apagado no web app** (`DELETE /projects/{id}` não checa sessão ativa e as sessões caem em
   cascata) com uma reunião `linked` em andamento.
3. **Sessão encerrada pela Taqciti depois do prazo de 5 min com backlog na fila** e depois apagada no web
   app (`DELETE /sessions/{id}` só recusa sessão `active`).

Efeito em produção: a barra mostra "O Agente está fora do ar" (`bindingView.ts:27`) com o backend no ar;
o agendador de encerramento nunca vê a fila esvaziar e encerra as sessões seguintes pelo prazo de 5 min,
com as falas delas presas; a única saída é desligar o envio, e `cancelAll()` apaga a fila inteira, perdendo
todo o backlog legítimo.

**Correção:** dos dois lados. No backend, sessão inexistente é erro definitivo (4xx), não 500:

```python
# transcript_chunks_repository.py
_UNIQUE_VIOLATION = "23505"
_FK_VIOLATION = "23503"

class SessionNotFoundError(Exception): ...

        except APIError as exc:
            if exc.code == _UNIQUE_VIOLATION:
                return False
            if exc.code == _FK_VIOLATION:
                raise SessionNotFoundError(session_id) from exc
            raise

# webhook.py — e validar o formato antes (session_id: UUID no ExtensionChunk)
    try:
        inserted = TranscriptChunksRepository(db).insert_chunk(...)
    except SessionNotFoundError:
        raise HTTPException(status_code=404, detail="Session not found")
```

Na Taqciti, como defesa em profundidade, um item que fica preso por muito tempo não pode segurar itens de
**outra** sessão. Por exemplo, ao dar `hold`, pular para o próximo item de outra `sessionId`, ou aplicar um
teto de idade para o topo bloqueado. Isso é decisão do time (mexe na B3-b), então fica registrado como
**DECISÃO EM ABERTO**. A correção do backend sozinha já resolve os três cenários acima, porque o 404 cai em
`rejected`, a fala sai da fila e vai para o rastro.

## Warnings

### WR-01: As rotas novas da extensão ficam abertas a qualquer um quando `EXTENSION_SHARED_KEY` não está definida

**Arquivos:** `backend/app/routers/webhook.py:22-29`, `backend/app/routers/extension_clients.py:37-71`, `backend/app/main.py:47-53`

**Problema:** `verify_extension_key` é opt-in: sem a env var, ele simplesmente não valida nada. A Fase 7
usava esse gate só para o POST de chunk. A Fase 8 reaproveitou o mesmo gate para rotas bem mais sensíveis:
listar **todos** os clientes/projetos (`GET /clients`), criar projetos (`POST /clients`), abrir sessões e
encerrar sessões. Com `allow_origins=["*"]`, qualquer site aberto no navegador de alguém da equipe pode
chamar essas rotas. Se o deploy no Railway estiver sem a variável, a lista de clientes da CITi fica pública.
O resto da API também não tem autenticação, mas foi nesta fase que a superfície "pensada para um cliente
externo" cresceu.

**Correção:** fazer as rotas novas falharem fechadas (sem chave configurada, 503 ou 401), mantendo o opt-in
só no POST de chunk legado, para não quebrar a Fase 7:

```python
def require_extension_key(x_agente_key: str | None = Header(default=None)) -> None:
    expected = os.environ.get("EXTENSION_SHARED_KEY", "")
    if not expected:
        raise HTTPException(status_code=503, detail="Extension key not configured")
    if not x_agente_key or not secrets.compare_digest(x_agente_key, expected):
        raise HTTPException(status_code=401, detail="Missing or invalid x-agente-key header")
```

Mudar o contrato é **DECISÃO EM ABERTO** do time. No mínimo, conferir que a variável está definida em
produção antes do merge.

### WR-02: Apagar a reunião do histórico (ou a evicção) deixa a sessão do Agente aberta para sempre, gastando Gemini

**Arquivos:** `taqciti/src/background/index.ts:228-236`, `taqciti/src/background/history.ts:58-62`, `taqciti/src/features/history/eviction.ts:12-20`, `taqciti/src/sidepanel/components/RecordDetail.tsx:39-40`

**Problema:** `ui/history/delete` faz `deleteRecord` + `removeAssociation` sem olhar o estado da associação.
Quando ela está `linked`, `sent`, `sending` ou `send-failed`, com sessão criada pela Taqciti (`picker`) e
ainda não encerrada (por exemplo, esperando o prazo de 5 min ou no backoff de 16 h), o próximo alarme roda
`run()`, encontra `association === null` e só limpa o alarme (`agenteSessionFinisherInstance.ts:98-100`).
A sessão nunca recebe o finish. No backend o `SessionPipeline` dessa sessão continua chamando
`classify_coverage` a cada 30 s e `detect_red_flags` a cada 15 s, sem checar se chegou fala nova, até o
processo reiniciar. É o custo de IA ocioso que a B4-b queria evitar. A evicção (`upsertRecord`) tem o mesmo
efeito: `linked`/`sent` não são protegidos e `removeAssociations(evicted)` apaga a associação. Apagar
durante `sending` também interrompe o acompanhamento: o upload segue, mas os eventos caem no vazio.

**Correção:** antes de remover a associação, pedir o encerramento (ou deixar uma "lápide" só com
`sessionId`/`origin`/`finishBy` até o finish dar certo). Por exemplo, no handler:

```ts
case 'ui/history/delete': {
  const association = await getAssociation(message.id);
  if (association && isEligibleForClose(association)) {
    await agenteSessionFinisher.evaluate(message.id).catch(() => undefined);
  }
  ...
}
```

Na evicção, tratar como protegidas as associações que ainda são `isEligibleForClose`.

### WR-03: HTTP 401/403 descarta, uma a uma, todas as falas da fila durável, e corrigir a chave apaga o que sobrou

**Arquivos:** `taqciti/src/features/agente/sendRetryPolicy.ts:40-45`, `taqciti/src/background/agenteSendSettle.ts:64-72`, `taqciti/src/background/agenteStreamerInstance.ts:114-118`, `taqciti/src/background/agenteStreamDestination.ts:93`

**Problema:** 401/403 são `rejected` (definitivo). Se o servidor trocar a `EXTENSION_SHARED_KEY` (ou a pessoa
digitar a chave errada), cada fala da fila é tentada uma vez, recebe 401 e é removida. Com até 1000 itens
isso esvazia a fila em segundos, inclusive o backlog guardado enquanto o Agente estava fora. Para uma
reunião `linked` não existe caminho de reenvio, porque "Continuar envio" só vale para `send-failed`. Para
piorar, quando a pessoa corrige a chave, `queueKey` (URL + chave) muda e `syncDestination` chama
`sender.cancelAll()`, que limpa a fila durável. Erro de configuração vira perda definitiva de transcrição no
Agente. Fica só a cópia local e um contador no rastro.

**Correção:** tratar 401/403 como "segurar" (igual ao offline, sem retirar o item), mostrando o aviso de
chave na barra. E, na política de associação, trocar a chave não deve invalidar a fila: o request já é
remontado com a chave atual em `buildOutboxRequest`. Basta `queueKey` usar só a URL. Como mexe na política
da Fase 7, é **DECISÃO EM ABERTO**.

### WR-04: "Continuar envio" pode pular palavras do último segmento que estava sendo falado na hora do vínculo

**Arquivos:** `taqciti/src/background/agenteBindResume.ts:57-61`, `taqciti/src/background/agenteBindFlow.ts:158-159`, `taqciti/src/features/agente/meetingUploader.ts:41-43`

**Problema:** no vínculo ao vivo, as partes são planejadas com os segmentos daquele instante. O último
segmento costuma estar incompleto e depois ganha mais palavras. Se o envio em partes falha depois de
entregar esse segmento, a associação fica `send-failed` com `sendProgress.done` apontando para depois dele.
O streamer ficou em `hold` durante o `linking`, então a continuação desse segmento nunca saiu ao vivo.
No "Continuar envio", `prepareResume` replaneja com `record.segments` (o texto completo) e começa em
`startAt = done`, pulando o segmento estendido. Mesmo que ele fosse reenviado, o `chunk_id`
`bulk:{meetingId}:{index}` é o mesmo, e o backend descartaria como duplicata. Resultado: as palavras ditas
depois do clique, naquele segmento, nunca chegam ao Agente.

**Correção:** guardar na associação, junto com `sendProgress`, as contagens de palavras já enviadas por
`key` (o mesmo formato de `seedFromParts`). Na retomada, mandar só o delta dos segmentos já entregues, com
um `chunk_id` diferente (ex.: `bulk:{meetingId}:{index}:{wordsFrom}`), e depois seguir de `done`.

### WR-05: Reinício do service worker durante o vínculo ao vivo corta o envio pelo resto da reunião, sem saída

**Arquivos:** `taqciti/src/background/agenteAssociationLifecycle.ts:121-125`, `taqciti/src/background/agenteBindResume.ts:42-44`

**Problema:** no boot, uma associação `linking` com sessão vira `send-failed` (`link-failed: 'send'`), mesmo
que a reunião esteja ao vivo. Daí em diante a política de destino devolve `idle` para `send-failed`, então
nada mais sai ao vivo, e `prepareResume` recusa a retomada enquanto a reunião está ao vivo
(`live → invalid-state`). A barra mostra "O envio parou…", mas não há botão nem caminho para religar. Depois
do fim, o agendador encerra a sessão 5 min mais tarde (`send-failed` é elegível), e a análise ao vivo daquela
reunião se perde. No MV3, o service worker reiniciar no meio de uma reunião longa não é raro.

**Correção:** no boot, se a reunião está ao vivo e a associação está `linking` com sessão, relançar o envio
em partes a partir de `sendProgress.done` em vez de marcar `send-failed`. Outra opção é permitir
`resume-send` ao vivo, voltando para `linking`.

### WR-06: Checagem de cliente duplicado no backend não é atômica e não bate com a regra da Taqciti

**Arquivos:** `backend/app/services/extension_session_service.py:30-34,88-99`, `taqciti/src/features/agente/clientSearch.ts:12-14`

**Problema:** `create_client` lê todos os nomes e depois insere. Dois pedidos simultâneos com o mesmo nome
(duas pessoas, ou um retry) passam juntos, e não há índice único em `projects.client` que segure. Além
disso, as normalizações divergem: o backend usa NFKD + `casefold()` e a Taqciti usa NFD +
`toLocaleLowerCase('pt-BR')`. Para "ß", ligaduras ("ﬁ") e caracteres de compatibilidade, uma aceita e a
outra recusa, e a pessoa vê "Já existe" só depois de ir à rede (ou ao contrário).

**Correção:** um índice único funcional no banco (ex.: `CREATE UNIQUE INDEX ... ON projects
(lower(unaccent(client)))`), tratando o `23505` como 409 no repositório; e alinhar a normalização do front
(`normalize('NFKD')` + `toLowerCase()`) com a do back. O índice muda o schema, então é **DECISÃO EM
ABERTO**: projetos antigos do web app podem já ter duplicatas.

### WR-07: Edição de projeto não consegue limpar campos (DMS "Limpar", budget, vínculo DocuData), e a UI promete que consegue

**Arquivos:** `backend/app/routers/projects.py:100-102`, `frontend/src/pages/ProjectFormPage.tsx:95-106,203`

**Problema:** `update_project` usa `model_dump(exclude_none=True)`, e o form apaga do payload todo campo
vazio/`undefined`. Por isso o botão "Limpar" do Data Maturity Score, apagar o budget ("Sem limite") ou
apagar a descrição/contexto não têm efeito: depois de salvar e recarregar, o valor antigo volta. No
`docudata_project_id` o hint avisa, mas nos outros campos não há aviso. Isso estava no arquivo antes da fase,
mas o merge manual manteve o comportamento e o form continua oferecendo a ação.

**Correção:** usar `exclude_unset=True` no backend (para distinguir "não enviado" de "enviado como null")
e, no form, mandar `null` explicitamente para os campos que a pessoa limpou:

```python
updates = payload.model_dump(mode="json", exclude_unset=True, exclude={"gemini_api_key", "pricing_api_key"})
```

Mudar o contrato do PUT é **DECISÃO EM ABERTO** (afeta o `docudata_project_id`, cuja regra hoje é "não
desvincula").

### WR-08: `taq:history` continua com leitura-modifica-grava sem fila, agora com mais escritores concorrentes

**Arquivos:** `taqciti/src/background/history.ts:45-63,70-85`, `taqciti/src/background/agenteAssociationService.ts:74-78`

**Problema:** `upsertRecord`, `patchRecord` e `deleteRecord` leem o array inteiro e gravam de volta, sem
serialização. A Fase 8 adicionou escritores que rodam em paralelo com o salvamento contínuo da reunião
(`saveLiveRecord` dentro do `dispatch`): o `discard` (D-11) e a evicção. Se um `discard` e um `upsertRecord`
se cruzarem, um apaga a escrita do outro: a reunião descartada "ressuscita" sem associação, ou a última
gravação da reunião viva some. O próprio comentário de `agenteAssociationStore.ts:9` cita esse risco (WR-01
da Fase 7).

**Correção:** aplicar ao histórico o mesmo padrão `enqueue` + cache dos stores novos (fila única de escrita
no service worker).

## Info

### IN-01: Service lança `HTTPException` e o finish async chama o cliente Supabase síncrono no event loop

**Arquivo:** `backend/app/services/extension_session_service.py:15,92,107,129-131`
**Problema:** o service depende do FastAPI (`HTTPException`), o que mistura camada HTTP com regra de negócio
(CLAUDE.md: routers traduzem, services decidem). Além disso, `finish_session` é `async def` e chama
`self._repo.*` (supabase-py síncrono), bloqueando o event loop durante as queries.
**Correção:** exceções de domínio (`ClientAlreadyExists`, `ProjectNotFound`, `SessionNotFinishable`)
traduzidas no router. Rodar as chamadas de repositório com `run_in_threadpool`, ou deixar a rota síncrona
e agendar o `stop_session` à parte.

### IN-02: Lock por sessão vaza quando a construção do pipeline falha; tasks do webhook sem referência

**Arquivo:** `backend/app/services/pipeline.py:648-656`, `backend/app/routers/webhook.py:54-56`
**Problema:** se `_build_pipeline` lançar (queda do banco, por exemplo), a exceção sai antes do
`self._locks.pop(...)`, e o lock fica no dicionário. O `asyncio.create_task(pipeline_manager.push_chunk(...))`
não guarda referência nem trata a exceção: a task pode ser coletada no meio do caminho, e o erro vira só
"Task exception was never retrieved".
**Correção:** `try/finally` em volta do `async with lock` para o pop; guardar as tasks num `set` com
`add_done_callback(discard)` e logar a exceção (mesmo padrão de `_TAREFAS` em `discovery_export.py`).

### IN-03: `useMeetingAssociation` mostra por um instante a associação da reunião anterior

**Arquivo:** `taqciti/src/shared/hooks/useMeetingAssociation.ts:64-70`
**Problema:** quando `meetingId` muda para outro id não nulo, o estado `association` não é zerado. Até a
leitura inicial da nova assinatura resolver, a UI (barra, bolha, cartão) mostra o estado da reunião
anterior, e um clique nesse intervalo manda comando para o id novo com base no estado velho.
**Correção:** `setAssociation(null)` no início do efeito, antes de assinar.

### IN-04: `ProjectDetailPage` não zera nem cancela o readiness ao trocar de sessão

**Arquivo:** `frontend/src/pages/ProjectDetailPage.tsx:66-75`
**Problema:** quando `discoverySessionId` muda (sessão apagada ou nova), o `readiness` da sessão anterior
continua no estado até o fetch novo voltar, e o efeito não cancela a resposta antiga. Uma resposta atrasada
da sessão antiga pode sobrescrever a da nova.
**Correção:** `setReadiness(null)` no início do efeito e uma flag `let current = true` com cleanup, como em
`useClientDirectory`.

### IN-05: "Continuar envio" e "Descartar" ignoram a falha do comando

**Arquivo:** `taqciti/src/sidepanel/components/AgenteEndSlot.tsx:84-99`
**Problema:** `handleResume` e `handleDiscard` descartam o `AgenteCommandResult`. Com o envio desligado,
`resume-send` volta `unavailable`, e a pessoa clica sem acontecer nada. O botão também não fica desabilitado
enquanto o comando roda (só o `busyRef`).
**Correção:** guardar o erro num estado e mostrar uma linha de aviso (ex.: "Ligue o envio ao Agente para
continuar"); desabilitar o botão durante o comando.

### IN-06: Definições de "reunião ao vivo" e listas de estados duplicadas em vários arquivos

**Arquivos:** `taqciti/src/background/agenteBindFlow.ts:49-55`, `taqciti/src/background/agenteAssociationService.ts:30-34`, `taqciti/src/background/agenteAssociationLifecycle.ts:35-44`, `taqciti/src/shared/hooks/useLiveMeetingManualBind.ts:15-16`, `taqciti/src/background/sessionController.ts:59-61`
**Problema:** `LIVE_PHASES`/`isMeetingLive`/`BEFORE_LINK` foram copiados em pelo menos quatro lugares, e o
`sessionController` usa uma definição diferente (sem `captionsRequired`). Uma mudança futura numa cópia
gera divergência silenciosa (por exemplo, `discard` e `bind` discordarem sobre o que é "ao vivo").
**Correção:** exportar uma única `isMeetingLive`/`LIVE_PHASES` (já existe em
`agenteAssociationLifecycle.ts`) e `BEFORE_LINK` (já existe em `associationMeeting.ts`) e importar nos outros.

### IN-07: Código duplicado entre containers e raízes de composição

**Arquivos:** `taqciti/src/background/agenteStreamer.ts:33-38` e `taqciti/src/background/agenteAssociation.ts:27-32` (`defaultSend` idêntico); `taqciti/src/sidepanel/components/AgenteLiveSlot.tsx:40-43` e `AgenteEndSlot.tsx:39-42` (`toPickerError` idêntico, além do mesmo `handleBind`)
**Problema:** é a mesma lógica em dois lugares. Se o timeout ou o mapeamento de erro mudar num só, os dois
caminhos passam a se comportar diferente.
**Correção:** mover `defaultSend` para um módulo compartilhado (ex.: `httpAgenteSend.ts`), e
`toPickerError` + `handleBind` para um hook `useBindCommand`.

---

_Revisado em: 2026-10-22T12:00:00Z_
_Revisor: Claude (gsd-code-reviewer)_
_Profundidade: standard_
