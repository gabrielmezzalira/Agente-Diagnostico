---
phase: 08-taqciti-session-association
fixed_at: 2026-10-27T11:30:00Z
review_path: .planning/phases/08-taqciti-session-association/08-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 5
skipped: 4
status: partial
---

# Fase 8: Relatório de Correção do Code Review

**Corrigido em:** 2026-10-27
**Revisão de origem:** `.planning/phases/08-taqciti-session-association/08-REVIEW.md`
**Iteração:** 1

**Resumo:**
- Achados no escopo (`critical_warning`): 9 (WR-01 a WR-09; nenhum crítico)
- Corrigidos: 5 (WR-09, WR-02, WR-08, WR-04, WR-05)
- Pulados: 4 (WR-01, WR-03, WR-06, WR-07 — decisão do time de 2026-10-27, follow-up)

O time já tinha feito a triagem dos warnings antes desta rodada: só os cinco acima entraram. Os achados IN-*
estão fora do escopo (`fix_scope=critical_warning`) e não foram tocados.

## Onde a verificação rodou

Tudo foi codado e verificado num worktree isolado (`.claude/worktrees/rf-08-...`), com `taqciti/node_modules`
ligado ao `node_modules` do checkout principal por uma junção de diretório (removida sem recursão antes de
desfazer o worktree; o `node_modules` principal ficou intacto). Os commits foram fast-forward para a branch
`feat/fase-08-taqciti-session-association` e o worktree foi removido. Os números abaixo, portanto, não vêm
do checkout principal, mas a árvore é a mesma dos commits atuais da branch.

Rodadas finais (dentro de `taqciti/`):
- `npm run typecheck`: limpo.
- `npm run lint`: limpo (depois do commit `99d1a26`, que tirou um parâmetro não usado do mock do teste do WR-02).
- `npm test` (suíte inteira, antes do commit de lint): 90 arquivos, 1434 testes passando, 0 falhas.

## Fixed Issues

### WR-09: Na tela "Transcrição salva" com o painel compacto (320 px), o seletor de cliente continua com a lista em 0 px

**Status:** fixed
**Commit:** `27d215e`
**Arquivos:** `taqciti/src/sidepanel/components/AgenteEndSlot.tsx`, `taqciti/src/sidepanel/components/AgenteEndSlot.test.tsx`, `taqciti/src/content/ui/PanelApp.tsx`
**Correção aplicada:** o `AgenteEndSlot` ganhou `panelSize` e `onPanelSizeChange` (opcionais, só valem em `surface="panel"`)
e `openPicker` chama `onPanelSizeChange('regular')` quando o painel está `compact`, igual ao `AgenteLiveSlot`. O
`PanelApp` repassa `prefs.size` e o callback por `PanelBody` e `MeetingScreen` até o slot. A saída larga
(`RecordDetail`) não passa as props e nunca mexe no tamanho. O código atual batia com o que o review descreveu.
**Testes:** 3 novos em `AgenteEndSlot.test.tsx` (compacto sobe uma vez; regular não sobe; saída larga nunca sobe).
`AgenteEndSlot.test.tsx` + `src/content/ui`: 23 passando.

### WR-02: Apagar a reunião do histórico (ou a evicção) deixa a sessão do Agente aberta para sempre, gastando Gemini

**Status:** fixed: requires human verification
**Commits:** `d1aaa1b` (correção) e `99d1a26` (ajuste de lint no teste)
**Arquivos:** `taqciti/src/features/agente/associationClose.ts`, `taqciti/src/shared/config/agenteAssociationStore.ts`, `taqciti/src/background/history.ts`, `taqciti/src/background/agenteAssociationRelease.ts` (novo), `taqciti/src/background/index.ts`, `taqciti/src/background/agenteSessionFinisherInstance.ts`, `taqciti/src/background/agenteSessionFinisher.ts`, mais testes (`agenteAssociationRelease.test.ts` novo, `history.test.ts`, `agenteSessionFinisherInstance.test.ts`, `agenteSessionFinisher.test.ts`, `agenteAssociationStore.test.ts`)

**Abordagem escolhida (a que menos muda o que a pessoa vê):** em vez de pedir o encerramento síncrono antes de
apagar (que obrigaria a esperar fila e rede no clique de "Apagar") ou criar uma "lápide" nova (campo novo,
evento novo e normalização no store), a própria associação faz o papel de lápide. Ela já guarda `sessionId`,
`origin` e `finishBy`, e é só isso que o agendador lê.
- `isCloseOwed` (novo, em `associationClose.ts`): a Taqciti ainda deve o encerramento, ou seja, a associação é
  elegível agora ou desistiu e ganha rodada nova no boot (DA-5).
- `removeAssociations(ids, keep?)` no store: com o predicado `keep`, a decisão e a remoção acontecem na mesma
  operação da fila de escrita e devolvem os ids poupados.
