---
phase: 10-agp-question-panel-in-taqciti
reviewed: 2026-10-30T15:07:54Z
depth: standard
files_reviewed: 41
files_reviewed_list:
  - CLAUDE.md
  - frontend/src/lib/taqcitiInstall.test.ts
  - frontend/src/lib/taqcitiInstall.ts
  - frontend/src/pages/ExtensionPage.tsx
  - taqciti/manifest.config.ts
  - taqciti/scripts/agp-fake-backend.py
  - taqciti/src/background/agenteAssociation.ts
  - taqciti/src/background/agenteBindFlow.ts
  - taqciti/src/background/agenteBindResume.test.ts
  - taqciti/src/background/agenteBindResume.ts
  - taqciti/src/background/agpBackendSmoke.test.ts
  - taqciti/src/background/agpBrowserSocket.ts
  - taqciti/src/background/agpQuestionsFeed.ts
  - taqciti/src/background/agpQuestionsFeedHold.test.ts
  - taqciti/src/background/agpQuestionsFeedHold.ts
  - taqciti/src/background/agpQuestionsFeedInstance.test.ts
  - taqciti/src/background/agpQuestionsFeedInstance.ts
  - taqciti/src/background/bootstrap.ts
  - taqciti/src/background/browserListeners.ts
  - taqciti/src/background/index.test.ts
  - taqciti/src/background/index.ts
  - taqciti/src/background/meetingEndedInTab.ts
  - taqciti/src/background/meetingEndedTwoTabs.test.ts
  - taqciti/src/background/meetingRoomTabs.ts
  - taqciti/src/background/meetingTabClosed.ts
  - taqciti/src/background/meetingTabNavigated.ts
  - taqciti/src/background/meetingTwoTabs.test.ts
  - taqciti/src/background/messageRouter.ts
  - taqciti/src/content/ui/PanelApp.tsx
  - taqciti/src/features/agente/agpQuestions.ts
  - taqciti/src/features/agente/agpTarget.test.ts
  - taqciti/src/features/agente/agpTarget.ts
  - taqciti/src/features/meeting/machine.ts
  - taqciti/src/manifest.test.ts
  - taqciti/src/shared/config/agpQuestionsStore.test.ts
  - taqciti/src/shared/config/agpQuestionsStore.ts
  - taqciti/src/sidepanel/components/AgpLiveTabs.test.tsx
  - taqciti/src/sidepanel/components/AgpLiveTabs.tsx
  - taqciti/src/sidepanel/components/AgpQuestionsPanel.test.tsx
  - taqciti/src/sidepanel/components/AgpQuestionsPanel.tsx
  - taqciti/src/sidepanel/screens/LiveScreen.tsx
findings:
  critical: 0
  warning: 2
  info: 8
  total: 10
status: issues_found
---

# Fase 10: Relatório de Code Review

**Revisado em:** 2026-10-30
**Profundidade:** standard (com rastreamento das funções chamadas: `GoogleMeetProvider`, `content/controller.ts`, `features/transcription/aggregator.ts`, `agenteSessionFinisher*`, `agenteAssociationService`, `sessionController` e o backend `routers/ws.py` + `services/ws_manager.py`)
**Arquivos revisados:** 41
**Status:** issues_found

## Resumo

Esta é a segunda revisão da fase (a primeira, de 12/10, está no histórico do git no commit `ac1f6b2`). Revisei os 41 arquivos de código, teste, manifesto e documento que os commits de tarefa da fase tocaram depois daquela revisão: o feed do painel AGP (agora separado em `agpQuestionsFeed.ts` e `agpQuestionsFeedHold.ts`), a regra do segurar/retomar (D-11), as regras de duas abas (D-03, D-16, DA-3 e DA-4), a permissão `tabs` (D-04), a recusa do "Continuar envio" durante o encerramento (D-02), a divisão do `index.ts` em `bootstrap.ts`, `browserListeners.ts` e `messageRouter.ts` (D-05), a página de ajuda do web app e a frase do D-07 no `CLAUDE.md`.

