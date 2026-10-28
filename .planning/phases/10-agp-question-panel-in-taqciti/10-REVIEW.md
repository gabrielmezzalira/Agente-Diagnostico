---
phase: 10-agp-question-panel-in-taqciti
reviewed: 2026-10-12T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - taqciti/src/background/meetingTabNavigated.ts
  - taqciti/src/background/agenteSessionFinisherInstance.ts
  - taqciti/src/features/agente/associationClose.ts
  - taqciti/src/features/agente/associationSend.ts
  - taqciti/src/features/agente/association.ts
  - taqciti/src/features/agente/agpQuestions.ts
  - taqciti/src/features/agente/agpTarget.ts
  - taqciti/src/shared/config/agpQuestionsStore.ts
  - taqciti/src/shared/config/agenteRoutes.ts
  - taqciti/src/background/agpQuestionsFeed.ts
  - taqciti/src/background/agpQuestionsFeedInstance.ts
  - taqciti/src/background/index.ts
findings:
  critical: 2
  warning: 8
  info: 5
  total: 15
status: issues_found
---

# Fase 10: Relatório de Code Review

**Revisado em:** 2026-10-12
**Profundidade:** standard (com rastreamento das funções chamadas: `sessionController`, `agenteAssociationLifecycle`, `finishPolicy`, `httpSessionGateway`, `agenteBindResume`, `agenteConfigStore`, `content/index.ts`, `GoogleMeetProvider`, `manifest.config.ts` e o backend `routers/ws.py` + `services/pipeline.py`)
**Arquivos revisados:** 12
**Status:** issues_found

## Resumo

Revisei as mudanças de back-end da extensão: DA-4 (aba da reunião que navega para outro lugar), DA-5 (rodada nova de encerramento no boot), o "Continuar envio" limpando `finishGaveUp` e o feed do painel AGP (parse com lista branca, alvo, store, URL do WebSocket, dono do socket e composição).

Há dois problemas que bloqueiam o merge:

1. **O `expiresAt` das perguntas se perde em TODA gravação no storage.** O `normalizeAgpFeed` passa a pergunta já convertida de novo pelo `toAgpQuestion`, que lê `expires_at` (snake_case), mas a pergunta já está em `expiresAt` (camelCase). Reproduzi isso executando o código real: uma pergunta com `expires_at: '2026-10-12T20:00:30+00:00'` sai do parse com `expiresAt` preenchido e é gravada com `expiresAt: null`. A expiração local ("backup do `question_expired`") nunca funciona. Os testes não pegam porque todas as fixtures do store usam `expiresAt: null`, e o teste do painel injeta `expiresAt` direto no componente, sem passar pelo store.
2. **A DA-5 desfaz a proteção T-08-49.** A premissa "no máximo uma rodada por boot, então não há laço" é falsa no MV3: o service worker morre depois de 30 s ocioso e acorda a cada carregamento de página (o content script de `<all_urls>` manda `panel/mounted`, e agora também há o `tabs.onUpdated`). Cada boot zera `finishTries`/`finishGaveUp` e, como `finishBy` já venceu, chama o `POST /finish` na hora. Com uma recusa definitiva (401/403, por exemplo depois de trocar a chave), isso vira uma chamada ao backend por associação a cada boot, para sempre. Com o backend fora do ar, a escada de 11 tentativas recomeça a cada boot, sem teto nenhum.

Além disso, encontrei problemas de robustez no feed: o backoff zera no `onopen`, o que gera um laço de 1 Hz quando o servidor aceita e depois fecha; a lista não reflete pin/dismiss/use feitos no web e o corte de 30 descarta primeiro as fixadas; não há limite de tamanho por campo; e o feed ignora `streamingEnabled`, além de abrir o WebSocket com a reunião pausada. Também há um caso que a DA-4 não cobre (navegar para `chrome://`, inclusive com o botão Voltar para a Nova Guia) e uma corrida entre o "Continuar envio" e um finish em voo.

