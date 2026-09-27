---
phase: 07-taqciti-config-background-streamer
reviewed: 2026-09-26T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - taqciti/docs/publicar-release.md
  - taqciti/src/background/agenteStreamer.test.ts
  - taqciti/src/background/agenteStreamer.ts
  - taqciti/src/background/sessionController.ts
  - taqciti/src/features/agente/phraseBatcher.test.ts
  - taqciti/src/features/agente/phraseBatcher.ts
  - taqciti/src/features/agente/wordDelta.test.ts
  - taqciti/src/features/agente/wordDelta.ts
  - taqciti/src/shared/config/agenteConfig.test.ts
  - taqciti/src/shared/config/agenteConfig.ts
  - taqciti/src/shared/config/agenteConfigStore.test.ts
  - taqciti/src/shared/config/agenteConfigStore.ts
  - taqciti/src/shared/config/constants.ts
  - taqciti/src/shared/hooks/useAgenteConfigForm.ts
  - taqciti/src/sidepanel/App.tsx
  - taqciti/src/sidepanel/route.test.ts
  - taqciti/src/sidepanel/route.ts
  - taqciti/src/sidepanel/screens/AgenteConfigScreen.test.tsx
  - taqciti/src/sidepanel/screens/AgenteConfigScreen.tsx
  - taqciti/src/sidepanel/screens/HomeScreen.tsx
findings:
  critical: 1
  warning: 12
  info: 11
  total: 24
status: issues_found
---

# Fase 7: Relatório de Code Review

**Revisado em:** 2026-09-26
**Profundidade:** standard
**Arquivos revisados:** 20 (18 da revisão anterior + 2 novos do plano 07-04)
**Status:** issues_found

## Resumo

Este relatório é o estado **completo** da fase. Ele junta a revisão original dos 18 arquivos com uma
re-revisão incremental dos 6 arquivos que o plano 07-04 (janela de envio por fala, G-07-1/G-07-2) mudou
desde `e4d8fd0`: `phraseBatcher.ts` (novo), `phraseBatcher.test.ts` (novo), `agenteStreamer.ts`,
`agenteStreamer.test.ts`, `wordDelta.test.ts` e `agenteConfig.ts`.

**Sobre o 07-04.** O módulo puro `phraseBatcher.ts` está bem feito: não muta nada, respeita a ordem,
isola por `(sessionId, segmentKey)` e tem testes unitários de verdade. Tracei as combinações de timer e
flush dentro da fila serializada e **não encontrei palavra duplicada**. Também só existe um timer vivo
por instância enquanto ela não é descartada, e nenhum log expõe texto, `session_id` ou chave (o `logger`
sanitiza). Os problemas novos estão nas bordas:

- **D-09 não é reativo.** O streamer só descobre que o toggle foi desligado no próximo passo ou tick. Se
  alguém desligar e religar dentro da janela, e ninguém falar nesse meio-tempo, a fala que estava
  pendente é enviada. Isso contradiz o "MUST NOT" do próprio plano (WR-11).
- **Se o `loadConfig` falhar no tick, a fala fica sem timer** e só sai quando alguém voltar a falar
  (WR-12).
- **`dispose()` não é terminal.** Um passo que já estava na fila da instância antiga continua rodando,
  rearma timer e envia com as deps antigas. O comentário "nenhum timer órfão" não é verdade (WR-13).
- **Vários testes novos passam por construção.** O "drain" dos testes é um passo real, com efeito
  colateral (zera o cursor, faz `flushAll`, envia). Um teste depende desse efeito para passar, e os
  testes de fim/pausa passariam mesmo se o `sessionController` não chamasse o streamer (WR-10).

Os achados antigos **WR-01** e **WR-02** continuam valendo e ficaram mais pesados: agora uma falha de
envio ou um reinício do service worker perde até 5 s de fala de uma vez (o teto da janela), e não mais
só um flush de 250 ms. O **WR-09** foi resolvido pelo 07-04 (ver abaixo).

Continuam abertos, sem mudança, os achados dos arquivos que o 07-04 não tocou: CR-01 (reunião nova com o
mesmo session_id trava em silêncio), WR-03 a WR-06, WR-08 e IN-01 a IN-06.

### Resolvidos desde a revisão anterior

- **WR-09** (asserções de ausência com `vi.waitFor(() => expect(true).toBe(true))`): resolvido. O padrão
  sumiu de `agenteStreamer.test.ts`, e as asserções de ausência agora fazem `await` de um passo
  enfileirado, que de fato espera a fila serializada terminar. O drain novo, porém, tem efeito colateral.
  Esse é um problema diferente, registrado como WR-10.