- Apagar do histórico (`ui/history/delete`): passa por `releaseMeetingAssociation`, que poupa a associação em
  dívida e já chama `agenteSessionFinisher.evaluate` sem esperar. Quem não deve mais nada sai junto com a
  reunião, como antes (descartar no estado `ended-unsent`, ID manual e sessão já encerrada não mudam).
- Evicção em `upsertRecord`: usa o mesmo predicado, então a associação em dívida fica. O encerramento dela fica
  por conta do alarme que já existe e da varredura do boot (a evicção só atinge reuniões antigas).
- Limpeza: o agendador ganhou a dependência opcional `onSessionFinished`. Depois do `session-finished`, e só se a
  sala não voltou ao vivo (a defesa da reentrada vem antes), a composição apaga a associação que sobrou quando a
  reunião não está mais no histórico. Assim o mapa de associações não acumula órfãs.

**O que a pessoa vê:** nada muda no clique de apagar. O efeito é só nos bastidores (a sessão agora é encerrada).
**Precisa de verificação humana:** é lógica de estado. Sugestão: vincular uma reunião ao cliente pelo seletor,
encerrar, apagar do histórico antes de o alarme de 5 minutos disparar e conferir no Agente que a sessão fecha.
**Testes:** `agenteAssociationRelease.test.ts` (8, novo), mais casos em `history.test.ts` (evicção poupa a
associação em dívida), `agenteSessionFinisherInstance.test.ts` (`onSessionFinished` só depois de fechar, não
quando o finish falha, não quando a sala volta ao vivo, falha dele não desfaz o encerramento),
`agenteSessionFinisher.test.ts` (reunião apagada: encerra e recolhe a associação) e `agenteAssociationStore.test.ts`
(`keep`).

### WR-08: `taq:history` continua com leitura-modifica-grava sem fila, agora com mais escritores concorrentes

**Status:** fixed (commit separado do WR-02, como pedido)
**Commit:** `62ffe01`
**Arquivos:** `taqciti/src/background/history.ts`, `taqciti/src/background/history.test.ts`
**Correção aplicada:** `upsertRecord`, `patchRecord`, `deleteRecord` e também `finalizeStaleRecordings` (que faz o mesmo
ciclo e tinha a mesma corrida) passam por um `enqueue` único, o mesmo padrão dos stores novos da Fase 8: cada
escrita espera a anterior e sobrevive à falha dela.
**Desvio consciente do padrão:** **sem cache em memória** (os stores novos têm). O `storageMigrations` e os painéis
mexem em `taq:history` por fora, então um cache poderia ficar velho; a leitura feita dentro da fila já é sempre
fresca e resolve a corrida. Se o time preferir o cache também, é um follow-up pequeno.
**Testes:** 3 novos em `history.test.ts`. Antes da correção, 2 deles falhavam (corrida reproduzida: um `delete`
concorrente com `upsert`/`rename` trazia a reunião apagada de volta). Agora passam.

### WR-04: "Continuar envio" pode pular palavras do último segmento que estava sendo falado na hora do vínculo

**Status:** fixed: requires human verification
**Commit:** `1669564`
**Arquivos:** `taqciti/src/features/agente/association.ts`, `taqciti/src/features/agente/associationSend.ts`, `taqciti/src/features/agente/meetingUploader.ts`, `taqciti/src/shared/config/agenteAssociationStore.ts`, `taqciti/src/background/agenteBindUpload.ts`, `taqciti/src/background/agenteBindResume.ts`, `taqciti/src/background/agenteBindFlow.ts`, mais testes (`association.test.ts`, `agenteAssociationStore.test.ts`, `meetingUploader.test.ts`, `agenteBindFlow.test.ts`)
**Correção aplicada:** a associação guarda `sentWords` (palavras entregues por segmento) quando o envio em partes para
(eventos `link-failed`/`send-failed` com `sentWords` opcional; some quando o envio conclui). Na retomada,
`planCatchUp` monta uma reposição só com as palavras que faltam dos segmentos antes de `startAt`, com `chunk_id`
distinto `bulk:{meetingId}:{index}:{wordsFrom}`, enviada antes das partes restantes. O backend e o contrato não
foram tocados (só muda a string do `chunk_id`, que é como o backend deduplica). `done`/`total` seguem contando o
plano completo, e a semente final (`seedFromParts`) cobre o texto inteiro, então o streamer não repete nada.
Falhas gravadas antes desta correção (sem `sentWords`) retomam exatamente como antes.
**Limite conhecido:** `sentWords` só é gravado quando o envio PARA. Se o service worker morrer no meio do envio, as
palavras da fala em andamento entre o clique e a morte não são recuperadas (mesmo limite do WR-05, abaixo).
**Precisa de verificação humana:** é lógica de envio. Sugestão: vincular no meio de uma fala longa, cortar a rede,
deixar a reunião acabar e usar "Continuar envio"; conferir que a transcrição no Agente tem o final da fala.
**Testes:** 4 novos em `agenteBindFlow.test.ts` (reposição com `bulk:m1:1:3`, falha depois da reposição, reposição que
falha e retoma depois, `sentWords` gravado na falha), 3 em `meetingUploader.test.ts`, 2 em `association.test.ts`
e 1 em `agenteAssociationStore.test.ts`.