## Critical Issues

### CR-01: `expiresAt` é apagado em toda gravação e leitura do feed AGP (a expiração local nunca funciona)

**Arquivos:** `taqciti/src/shared/config/agpQuestionsStore.ts:35`, `:44-46`; `taqciti/src/features/agente/agpQuestions.ts:37`, `:47`
**Problema:** `writeAgpFeed(feed)` grava `normalizeAgpFeed(feed)`, e `normalizeAgpFeed` remapeia cada item com `toAgpQuestion`. Só que `toAgpQuestion` foi feito para o payload CRU do backend: ele desestrutura `expires_at: expiresAt`. O objeto que chega ao store já é um `AgpQuestion` (`expiresAt`, camelCase), então `raw.expires_at` é `undefined` e o resultado é `expiresAt: null`. O mesmo vale para a leitura (`loadAgpFeed`/`subscribeAgpFeed`).

Saída real, executada com esbuild sobre o código do repositório:
```
parsed {"kind":"new","question":{..., "expiresAt":"2026-10-12T20:00:30+00:00"}}
after normalize (store write) {..., "expiresAt":null}
```
Consequências concretas:
- `isAgpQuestionVisible` sempre devolve `true` para a pergunta `queued`, porque `expiresAt === null`. O "backup do `question_expired`" documentado em `agpQuestions.ts:98` é código morto.
- Com o socket em `reconnecting` (backend reiniciando ou rede caída), as perguntas que já venceram continuam aparecendo como se estivessem valendo.
- Uma pergunta descartada ou usada no app web nunca recebe `question_expired` (o backend só expira `queued` e não transmite pin/dismiss/use; ver WR-02). Na Taqciti, ela fica na tela para sempre (até reconectar).
- Qualquer barra de TTL que o painel venha a desenhar a partir do store vai ler sempre `null`.

Os testes passam porque todas as fixtures de `agpQuestionsStore.test.ts` e `AgpQuestionsPanel.test.tsx` usam `expiresAt: null` ou injetam `expiresAt` direto no componente, sem fazer a ida e volta pelo store.
**Correção:** separe o parse do payload do backend da validação do valor salvo, e cubra com um teste de ida e volta (`parse -> write -> load`) usando `expires_at` não nulo.
```ts
// agpQuestions.ts — validador do formato JÁ normalizado (camelCase)
export function toStoredAgpQuestion(raw: unknown): AgpQuestion | null {
  if (!isRecord(raw)) return null;
  return toAgpQuestion({ ...raw, expires_at: raw.expiresAt });
}
// agpQuestionsStore.ts:35
const questions = list.map(toStoredAgpQuestion).filter((q): q is AgpQuestion => q !== null);
```

### CR-02: DA-5 recomeça a rodada de encerramento a CADA boot do service worker e gera chamadas ao backend sem limite (T-08-49 quebrado)

**Arquivos:** `taqciti/src/background/agenteSessionFinisherInstance.ts:141-153`, `:102-104`; `taqciti/src/features/agente/associationClose.ts:37-59`; `taqciti/src/background/index.ts:59`, `:122-126`
**Problema:** o comentário diz "no máximo uma por inicialização, então não há laço (T-08-49)". No MV3, porém, "inicialização" não é rara: o worker termina depois de cerca de 30 s ocioso e renasce com qualquer evento registrado. Pelo menos três fontes disparam esse renascimento:
- `content/index.ts:63` manda `panel/mounted` a cada página carregada, em qualquer aba (`content_scripts: <all_urls>`);
- o novo `chrome.tabs.onUpdated` (`index.ts:122`) acorda o worker a cada mudança de status/URL de qualquer aba;
- os próprios alarmes do encerramento.