## Critical Issues

### CR-01: Reunião nova com o mesmo session_id trava o streaming em silêncio, enquanto a UI diz "Ligado"

**Arquivos:** `taqciti/src/features/agente/wordDelta.ts:115-118`, `taqciti/src/sidepanel/screens/AgenteConfigScreen.tsx:19`, `taqciti/src/shared/config/agenteConfig.ts:131-142`

**Problema:** Quando `prev.meetingId !== session.meetingId` e `binding.sessionId === prev.sessionId`, `planStreamStep` devolve `{ cursor: prev, deltas: [] }` **para sempre**. O cursor continua preso na reunião antiga, e todo flush seguinte cai no mesmo ramo. Esse caso aparece em situações bem reais:

- A pessoa volta para a mesma sala depois da janela de `REJOIN_RESUME_WINDOW_MS` (10 min). A máquina cria um `meetingId` novo, mas a sessão do Agente continua ativa e é a mesma.
- A pessoa cola o ID novo ainda durante o fim da reunião anterior. O ramo da linha 122-123 "migra" o cursor da reunião antiga para o ID novo, e quando a reunião nova começa cai de novo no ramo de espera.

Nos dois casos:

1. `getStreamingReadiness` só olha a config, então a tela mostra `ready` → "Ligado — a transcrição ao vivo está sendo enviada ao Agente." Nada é enviado, e nenhum log ou aviso aparece.
2. Salvar o mesmo UUID de novo não destrava, porque o binding não muda. A única saída é desligar o toggle, **esperar um flush acontecer** (alguém falar) e religar. Isso não está documentado em lugar nenhum.
3. A garantia "nada vai para a sessão da reunião anterior" nem sempre vale: se o service worker reiniciar (coisa comum no MV3), `cursor` volta a `null` e a linha 112-113 faz prime da reunião nova direto no session_id antigo. O resultado depende de um detalhe de ciclo de vida que ninguém controla.

Na prática, a transcrição da reunião é perdida sem nenhum aviso, e a tela afirma o contrário.

(Re-verificado depois do 07-04: `wordDelta.ts` não mudou e o ramo de espera continua igual. A janela por fala não altera nada aqui, porque `result.deltas` continua vazio nesse ramo, e o buffer só esvazia o que já estava pendente da reunião anterior.)

**Correção:** Decida explicitamente (DECISÃO EM ABERTO do time) entre dois caminhos. (a) Fazer prime da reunião nova no mesmo session_id, como já acontece depois de um reinício do service worker, o que dá comportamento determinístico. (b) Manter a espera, mas mostrar isso na tela. Em qualquer dos dois, o status não pode dizer "sendo enviada" quando o streamer está esperando. Exemplo de (b):

```ts
// wordDelta.ts — sinalizar o estado de espera
export interface StreamStep {
  cursor: StreamCursor | null;
  deltas: SegmentDelta[];
  waitingForNewSession?: boolean;
}
// ...
if (prev.meetingId !== session.meetingId) {
  if (binding.sessionId === prev.sessionId) {
    return { cursor: prev, deltas: [], waitingForNewSession: true };
  }
  return { cursor: primeCursor(session, binding.sessionId), deltas: [] };
}
```

Depois, `agenteStreamer.ts` grava um status de runtime (por exemplo `taq:agenteStatus` em `chrome.storage.session`) que a tela lê para mostrar "Reunião nova detectada — salve o ID da sessão nova do Agente". Além disso, deixe o salvar (mesmo com o mesmo UUID) liberar a espera, por exemplo gravando um `bindingNonce`/`savedAt` que entre no `StreamBinding`.

## Warnings

### WR-01: O cursor avança antes do envio ser confirmado: falha de rede perde palavras de vez (agora até 5 s de fala), e a ordem de chegada não é garantida

**Arquivo:** `taqciti/src/background/agenteStreamer.ts:76-93, 119-124, 133`

**Problema:** Continua valendo depois do 07-04, e ficou mais grave. `cursor = result.cursor` (linha 133) conta as palavras como enviadas assim que entram no buffer. Em `drain` (linhas 120-122), `pending = result.buffer` tira a fala do buffer **antes** de `sendPhrases` disparar o envio. `sendPhrases` (76-93) continua fire-and-forget: um 5xx, um timeout de 10 s ou uma queda de Wi-Fi só geram `logger.warn`/`logger.error`, e a fala nunca é reenviada. Antes, uma falha perdia um flush (~250 ms de fala). Agora ela perde **uma fala inteira**, até `AGENTE_PHRASE_MAX_WAIT_MS` (5 s) de palavras de uma vez. Além disso, as falas liberadas no mesmo `drain`, e as falas de drains seguidos (por exemplo, o pedaço do teto e o pedaço seguinte do mesmo segmento), continuam correndo em paralelo, sem ordem garantida.