**O que melhorou desde a revisão anterior.** Conferi no código atual cada achado de 12/10 e todos foram resolvidos:

| Achado de 12/10 | Situação atual |
|-----------------|----------------|
| CR-01 (`expiresAt` apagado) | Resolvido pela raiz: o `expiresAt` deixou de existir e a expiração vem só do `question_expired` (`agpQuestions.ts:1-8`). |
| CR-02 (nova rodada de encerramento a cada boot) | Resolvido: a DA-5 saiu do boot e passou para `chrome.runtime.onStartup` (`browserListeners.ts:95-99`, `agenteSessionFinisherInstance.ts:164`). |
| WR-01 (backoff zerado no `onopen`) | Resolvido: zera só no `initial_state` (`agpQuestionsFeed.ts:126-128`). |
| WR-02 (corte de 30 descarta fixadas) | Resolvido: `capped` descarta primeiro as não fixadas (`agpQuestions.ts:86-98`). A divergência com o site ficou documentada (D-09). |
| WR-03 (sem teto por campo) | Resolvido: `id` 128, `text` 1000, `block` 64 (`agpQuestions.ts:30-33`). |
| WR-04 (feed ignora `streamingEnabled`/pausa) | Resolvido pelo D-11 (`agpTarget.ts:49-59`, `agpQuestionsFeedHold.ts`). |
| WR-05 ("Continuar envio" sem olhar finish em voo) | Resolvido, com uma janela estreita (ver IN-01). |
| WR-06 (DA-4 cega para `chrome://`) | Resolvido pela permissão `tabs` (`manifest.config.ts:165`). A medição do aviso de instalação continua para o UAT. |
| WR-07 (relógio local) | Resolvido junto com o CR-01. |
| WR-08 (DA-4/DA-5 sem decisão do time) | Fechado pelo CONTEXT (D-03, D-04 e DA-5 por `onStartup`). |
| IN-01 a IN-05 | `isFollowing` saiu; a rejeição do boot ganhou `.catch` (`bootstrap.ts:47-52`); o `index.ts` caiu para 27 linhas; a falha da DA-3/DA-4 com duas abas virou o D-03. |

**Como verifiquei.** Rodei os 11 arquivos de teste da fase (258 testes, todos passando) e o `tsc --noEmit` (sem erro). Comparei o `index.ts` anterior à divisão (`6968bb9^`) com `bootstrap.ts`, `browserListeners.ts` e `messageRouter.ts`: a ordem da cadeia `ready`, o registro síncrono dos listeners e cada `case` de mensagem são idênticos, então o refator realmente não mudou comportamento.

**Conclusão.** Não encontrei nada que quebre a fase (nenhum achado crítico). Há dois pontos que merecem decisão antes de distribuir a Taqciti: uma lacuna das regras de duas abas que a própria pesquisa da fase deixou marcada como "se duplicar, é achado novo" (WR-01), e um texto público do manifesto que diz que a extensão não fala com nenhum backend (WR-02). O restante são ajustes pequenos de robustez e de texto.

Itens aceitos pelo CONTEXT e que NÃO reabri: `/ws/{session_id}` sem autenticação (D-10), backoff, parada no 4004 e ausência de relógio local (D-12), divergência de fixar/descartar no site (D-09) e a frase do D-07 no `CLAUDE.md`, mantida de forma provisória à espera de aprovação humana (plano 10-12). O plano 10-11 (UAT no Chrome real) segue bloqueado a pedido do usuário; por isso nenhum comportamento que dependa do Chrome real foi dado como provado aqui.

## Warnings

### WR-01: com a mesma call aberta em duas abas, a fala entra duas vezes na transcrição (`meet/chunk` de aba não dona não é filtrado)