Na prática, são dezenas a centenas de boots por dia. Em cada um, `rescheduleAfterRestart` faz o seguinte:
1. `canRestartFinishRound` é verdadeiro para toda associação `picker` com `finishGaveUp`, sem nenhuma condição de tempo ou de contagem;
2. `finish-round-restarted` apaga `finishTries` e `finishGaveUp`, mas mantém `finishBy` (já vencido);
3. `evaluate` -> `run` -> `deps.now() >= finishBy` -> `closeSession` -> `POST /webhook/extension/sessions/{id}/finish` **imediatamente**.

Cenário 1, recusa definitiva: a chave `x-agente-key` foi trocada no Railway e a da extensão ficou velha. Resultado: 403 -> `definitive` -> desiste na 1ª falha. No próximo carregamento de página depois de 30 s ocioso, o ciclo se repete, numa chamada por associação desistida a cada boot, para sempre. As associações nunca são removidas sozinhas.

Cenário 2, backend fora (5xx/rede): a escada de 30 s, 1 min, 2 min... recomeça do zero a cada boot. E como `run` trata `finishTries > 0` como "decidido" e chama `closeSession` na hora (linha 102-104), cada boot no meio da escada também ignora o backoff. Antes da DA-5 esse atalho era limitado pelas 11 tentativas; agora não tem mais limite.

Isso é exatamente o laço que o T-08-49 proíbe. A decisão DA-5 ainda está marcada como "a confirmar com o time" (`.planning/PENDENCIAS-FASE-08.md:34`).
**Correção:** persista o controle de rodadas na associação e limite por tempo e por quantidade. Outra opção é ligar a rodada nova ao `chrome.runtime.onStartup` (abertura do navegador), não ao boot do worker.
```ts
// association.ts
finishRounds?: number;        // rodadas já recomeçadas
finishRoundAt?: number;       // epoch ms do último recomeço
// associationClose.ts
export function canRestartFinishRound(a: MeetingAssociation, now: number): boolean {
  return a.origin === 'picker' && a.finishGaveUp === true && a.sessionId !== undefined &&
    a.sessionFinished !== true && CLOSABLE_STATES.includes(a.state) &&
    (a.finishRounds ?? 0) < MAX_FINISH_ROUNDS &&               // ex.: 3
    now - (a.finishRoundAt ?? 0) >= FINISH_ROUND_MIN_GAP_MS;   // ex.: 24 h
}
```
Além disso, `run` deveria respeitar o alarme de backoff no boot, em vez de chamar `closeSession` só porque `finishTries > 0`. Por exemplo: gravar `nextFinishAt` e só tentar quando `now >= nextFinishAt`. Adicione um teste que simule N boots seguidos e confira que `finishSession` é chamado no máximo K vezes.

## Warnings

### WR-01: o backoff de reconexão zera no `onopen`, mas o backend aceita a conexão antes de validar, o que gera um laço de 1 Hz

**Arquivo:** `taqciti/src/background/agpQuestionsFeed.ts:109-113`, `:123-132`, `:88-96`
**Problema:** em `backend/app/routers/ws.py`, `ws_manager.connect` faz `ws.accept()` **antes** de `pipeline_manager.get_or_create`. Qualquer exceção depois do accept (Supabase instável em `_build_pipeline`, falha no `json.dumps` do `initial_state`, `pipeline.start()`) fecha com 1011/1006 **depois** de o cliente ter recebido `onopen`. O `onopen` zera `attempt = 0`, então a próxima espera volta a ser de 1 s, e isso se repete indefinidamente, a 1 Hz, enquanto a reunião estiver ao vivo. Cada tentativa refaz consultas ao Supabase. Se a falha vier depois das chamadas de LLM de `_build_pipeline` (`infer_project_type`, `extract_structured_context`), cada tentativa também gasta Gemini. Efeito colateral visível: no 4004 o painel pisca `live` antes de virar `idle`.
**Correção:** só zere o backoff depois de uma mensagem válida (por exemplo, o `initial_state`) ou depois de a conexão ficar estável por X segundos. Também vale pôr um teto de tentativas consecutivas sem `initial_state`.
```ts
socket.onopen = () => { if (isCurrent()) publish(current.target.sessionId, 'connecting', current.questions); };
socket.onmessage = (event) => {
  ...
  if (message.kind === 'initial') current.attempt = 0; // só agora a conexão "pegou"
```