**Correção:** Serialize os envios numa fila própria (sem bloquear `flushState`) e só tire a fala do buffer depois de um `response.ok`. Se não der, devolva a fala ao buffer com retry limitado:

```ts
let sendQueue: Promise<void> = Promise.resolve();
function sendPhrases(config: AgenteConfig, phrases: readonly PendingPhrase[]): void {
  for (const phrase of phrases) {
    const request = buildExtensionChunkRequest(
      { ...config, agenteSessionId: phrase.sessionId },
      { text: phrase.text, speaker: phrase.speaker },
    );
    sendQueue = sendQueue.then(async () => {
      try {
        const res = await deps.send(request);
        if (!res.ok) logger.warn('Agente recusou o trecho', { status: res.status });
      } catch (error) {
        logger.error('envio ao Agente falhou', error);
      }
    });
  }
}
```

(A fila garante a ordem. Para não perder palavras é preciso retry ou um buffer "confirmado", o que é uma decisão de desenho.)

### WR-02: Depois de reiniciar o service worker ou religar o toggle, palavras são descartadas (agora também tudo o que estava pendente na janela)

**Arquivos:** `taqciti/src/features/agente/wordDelta.ts:112-113`, `taqciti/src/background/agenteStreamer.ts:63-66`, `taqciti/src/background/agenteStreamer.test.ts:401-411, 470-477`

**Problema:** Continua valendo. O prime acontece com o estado **do primeiro flush depois do reinício**, que já traz o chunk novo aplicado. No teste de reinício, "e mais isso" é falado depois do reinício e nunca é enviado, e o teste (linhas 470-477) fixa essa perda como comportamento esperado. O mesmo vale para religar o toggle (linhas 401-411): "e agora" é falado com o streaming já ligado e se perde.

O 07-04 criou uma segunda perda no reinício. `pending` e o timer (linhas 65-66) existem só em memória, e o cursor já contou as palavras pendentes como enviadas. Se o service worker morrer com uma fala na janela (até 5 s de texto), essa fala some. Depois do reinício o cursor é `null` e faz prime por cima dela.

**Correção:** Faça o prime com o estado **hidratado** (antes de aplicar o evento novo). Por exemplo, exponha `primeAgenteStreamer(getState())` e chame depois de `hydrate()` no boot do service worker. Outra opção é persistir o `StreamCursor` **e o `PhraseBuffer`** em `chrome.storage.session` junto com `taq:state`. Para religar o toggle, faça o prime no momento em que o `onChanged` do reader detecta `streamingEnabled: false → true`, com o estado atual. Depois ajuste os testes para exigir que "e mais isso" e "e agora" sejam enviados.

### WR-03: A fila de patches fica envenenada para sempre depois de uma única falha de escrita

**Arquivo:** `taqciti/src/shared/config/agenteConfigStore.ts:38-45`

**Problema:** `queue = queue.then(async () => ...)` sem `.catch`. Se um `writeLocal` rejeitar uma vez (quota, contexto invalidado), `queue` vira uma promessa rejeitada, e todo `patchAgenteConfig` seguinte encadeia em `.then` sobre ela: a callback nunca roda e tudo rejeita até recarregar a página. O padrão veio de `prefsStore.ts:58-63`, mas o bug está no código escrito nesta fase também.

**Correção:**

```ts
export function patchAgenteConfig(patch: Partial<AgenteConfig>): Promise<AgenteConfig> {
  const run = queue.catch(() => undefined).then(async () => {
    const next = normalizeAgenteConfig({ ...(await loadAgenteConfig()), ...patch });
    await writeLocal(STORAGE_KEYS.agenteConfig, next);
    return next;
  });
  queue = run;
  return run;
}
```

### WR-04: Erros de gravação não são tratados na tela: rejeição sem tratamento e nenhum retorno para a pessoa

**Arquivos:** `taqciti/src/shared/hooks/useAgenteConfigForm.ts:84-112`, `taqciti/src/sidepanel/screens/AgenteConfigScreen.tsx:114`