**Arquivos:** `taqciti/src/background/messageRouter.ts:68-79`, `taqciti/src/content/providers/googleMeet/GoogleMeetProvider.ts:96-98` e `:623`, `taqciti/src/content/controller.ts:138`, `taqciti/src/features/transcription/aggregator.ts:31`
**Problema:** o D-03 e o D-16 fazem a reunião sobreviver quando há duas abas na mesma call, e o `meetingRoomTabs.ts:13` parte do princípio de que a segunda aba também manda `meet/chunk` ("legenda só existe dentro da call"). Só que o roteador despacha todo `meet/chunk` sem olhar de qual aba ele veio:

```ts
case 'meet/chunk':
  noteTabCaptionActivity(sender.tab?.id, getState().session?.meetingCode);
  return dispatch({ type: 'CAPTION_CHUNK', chunk: message.chunk });
```

O agregador junta legendas pelo `captionId`, e o `captionId` leva um prefixo aleatório por carga de página (`instanceTag`, `GoogleMeetProvider.ts:98`). Logo, a mesma fala vista por duas abas gera dois `captionId` diferentes e a máquina cria dois segmentos. A pesquisa da própria fase registrou esse risco como hipótese não analisada: `10-RESEARCH.md:438` (A5) diz "se duplicar, é achado novo". Pela leitura do código, duplica sempre que as duas abas observam as legendas. O mesmo vale, em menor grau, para `meet/participants` e `meet/captions`: uma aba parada na pré-entrada pode sobrescrever `presentNow` ou o `captionsEnabled` da aba dona.

Consequência concreta, quando as duas abas capturam: a transcrição fica com cada fala em dobro, o que vai em dobro para o backend (o dedup do backend é por `chunk_id`, não por conteúdo), polui o diagnóstico e aumenta o gasto de IA. Os testes `meetingTwoTabs.test.ts` e `meetingEndedTwoTabs.test.ts` cobrem o encerramento e a passagem da reunião, mas nenhum cobre a captura com duas abas.

**Confiança:** média. A leitura do código é firme (nenhum filtro por aba, ids diferentes por carga). O que depende do Chrome real é se a segunda aba (por exemplo, o modo "Participar também" do Meet) realmente exibe legendas e portanto emite chunk. Esse é exatamente o tipo de prova que o plano 10-11 (UAT no Chrome real, hoje bloqueado) deveria dar.
**Fix:** só a aba dona alimenta a transcrição, mantendo o reaprendizado da memória das abas (que usa o chunk da aba não dona):

```ts
case 'meet/chunk': {
  const current = getState();
  noteTabCaptionActivity(sender.tab?.id, current.session?.meetingCode); // continua reaprendendo a aba
  const ownerTabId = current.session?.tabId ?? null;
  const fromOtherTab = ownerTabId !== null && sender.tab?.id !== undefined && sender.tab.id !== ownerTabId;
  if (fromOtherTab) return current; // a aba dona é quem alimenta a transcrição
  return dispatch({ type: 'CAPTION_CHUNK', chunk: message.chunk });
}
```

Isto é mudança de comportamento, então pela regra do `CLAUDE.md` é **DECISÃO EM ABERTO** do time (a posse da aba muda a cada `meet/detected` da mesma sala, `machine.ts:211-216`, e a regra precisa conviver com isso). Antes de decidir, vale um teste manual com duas abas reais na mesma call (dentro do UAT do plano 10-11) para confirmar se há duplicação. Deixar um teste de roteador com dois `sender.tab.id` diferentes como semente, em commit separado.

### WR-02: o manifesto diz que a extensão não tem integração com nenhum backend, e o cabeçalho do `index.ts` repete isso