### WR-02: a lista não reflete pin/dismiss/use feitos no app web, e o corte de 30 descarta primeiro as fixadas

**Arquivo:** `taqciti/src/features/agente/agpQuestions.ts:78-96`
**Problema:** o backend (`ws.py`) atualiza o status em `pin_question`/`dismiss_question`/`use_question`, mas **não transmite nenhum evento**, e `_expire_due_questions` só expira `queued`. Na Taqciti, isso tem três efeitos:
- a pergunta descartada ou usada no web continua na lista (para sempre, por causa da CR-01);
- a pergunta fixada no web continua `queued` na Taqciti e, quando a CR-01 for corrigida, vai **sumir** no TTL mesmo estando fixada no web;
- os itens que nunca saem acumulam. `capped` mantém os **últimos** 30 (`slice(list.length - 30)`), e as fixadas pré-mapeadas vêm na frente do `initial_state`. Numa reunião longa, as primeiras a serem descartadas são justamente as fixadas, que "nunca vencem".
**Correção:** no corte, preserve as `pinned` e descarte primeiro as `queued` mais antigas. Registre como pendência de contrato com o backend um evento `question_status` (ou reaproveitar `question_expired` para dismiss/use). Essa mudança de contrato é decisão do time.
```ts
function capped(list: AgpQuestion[]): AgpQuestion[] {
  if (list.length <= AGP_MAX_QUESTIONS) return list;
  const pinned = list.filter((q) => q.status === 'pinned');
  const queued = list.filter((q) => q.status !== 'pinned');
  return [...pinned, ...queued].slice(-AGP_MAX_QUESTIONS); // ou cortar só dentro de `queued`
}
```

### WR-03: lista branca sem limite de tamanho por campo; o storage.local é compartilhado com histórico e outbox

**Arquivo:** `taqciti/src/features/agente/agpQuestions.ts:35-49`
**Problema:** o comentário de `AGP_MAX_QUESTIONS` diz que "um backend com defeito não pode lotar o storage", mas só a **quantidade** é limitada. `text`, `block`, `id` e `expiresAt` aceitam strings de qualquer tamanho. A URL do backend é configurável pelo usuário e o texto vem de LLM. Trinta itens enormes podem estourar a cota de 10 MB do `chrome.storage.local` (sem `unlimitedStorage`), que é a mesma onde ficam o histórico de reuniões, a outbox e as associações. As gravações delas passariam a falhar, com risco de perder transcrição. Além disso, cada gravação reescreve o feed inteiro e dispara `onChanged` em todas as abas (o painel está em `<all_urls>`).
**Correção:** limite cada campo na lista branca, por exemplo `text` <= 1000 caracteres (truncar), `block` <= 40, `id` <= 64 e `expiresAt` <= 40, descartando o item se `id` passar do limite. Adicione um teste com um `text` de 1 MB.

### WR-04: o feed ignora `streamingEnabled` e abre o WebSocket em `paused`/`captionsRequired`, recriando o pipeline (custo de Gemini)

**Arquivos:** `taqciti/src/background/agpQuestionsFeedInstance.ts:23-30`; `taqciti/src/features/agente/agpTarget.ts:17-27`
**Problema:**
1. O `selectTarget` não consulta `config.streamingEnabled`. Se o usuário desliga a integração no meio da call, a associação continua `linked` e a Taqciti mantém o WebSocket aberto com o backend, o que contraria o D-09 ("custo zero para quem deixa o streaming desligado").
2. `isLivePhase` inclui `paused` e `captionsRequired`. Conectar em `/ws/{id}` chama `pipeline_manager.get_or_create`. Depois de um redeploy do backend, a reconexão recria o pipeline mesmo com a captura pausada. O pipeline restaurado tem `transcript_chunks` vindos do banco, e então `_red_flag_task` (15 s) e `_coverage_task` (30 s) chamam o Gemini sobre texto que não mudou, enquanto a reunião ficar pausada. Antes da Fase 10, o pipeline só renascia quando chegava fala.
**Correção:** em `selectTarget`, devolver `null` quando `!config.streamingEnabled`, e decidir com o time se `paused`/`captionsRequired` devem manter o WebSocket (sugestão: só `recording`). Se a decisão for manter, registrar o custo como aceito.