**Problema:** `save()` tem `try/finally` sem `catch`, e a tela chama `void save()`. Se o patch falhar (ou se a fila estiver envenenada, WR-03), sobra uma unhandled rejection e o botão simplesmente volta a "Salvar", sem dizer que nada foi gravado. `setStreamingEnabled` faz `void patchAgenteConfig(...)`, o mesmo problema: o checkbox não muda e ninguém entende por quê.

**Correção:** Adicione um estado `error: string | null` no hook, com `catch` em `save()` e em `setStreamingEnabled`, e mostre a mensagem no `<p aria-live>`:

```ts
} catch (error) {
  setError('Não foi possível salvar a configuração. Tente de novo.');
  logger.error('salvar config do Agente falhou', error);
} finally { setSaving(false); }
```

### WR-05: `save()` manda o objeto inteiro, contrariando o contrato do store, grava o padrão da build no storage e descarta o que foi digitado durante o salvamento

**Arquivo:** `taqciti/src/shared/hooks/useAgenteConfigForm.ts:87-101`

**Problema:** O próprio `agenteConfigStore.ts:33-37` diz "quem chama manda só o campo que está mudando, nunca o objeto inteiro". O hook, porém, manda sempre os três campos, mesmo os que não foram editados. Isso causa três problemas:

1. **Corrida com a Fase 8:** se o auto-detect gravar `agenteSessionId` entre o clique e a leitura do rascunho (a entrega do `onChanged` é assíncrona), o rascunho velho sobrescreve o valor detectado.
2. **Padrão congelado:** no primeiro "Salvar", o `AGENTE_BACKEND_URL_DEFAULT` vai parar no storage. Se o padrão da build mudar numa release futura, quem já salvou uma vez fica preso no valor antigo, o que contradiz o runbook ("são só valores-padrão para quem nunca abriu a tela").
3. Os campos não ficam desabilitados enquanto `saving` é verdadeiro. O que a pessoa digitar durante o `await` é apagado pelo `setDrafts(next)`, e `editedRef` é zerado.

**Correção:** Monte o patch só com os campos marcados em `editedRef`, zere só esses e sobrescreva só esses rascunhos:

```ts
const patch: Partial<AgenteConfig> = {};
for (const field of Object.keys(editedRef.current) as AgenteConfigField[]) {
  if (editedRef.current[field]) patch[field] = drafts[field];
}
if (Object.keys(patch).length === 0) return;
const next = await patchAgenteConfig(patch);
```

Além disso, desabilite os `TextField` enquanto `saving` for verdadeiro.

### WR-06: A chave `x-agente-key` pode ir em texto puro por `http://` para qualquer host, e digitar "localhost:8000" vira https e quebra o dev local

**Arquivo:** `taqciti/src/shared/config/agenteConfig.ts:71-77, 115-122, 160-162`

**Problema:** Continua valendo (o 07-04 só inseriu constantes no arquivo, e as linhas mudaram de lugar). `isValidAgenteBackendUrl` aceita `http:` para qualquer host, e `buildExtensionChunkRequest` anexa a chave sempre que ela existe. Com uma URL `http://agente.empresa.com`, a credencial do gate `EXTENSION_SHARED_KEY` e a transcrição da reunião trafegam sem TLS. No sentido oposto, `normalizeAgenteBackendUrl('localhost:8000')` vira `https://localhost:8000` (mesmo com o placeholder da tela sendo `http://localhost:8000`), o envio falha com erro de TLS e a tela mostra "Ligado".

**Correção:** Só aceite `http:` para loopback (`localhost`, `127.0.0.1`, `[::1]`) e trate `http` em outro host como `invalid-url` (ou pelo menos não mande a chave):

```ts
function isValidAgenteBackendUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol === 'https:') return true;
    return u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  } catch { return false; }
}
```

E em `normalizeAgenteBackendUrl`, use `http://` como prefixo quando o host digitado for loopback.

### WR-07: O status "Ligado — está sendo enviada" não reflete a entrega real (401, 404 e erros de rede ficam invisíveis)

**Arquivos:** `taqciti/src/sidepanel/screens/AgenteConfigScreen.tsx:19, 120-122`, `taqciti/src/background/agenteStreamer.ts:76-93`

**Problema:** Continua valendo: `sendPhrases` (76-93) só registra falhas no `logger`. O status é calculado só a partir da config salva. Chave errada (401 em todo chunk), session_id de uma sessão já encerrada (4xx), backend fora do ar: tudo isso fica só no `logger` do service worker, que ninguém de produto ou soluções vai abrir. A tela afirma que a transcrição "está sendo enviada" mesmo quando 100% dos envios falham.