**Arquivos:** `taqciti/manifest.config.ts:26-28` (também `:29` para a versão), `taqciti/src/background/index.ts:9-12`
**Problema:** o `description` do manifesto, que aparece em `chrome://extensions` (e na ficha da loja, se a extensão for publicada), afirma: "histórico 100% local, sem integração com nenhum backend". O nome ainda é "TaqCITi Standalone". Desde a Fase 8 a extensão manda a transcrição ao backend do Agente quando a reunião é vinculada a um cliente, desde a Fase 10 ela abre o `/ws/{session_id}`, e ainda fala com o Google Drive (`document/googleDocs.ts`). O cabeçalho do `index.ts` (linhas 9-12, copiado para o arquivo novo na divisão) diz o mesmo: "Sem envio a nenhum backend ... só transcrição". Para um produto que trata fala de reunião de cliente, uma frase pública que nega o envio de dados é um risco de transparência (LGPD) e de confiança de quem instala, e o time pretende distribuir a extensão pela página `/extension` do web app (Fase 9).
**Fix:** corrigir o texto para refletir o fluxo real e revisar o nome:

```ts
description:
  'Transcrição automática de reuniões do Google Meet. O histórico fica no seu navegador; ' +
  'se você vincular a reunião a um cliente, a transcrição é enviada ao Agente Diagnóstico.',
```

E trocar o comentário do `index.ts` por uma descrição do que o entry point faz hoje (compor `bootstrap`, `browserListeners` e `messageRouter`). O `manifest.test.ts` não confere o `description`, então nada quebra. A troca do nome "Standalone" é decisão do time (aparece para o usuário).

## Info

### IN-01: janela estreita entre a checagem de `isClosing` e o `send-resumed` no "Continuar envio"

**Arquivo:** `taqciti/src/background/agenteBindResume.ts:59` e `:69`
**Problema:** a recusa por encerramento em voo (D-02) é checada na linha 59, mas depois vêm duas leituras assíncronas (`getRecord` e `loadConfig`, linhas 61 e 64) antes de o `send-resumed` limpar `finishBy`, `finishTries` e `finishGaveUp` (linha 69). Se um alarme iniciar o `closeSession` dentro dessa janela (milissegundos), o encerramento em voo perde as marcas e o caso do WR-05 volta, só que muito mais raro.
**Fix:** conferir `deps.isClosing?.(meetingId)` de novo imediatamente antes de `applyAssociationEvent(... 'send-resumed')`, ou fazer o próprio evento recusar quando houver finish em voo. Um teste que dispara o `isClosing` entre as duas leituras fecha o caso.

### IN-02: falha ao abrir o WebSocket aparece como "sessão não ativa" e nunca tenta de novo

**Arquivo:** `taqciti/src/background/agpQuestionsFeed.ts:108-114`
**Problema:** se `deps.openSocket` lançar, o feed publica `idle` e retorna sem agendar nada, e o `following` continua apontando para o alvo. O painel então mostra "A sessão do Agente não está ativa", que é a mensagem do 4004, e o mesmo alvo nunca é tentado de novo (`sameTarget` retorna cedo em `run`). Como a URL já passa por `buildAgpSocketUrl`, isso é raro, mas a mensagem engana e não há saída até o alvo mudar.
**Fix:** tratar a falha como queda de conexão (`scheduleReconnect(current)`) em vez de `idle`, ou ao menos publicar `reconnecting` e agendar a nova tentativa.

### IN-03: comentários ainda apontam para o `index.ts` depois da divisão (D-05)

**Arquivos:** `taqciti/src/background/agenteAssociation.ts:3` e `:74`, `taqciti/src/background/meetingTabClosed.ts:4`, `taqciti/src/background/meetingTabNavigated.ts:9` (e, fora desta lista, `agenteFreshStart.ts:9` e `agenteSessionFinisher.ts:7`, `:54`, `:71`)
**Problema:** os comentários dizem que quem chama é "o `index.ts`" ou "o `chrome.tabs.onUpdated` do `index.ts`". Desde o 10-08 esses pontos moram em `messageRouter.ts` (mensagens) e `browserListeners.ts` (abas, alarmes), e o `index.ts` só compõe. Quem seguir o comentário procura no arquivo errado.
**Fix:** trocar a referência por `messageRouter.ts` ou `browserListeners.ts`, conforme o caso. Comentário apenas, pode ir num commit `docs`.