### WR-05: o "Continuar envio" limpa as marcas de encerramento sem conferir se há um finish em voo

**Arquivo:** `taqciti/src/features/agente/associationSend.ts:34-42` (chamado por `background/agenteBindResume.ts:54`)
**Problema:** `resumeStoppedSend` apaga `finishBy`, `finishTries` e `finishGaveUp`, e `prepareResume` não consulta `agenteSessionFinisher.isClosing(meetingId)`. Sequência: `closeSession` está em voo (até 10 s de timeout) -> o usuário clica "Continuar envio" -> a associação vai para `sending` sem marcas -> o finish responde 200 -> `session-finished` -> `markFinished` grava `sessionFinished: true` na associação `sending` -> o upload retomado continua mandando partes para uma sessão já encerrada (rejeitadas ou ignoradas pelo backend). Com a CR-02 multiplicando as tentativas de finish a cada boot, essa janela fica bem mais frequente.
**Correção:** em `prepareResume`, recusar com `invalid-state` quando `isClosing(meetingId)`. Também vale recusar quando `association.sessionFinished === true`, mostrando o aviso da DA-2 em vez de reenviar para uma sessão fechada.

### WR-06: a DA-4 não dispara quando a aba vai para `chrome://`, `file://`, `about:` ou `data:` (incluindo o Voltar para a Nova Guia)

**Arquivos:** `taqciti/src/background/index.ts:122-126`; `taqciti/src/background/meetingTabNavigated.ts:40-51`
**Problema:** o manifesto não tem a permissão `tabs`, só `host_permissions: ['<all_urls>']`. O Chrome só preenche `changeInfo.url` quando a URL de destino casa com uma host permission. `<all_urls>` não cobre `chrome://` e `file://` sem a opção do usuário. Cenário comum: abrir uma Nova Guia, digitar o link do Meet, entrar na call e apertar Voltar (Alt+←). A aba vai para `chrome://new-tab-page/`, `changeInfo.url` vem `undefined`, a linha 123 retorna e a reunião fica "ao vivo". O encerramento nunca é agendado, e esse é justamente o custo que a DA-4 queria evitar.
**Correção:** tratar também `changeInfo.status === 'loading'` na aba da reunião quando `tab.url` não é visível (navegou para uma origem sem permissão), considerando como "saiu":
```ts
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = changeInfo.url ?? (changeInfo.status === 'loading' && tab.url === undefined ? '' : undefined);
  if (url === undefined) return;
  void ready.then(() => onMeetingTabNavigated(tabId, url, { getState, dispatch, now: Date.now }));
});
```
`isStillInMeetingRoom('')` já devolve `false`. Adicione um teste para esse caminho.

### WR-07: a expiração local compara o `expires_at` do servidor com o relógio do cliente (latente; ativa ao corrigir a CR-01)

**Arquivo:** `taqciti/src/features/agente/agpQuestions.ts:99-103`
**Problema:** o TTL padrão é 30 s (`question_ttl_seconds`). Um relógio local adiantado em mais de 30 s (VM, máquina sem NTP) esconde **toda** pergunta nova no instante em que ela chega. Enquanto o socket está ao vivo, o backend já manda `question_expired` a cada 1 s, então o backup só adiciona risco.
**Correção:** só aplicar o filtro local quando `connection !== 'live'`, ou guardar o deslocamento (`receivedAt - Date.parse(generated_at)`) na chegada e comparar com o relógio local corrigido por ele.