**Correção:** Grave em `chrome.storage.session` um status de runtime mínimo (`lastSendAt`, `lastError`, `lastStatus`) a partir de `agenteStreamer.ts`, e faça a tela assiná-lo. Troque o texto de `ready` para algo como "Ligado — pronto para enviar", e mostre "Último envio falhou (401: chave recusada)" quando for o caso.

### WR-08: Se a primeira leitura falhar, `createAgenteConfigReader` guarda a promessa rejeitada e o streamer para até a config mudar

**Arquivo:** `taqciti/src/shared/config/agenteConfigStore.ts:83-100`

**Problema:** `cached = loadAgenteConfig()` é guardado sem tratamento. Se o `chrome.storage.local.get` rejeitar uma vez, toda chamada de `loadConfig` devolve a mesma rejeição, e todo `step` do streamer falha (o erro só vai para o log) até alguma escrita em `taq:agenteConfig` disparar o `onChanged`. Com a config estável, isso significa a reunião inteira sem streaming.

**Correção:**

```ts
cached = loadAgenteConfig().catch((error) => {
  cached = null; // próxima chamada tenta de novo
  throw error;
});
```

Com `cached = null`, também é preciso evitar registrar o listener duas vezes (guarde um flag `listening`).

### WR-10: Testes da janela por fala que passam por construção: o "drain" é um passo real com efeito colateral

**Arquivo:** `taqciti/src/background/agenteStreamer.test.ts:11-12, 195-196, 285-317, 703-734, 736-766, 768-823, 875-909`

**Problema:** O cabeçalho (linhas 11-12) e os comentários (195, 245) chamam o drain `await agenteStreamer.onSessionFlushed(getState())` de "passo idempotente", mas ele é um `step` completo. Enquanto desligado, zera o cursor (`planStreamStep` devolve `cursor: null`). Fora de `'recording'`, faz `flushAll`. E sempre libera, com o `Date.now()` do momento, as falas cujo prazo já passou. Na prática:

1. **"toggle com fala pendente" (768-823) depende do próprio drain para passar.** Quem descarta a fala é o tick. Só que o tick **não** zera o cursor (linhas 146-153 de `agenteStreamer.ts`). Quem zera é o drain da linha 797, rodando com a config desligada. Sem esse drain (que é o que acontece em produção quando ninguém fala durante o "desligado"), o cursor continuaria com 4 palavras, "e" seria enviado junto com "isso é novo", e a asserção `{ text: 'isso é novo' }` da linha 822 falharia. O comentário das linhas 800-802 ("o cursor foi resetado enquanto desligado") descreve um efeito do teste, não do código de produção.
2. **"fim" (703-734) e "pausa" (736-766) não provam o caminho `dispatch → flushState → streamer`.** A chamada manual de `onSessionFlushed` (linhas 729 e 761), com a fase já `'ended'`/`'paused'`, faz o `flushAll` sozinha. Os testes continuariam verdes mesmo se `flushState` nunca chamasse o streamer.
3. **"não bloqueante em erro de rede" (285-317) não verifica que o envio aconteceu.** O comentário das linhas 314-315 diz que o avanço de relógio serve para "o envio (rejeitado) de fato acontecer", mas não há `expect` sobre o `send`. Um `send` que nunca fosse chamado passaria igual.
4. **"cadência local intacta" (875-909) roda com o streaming desligado** (não chama `configureAgenteStreamer`). `expect(fetchMock).not.toHaveBeenCalled()` (908) é trivialmente verdadeiro e não prova que a janela do Agente é independente da gravação de 250 ms, que é o que o nome do teste afirma.

**Correção:** Exponha na instância um observador sem efeito colateral e use ele nas asserções de ausência. Nos testes de fim/pausa, não chame `onSessionFlushed` manualmente:

```ts
// agenteStreamer.ts
function whenIdle(): Promise<void> { return queue; }
return { onSessionFlushed, dispose: discard, whenIdle };
export function whenAgenteStreamerIdle(): Promise<void> { return activeStreamer.whenIdle(); }

// agenteStreamer.test.ts — fim
await sessionController.dispatch({ type: 'MEETING_FINISHED', at: 2000 });
await agenteStreamer.whenAgenteStreamerIdle();
expect(fetchMock).toHaveBeenCalledTimes(1);
```