### IN-04: as notas da aba AGP aparecem numeradas como se fossem passos

**Arquivos:** `frontend/src/pages/ExtensionPage.tsx:73`, `frontend/src/lib/taqcitiInstall.ts:52-58`, `frontend/src/components/extension/StepList.tsx`
**Problema:** o `StepList` desenha uma bolha com o número 1, 2, 3... ao lado de cada item. As cinco notas da aba AGP ("a aba só mostra as perguntas", "fixar no site não tira o cartão" etc.) são explicações, não uma sequência, e passam a ideia de que há uma ordem a seguir.
**Fix:** usar uma lista simples (sem número) para essas notas, por exemplo um `NoteList` ou `<ul>`, mantendo o `StepList` só para instalação e vínculo.

### IN-05: o `CLAUDE.md` diz que a Taqciti "fala apenas com o backend v2"

**Arquivo:** `CLAUDE.md:838`
**Problema:** a frase reescrita neste plano afirma que a Taqciti fala apenas com o backend v2, mas a extensão também usa a API do Google Drive/Docs (`taqciti/src/document/googleDocs.ts`, escopo `drive.file` no manifesto). O contexto da frase é "não fala com `diagnostico/`", e nesse sentido ela está certa; o "apenas" é que ficou largo demais. A frase nova do D-07 (linha 843) está correta e continua provisória, como combinado.
**Fix:** trocar por "fala com o backend v2 (e com o Google Drive, para a ata) e nunca com `diagnostico/`", ou simplesmente remover o "apenas".

### IN-06: `agp-fake-backend.py` cita o nome errado do arquivo e sobe o servidor ao ser importado

**Arquivo:** `taqciti/scripts/agp-fake-backend.py:2` e `:39`
**Problema:** o texto de uso diz `python agp_fake_backend.py PORT`, mas o arquivo se chama `agp-fake-backend.py` (hífen). Além disso, `uvicorn.run(...)` roda no nível do módulo, sem `if __name__ == "__main__":`, então qualquer ferramenta que importe ou colete o arquivo sobe um servidor e trava.
**Fix:** corrigir a docstring e envolver o final em `if __name__ == "__main__":`. É script de teste local (127.0.0.1), sem risco de segurança.

### IN-07: no teste de fumaça, `stopServer` pode travar se o processo já tiver saído

**Arquivo:** `taqciti/src/background/agpBackendSmoke.test.ts:29-35` (e `:26`)
**Problema:** `stopServer` espera o evento `exit` do processo, mas se o Python caiu sozinho (dependência faltando, porta ocupada) o evento já passou e a promessa nunca resolve; o `beforeEach` e o `afterAll` estouram o prazo e escondem o erro real. O `stdio: 'ignore'` do `spawn` também apaga a mensagem de erro do Python.
**Fix:** checar `p.exitCode !== null` antes de esperar o `exit`, e deixar o `stderr` visível (por exemplo, `stdio: ['ignore', 'ignore', 'inherit']`). O teste é opt-in e não afeta a suíte normal.

### IN-08: a versão do manifesto continua 2.1.2 mesmo com permissão e recurso novos

**Arquivo:** `taqciti/manifest.config.ts:29` (e `taqciti/package.json:3`)
**Problema:** a fase adiciona a permissão `tabs` e a aba AGP, mas a versão não mudou. O próprio D-04 marca a reversibilidade como "costly" justamente porque o Chrome desativa a extensão de quem já a tem até a nova permissão ser aceita; isso só acontece numa atualização, e uma atualização só é oferecida se a versão subir. Para quem já instalou uma 2.1.2 (build sem `tabs`), nada distingue as duas builds.
**Fix:** subir a versão (por exemplo, 2.2.0) no commit de publicação. Não há pressa enquanto a distribuição não foi definida; registrar como item da publicação.

---

_Revisado em: 2026-10-30_
_Revisor: Claude (gsd-code-reviewer)_
_Profundidade: standard_