### WR-08: DA-4 e DA-5 entraram como código antes da decisão do time, numa branch de outra fase

**Arquivos:** `taqciti/src/background/meetingTabNavigated.ts:2-3`; `taqciti/src/features/agente/associationClose.ts:37-41`
**Problema:** os próprios cabeçalhos dizem "a confirmar com o time", e `.planning/PENDENCIAS-FASE-08.md:34` lista DA-4 e DA-5 como **DECISÃO EM ABERTO**. O CLAUDE.md manda parar até o time decidir. Além disso, os commits `566a005` (DA-4), `32c029b` (DA-5) e `a717b64` (fase 8) estão na branch `feat/fase-10-agp-question-panel`, que foi cortada da `feat/fase-08-...` ainda não mergeada, e não da `main`. Isso viola as regras 2, 3 e 5 do fluxo de branch por fase. A CR-02 mostra o risco concreto: a opção "recomendada" foi implementada sem a revisão que pegaria o laço.
**Correção:** levar DA-4/DA-5 de volta à branch da fase 8, confirmar as duas decisões com o time e só então mergear. Se o time ainda não tiver decidido, deixar a DA-5 atrás de uma flag desligada.

## Info

### IN-01: `isFollowing` exportado e sem uso em produção

**Arquivo:** `taqciti/src/background/agpQuestionsFeed.ts:164`
**Problema:** nenhum módulo fora dos testes usa esse export. É API pública desnecessária (princípio I do SOLID).
**Correção:** remover ou marcar como seam de teste.

### IN-02: o comentário de `restartFinishRound` está impreciso

**Arquivo:** `taqciti/src/features/agente/associationClose.ts:52`
**Problema:** o comentário diz "o `finishBy` (já vencido) fica". Mas a desistência pode acontecer sem `finishBy` (fila esvaziou -> `closeSession` direto -> recusa definitiva) ou com `finishBy` ainda no futuro. Nesses casos a rodada nova passa de novo pela espera da fila (até 10 s) e não "encerra sem esperar".
**Correção:** ajustar o comentário para os três casos.

### IN-03: rejeição não tratada em `rescheduleAfterRestart`

**Arquivos:** `taqciti/src/background/agenteSessionFinisherInstance.ts:142`; `taqciti/src/background/index.ts:59`
**Problema:** se `loadAssociations()` rejeitar, a rejeição escapa do `try` (que só envolve o laço) e o `void` na cadeia do `ready` a transforma em "Uncaught (in promise)" no service worker.
**Correção:** `void agenteSessionFinisher.rescheduleAfterRestart().catch((e) => logger.error(...))`.

### IN-04: `index.ts` passou de 200 linhas

**Arquivo:** `taqciti/src/background/index.ts` (265 linhas)
**Problema:** a regra do CLAUDE.md ("um arquivo, uma responsabilidade; >200 linhas é sinal") é violada. Os listeners de abas (onRemoved/onUpdated) poderiam morar num `tabListeners.ts`.
**Correção:** extrair o registro dos listeners de aba e de alarmes.

### IN-05: falso positivo da DA-3/DA-4 com "Participar também" (duas abas na mesma call)

**Arquivo:** `taqciti/src/background/meetingTabNavigated.ts:47`
**Problema:** `MEETING_DETECTED` da mesma sala atualiza `session.tabId` para a última aba que detectou (`machine.ts`, ramo "mesma sala ativa"). Se o usuário entra na mesma call numa segunda aba ("Participar também", para apresentar) e depois navega essa segunda aba para outro site, a reunião é encerrada, embora a primeira aba continue na call. A captura dela é perdida e o encerramento da sessão do Agente é agendado. O padrão já existia na DA-3; a DA-4 adiciona mais um gatilho.
**Correção:** registrar como limitação conhecida, ou guardar o conjunto de abas da sala e só encerrar quando a última sair.

---

_Revisado em: 2026-10-12_
_Revisor: Claude (gsd-code-reviewer)_
_Profundidade: standard_