No teste de toggle, troque o drain da linha 797 por `whenIdle()` e decida (junto com WR-02/WR-11) qual comportamento é o certo ao religar. No teste de erro de rede, use `const send = vi.fn(() => Promise.reject(...))` e `expect(send).toHaveBeenCalledTimes(1)`. No de cadência, configure `READY_CONFIG` e afirme que `taq:state` foi gravado em 250 ms **e** que o `fetch` ainda não foi chamado antes de `AGENTE_PHRASE_QUIET_MS`.

### WR-11: Desligar e religar o toggle dentro da janela envia a fala pendente (D-09 não é reativo)

**Arquivo:** `taqciti/src/background/agenteStreamer.ts:105-117, 135-138, 146-153`

**Problema:** O plano 07-04 diz que o streamer "MUST NOT enviar texto ao Agente depois que o streaming foi desligado — inclusive o texto que estava pendente na janela". O streamer, porém, só nota o desligamento quando roda um `step` (linhas 135-138) ou um `tick` (148-151). Nada reage ao `onChanged` do toggle. Sequência:

1. t=0: "isso é confidencial" entra no buffer, com prazo em t=1,5 s.
2. t=0,5 s: a pessoa desliga o toggle, arrependida de ter deixado ligado. Ninguém fala, então nenhum flush acontece.
3. t=1,0 s: ela religa, para continuar a partir dali.
4. t=1,5 s: o `tick` lê a config (ligada) e envia "isso é confidencial".

A fala que devia ter sido descartada no desligamento sai depois de desligada. Além disso, `tick` e `step` tratam o "desligado" de jeitos diferentes: `step` zera o cursor, e `tick` não. O que acontece ao religar depende de alguém ter falado durante o intervalo (ver WR-10, item 1).

**Correção:** Faça o descarte reagir à mudança de config, dentro da mesma fila. Por exemplo, injete um assinante nas deps (isso muda o contrato `AgenteStreamerDeps`, que o plano quis manter só com `loadConfig`/`send`: **DECISÃO EM ABERTO** do time):

```ts
export interface AgenteStreamerDeps {
  loadConfig: () => Promise<AgenteConfig>;
  send: (request: ExtensionChunkRequest) => Promise<Response>;
  onConfigChange?: (listener: (config: AgenteConfig) => void) => () => void;
}
// createAgenteStreamer
deps.onConfigChange?.((config) => {
  if (!isStreamingReady(config)) {
    void enqueue(async () => { discard(); cursor = null; });
  }
});
```

Uma alternativa sem mudar o contrato é o reader expor uma "revisão" da config. Cada `PendingPhrase` guarda a revisão em que foi acumulada, e o `tick` descarta as falas acumuladas antes de um desligamento. Qualquer que seja a escolha, alinhe `tick` e `step` quanto a zerar ou não o cursor.

### WR-12: Se o `loadConfig` falhar no tick, a fala pendente fica sem timer e só sai quando alguém voltar a falar

**Arquivo:** `taqciti/src/background/agenteStreamer.ts:112-115, 146-153`

**Problema:** O callback do timer faz `timer = null` (linha 113) e enfileira `tick`. Se `await deps.loadConfig()` (147) rejeitar, o `enqueue` só registra o erro no log. `rearm` nunca é chamado, e `pending` continua com a fala **sem nenhum timer armado**. Se a pessoa ficou em silêncio (típico no fim de uma frase, que é justamente quando o tick dispara), a fala só sai no próximo flush de legenda ou no `flushAll` do fim da reunião. Se o service worker morrer antes disso, ela se perde (o cursor já contou as palavras). Somado ao WR-08 (cache de rejeição), a fala fica presa até a config mudar. Isso quebra em silêncio a promessa de "quase tempo real" (SC1).

**Correção:** Garanta que, depois de qualquer passo, um buffer não vazio sempre tenha timer armado, com um atraso mínimo para não virar laço apertado quando a falha se repete:

```ts
const RETRY_MIN_MS = 1_000;
timer = setTimeout(() => {
  timer = null;
  void enqueue(tick).then(() => {
    if (timer === null && pending.length > 0) {
      timer = setTimeout(() => { timer = null; void enqueue(tick); }, RETRY_MIN_MS);
    }
  });
}, Math.max(0, deadline - now));
```

(Ou mova esse rearme defensivo para um `finally` dentro de `tick`.)

### WR-13: `dispose()` não é terminal: um passo já enfileirado na instância antiga rearma timer e envia com as deps antigas

**Arquivo:** `taqciti/src/background/agenteStreamer.ts:96-102, 159, 176-185`