### WR-05: Reinício do service worker durante o vínculo ao vivo corta o envio pelo resto da reunião, sem saída

**Status:** fixed: requires human verification
**Commit:** `156d63c`
**Arquivos:** `taqciti/src/background/agenteAssociationLifecycle.ts`, `taqciti/src/background/agenteBindFlow.ts`, `taqciti/src/background/agenteAssociationService.ts`, `taqciti/src/background/agenteAssociation.ts`, `taqciti/src/background/index.ts`, mais testes (`agenteAssociationLifecycle.test.ts`, `agenteBindFlow.test.ts`, `agenteAssociationService.test.ts`)
**Correção aplicada:** primeira opção do review. `recoverAssociationsAfterRestart` agora deixa em `linking` a associação com
sessão e reunião ao vivo (a reunião fora do ar continua indo para `send-failed`, com "Continuar envio"). O novo
`resumeLiveLink` (fluxo de vínculo) relança o envio em partes a partir de `sendProgress.done`, para a mesma
sessão, com tudo o que já foi falado. `resumeLiveLinksAfterRestart` varre as associações, e o `index.ts` o chama
no boot sem `await` (não atrasa os handlers). Sem destino válido (streaming desligado) cai em `send-failed`; nova
falha também, sem laço; dois relançamentos simultâneos não duplicam envio.
**Limite conhecido:** o plano é refeito com o que foi dito até o boot; palavras da fala em andamento no clique,
dentro de uma parte que já tinha sido entregue, não são reposicionadas (ver WR-04).
**Precisa de verificação humana:** reiniciar o service worker (chrome://extensions, "service worker") no meio do
envio ao vivo e conferir que a barra segue "Enviando ao vivo" até virar `linked`.
**Testes:** 9 novos (7 em `agenteBindFlow.test.ts`: relança do `done`, do zero, nova falha, duas recusas, streaming desligado,
simultâneo; `agenteAssociationLifecycle.test.ts`: `linking` ao vivo fica; `agenteAssociationService.test.ts`:
varredura do boot).

## Skipped Issues

### WR-01: As rotas novas da extensão ficam abertas a qualquer um quando `EXTENSION_SHARED_KEY` não está definida

**Arquivos:** `backend/app/routers/webhook.py:23-30`, `backend/app/routers/extension_clients.py:37-71`, `backend/app/main.py:47-53`
**Motivo:** decisão do time (2026-10-27): follow-up, fora deste --fix — risco T-08-10 já aceito pelo time até o login do AGM (AR-08-01 em `08-SECURITY.md`); mudar o gate contradiz a decisão registrada.
**Problema original:** `verify_extension_key` só valida quando a variável existe; com `allow_origins=["*"]`, qualquer site aberto por alguém da equipe pode listar clientes e criar projetos se a variável faltar no Railway.

### WR-03: HTTP 401/403 descarta, uma a uma, todas as falas da fila durável, e corrigir a chave apaga o que sobrou

**Arquivos:** `taqciti/src/features/agente/sendRetryPolicy.ts:40-45`, `taqciti/src/background/agenteSendSettle.ts:64-72`, `taqciti/src/background/agenteStreamerInstance.ts:114-118`, `taqciti/src/background/agenteStreamDestination.ts:93`
**Motivo:** decisão do time (2026-10-27): follow-up, fora deste --fix — muda a política de reenvio da Fase 7 (DECISÃO EM ABERTO).
**Problema original:** 401/403 viram `rejected` e saem da fila; trocar a chave muda o `queueKey` e o `cancelAll()` apaga o que sobrou.

### WR-06: Checagem de cliente duplicado no backend não é atômica e não bate com a regra da Taqciti

**Arquivos:** `backend/app/services/extension_session_service.py:30-34,88-99`, `taqciti/src/features/agente/clientSearch.ts:12-14`
**Motivo:** decisão do time (2026-10-27): follow-up, fora deste --fix — exige índice único/migração no schema (DECISÃO EM ABERTO).
**Problema original:** `create_client` lê e depois insere sem índice único, e a normalização do backend (NFKD + `casefold`) difere da da Taqciti (NFD + `toLocaleLowerCase('pt-BR')`).

### WR-07: Edição de projeto não consegue limpar campos (DMS "Limpar", budget, vínculo DocuData), e a UI promete que consegue

**Arquivos:** `backend/app/routers/projects.py:100-102`, `frontend/src/pages/ProjectFormPage.tsx:95-106,203`
**Motivo:** decisão do time (2026-10-27): follow-up, fora deste --fix — muda o contrato do `PUT /projects` (DECISÃO EM ABERTO).
**Problema original:** `exclude_none=True` no backend e campos vazios retirados do payload no formulário fazem "Limpar" não ter efeito.

---

_Fixed: 2026-10-27_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