**Problema:** `dispose` é só `discard`: limpa `pending` e o timer, mas a instância continua funcionando normalmente. Se houver um `step` na fila da instância antiga (por exemplo, esperando `loadConfig`) quando `configureAgenteStreamer` roda, esse passo continua. Ele calcula deltas a partir do cursor antigo, preenche `pending`, envia (com `flushAll`) ou **arma um timer novo** na instância descartada, que depois dispara um `tick` com o `send`/`loadConfig` antigos. O comentário das linhas 178-179 ("nenhum timer órfão continua vivo") e a mitigação T-07-19 do plano afirmam uma garantia que não existe. Hoje `configureAgenteStreamer` só é chamado em testes, logo antes de qualquer `dispatch`, então o efeito não aparece. Mas ele é exportado como "seam de composição", e a Fase 8 (session binding) é a candidata natural a usá-lo em produção.

**Correção:** Marque a instância como descartada e faça todo ponto de entrada respeitar isso:

```ts
let disposed = false;
function dispose(): void { disposed = true; discard(); }
async function step(state: MeetingState): Promise<void> {
  const config = await deps.loadConfig();
  if (disposed) return;
  // ...
}
async function tick(): Promise<void> {
  if (disposed) return;
  // ...
}
function rearm(now: number): void {
  if (disposed) return;
  // ...
}
return { onSessionFlushed, dispose };
```

## Info

### IN-01: `.catch` redundante em `flushState`

**Arquivo:** `taqciti/src/background/sessionController.ts:175`
**Problema:** `onSessionFlushed` já termina em `.catch` e nunca rejeita, então o `.catch` externo é código morto e deixa uma segunda mensagem de log que nunca vai aparecer.
**Correção:** Deixar só `void onSessionFlushed(state);`.

### IN-02: Corrida entre a leitura inicial e o `onChanged` em `subscribeAgenteConfig`

**Arquivo:** `taqciti/src/shared/config/agenteConfigStore.ts:54-65`
**Problema:** Se a leitura inicial for resolvida depois de um `onChanged` (por exemplo quando um patch acontece logo na montagem), `onConfig` recebe primeiro o valor novo e depois o valor velho, e a tela fica desatualizada. O padrão é herdado de `prefsStore.ts`.
**Correção:** Ignorar a entrega inicial se alguma entrega do `onChanged` já tiver acontecido (flag `gotChange`).

### IN-03: URLs com query, fragmento ou esquema estranho passam na validação

**Arquivo:** `taqciti/src/shared/config/agenteConfig.ts:71-77, 158`
**Problema:** Continua valendo, com as linhas atualizadas. `https://x.com/?a=b` vira `https://x.com/?a=b/webhook/extension`. `ftp://x` recebe o prefixo e vira `https://ftp://x`, que `new URL` aceita (host `ftp`). Nos dois casos o status mostra `ready`.
**Correção:** Normalizar via `new URL(...)`, recusar `search`/`hash` e checar o esquema antes de colocar o prefixo.

### IN-04: "← Voltar" usa `href="?"` e perde a view de origem

**Arquivo:** `taqciti/src/sidepanel/screens/AgenteConfigScreen.tsx:43`
**Problema:** Quem chegou vindo de `?view=history` e voltou cai no roteamento por fase (numa reunião ao vivo, a tela ao vivo), e não no histórico.
**Correção:** Usar `history.back()` quando `document.referrer` for da própria extensão, ou `?view=history`.

### IN-05: A chave salva volta em texto claro para o `value` do input

**Arquivo:** `taqciti/src/shared/hooks/useAgenteConfigForm.ts:67, 100`
**Problema:** O campo é `type="password"`, mas o valor inteiro fica no DOM e aparece em qualquer inspeção. O SDD (F1) adota a política "mascarada depois de salvar; para rever, redigitar".
**Correção:** Manter o rascunho da chave vazio com um indicador "chave configurada" e só gravar quando for editado.

### IN-06: O runbook não diz que o check da release não valida `VITE_AGENTE_BACKEND_URL`

**Arquivo:** `taqciti/docs/publicar-release.md:79-94`
**Problema:** Se alguém definir `VITE_AGENTE_BACKEND_URL` com `http://` de produção ou com barra no fim, o `check-release-env.sh` não barra nada. A barra no fim é normalizada em runtime, mas o `http` não (ver WR-06).
**Correção:** Acrescentar uma linha no runbook (ou estender o script) recomendando `https://` para o padrão de build do Agente.

### IN-07: `agenteStreamer.test.ts` tem 941 linhas, com o mesmo bloco de preparação copiado 19 vezes

**Arquivo:** `taqciti/src/background/agenteStreamer.test.ts:95-941`
**Problema:** O arquivo dobrou de tamanho no 07-04 e tem quase 5x o limite de 200 linhas do `CLAUDE.md` ("sinal de que está fazendo coisas demais"). O `dispatch` de `MEETING_DETECTED` (oito campos idênticos) e a sequência `fresh()` + `stubGlobal` + `configureAgenteStreamer` se repetem em quase todos os casos. Isso já causou a suposição errada de timing corrigida durante a Task 3 (ver SUMMARY) e dificulta enxergar o que cada teste realmente exercita (ver WR-10).
**Correção:** Extrair helpers `startMeeting(sessionController)` e `speak(sessionController, text, atMs)` para `src/test/`, e separar o arquivo por responsabilidade: e2e básico/D-10, janela por fala (G-07-1/G-07-2) e config vinda do storage/reinício.

### IN-08: `agenteStreamer.ts` está com 190 linhas e acumula quatro responsabilidades

**Arquivo:** `taqciti/src/background/agenteStreamer.ts:43-48, 62-160, 170-190`
**Problema:** O arquivo mistura quatro coisas: transporte HTTP (`defaultSend`), agendamento do timer e buffer da janela (`rearm`/`drain`/`discard`), orquestração do cursor (`step`/`tick`) e raiz de composição com singleton de módulo (`activeDeps`/`activeStreamer`). Ele está a 10 linhas do limite, e qualquer correção de WR-01/WR-11/WR-12/WR-13 vai passar do limite.
**Correção:** Mover o par timer + buffer para um `phraseScheduler.ts` (com `schedule(now)`/`cancel()`/`dispose()`) e o `defaultSend` + composição para um módulo de wiring. Assim `agenteStreamer.ts` fica só com a orquestração.

### IN-09: A janela usa relógio de parede (`Date.now`), sensível a ajuste de hora do sistema

**Arquivo:** `taqciti/src/background/agenteStreamer.ts:140, 152`, `taqciti/src/features/agente/phraseBatcher.ts:99-102, 121`
**Problema:** `firstAt`/`lastAt` e o `now` do corte vêm de `Date.now()`. Se a hora do sistema voltar (sincronização NTP, fuso, retorno de suspensão), `now - firstAt` fica negativo e o teto de 5 s deixa de valer em fala contínua até alguém fazer uma pausa. Se a hora avançar, falas saem cortadas antes do silêncio.
**Correção:** Usar `performance.now()` (monotônico) no streamer. O `phraseBatcher` já recebe `now` como parâmetro, então não muda nada lá.

### IN-10: Um `send` que lança de forma síncrona perde as falas restantes da mesma rodada e não rearma o timer

**Arquivo:** `taqciti/src/background/agenteStreamer.ts:76-93, 119-124`
**Problema:** Em `drain`, `pending = result.buffer` roda antes de `sendPhrases`. Se `deps.send` lançar de forma síncrona (uma implementação injetada qualquer, ou um `buildExtensionChunkRequest` que passe a validar), o laço para no meio: as falas seguintes de `result.ready` não saem, porque já foram tiradas do buffer, e `rearm(now)` não roda. O `defaultSend` atual não lança de forma síncrona, por isso é informativo.
**Correção:** Envolver cada iteração em `try/catch`, ou montar o envio como `Promise.resolve().then(() => deps.send(request))`.

### IN-11: A fala pendente de uma sessão antiga sai com a URL e a chave atuais, não as do momento em que foi acumulada

**Arquivo:** `taqciti/src/background/agenteStreamer.ts:76-81, 146-153`
**Problema:** `sendPhrases` usa `{ ...config, agenteSessionId: phrase.sessionId }` com a config **do tick**. Se alguém trocar o backend (por exemplo, de staging para produção) junto com o session_id, a fala pendente da sessão antiga vai para o backend novo sob o id antigo (404, ou, no pior caso, um id que coincide com outra sessão). Isso contraria a intenção do D-04 ("o texto acumulado sob um session_id só vai para esse destino").
**Correção:** Guardar em `PendingPhrase` o destino completo (`agenteBackendUrl` junto com `sessionId`), usar isso como parte da chave em `appendDeltas` e montar a requisição a partir dele.

---

_Revisado em: 2026-09-26_
_Revisor: Claude (gsd-code-reviewer)_
_Profundidade: standard_
