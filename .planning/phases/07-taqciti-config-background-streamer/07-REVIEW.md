---
phase: 07-taqciti-config-background-streamer
reviewed: 2026-09-26T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - taqciti/docs/publicar-release.md
  - taqciti/src/background/agenteStreamer.test.ts
  - taqciti/src/background/agenteStreamer.ts
  - taqciti/src/background/sessionController.ts
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
  warning: 9
  info: 6
  total: 16
status: issues_found
---

# Fase 7: Relatório de Code Review

**Revisado em:** 2026-09-26
**Profundidade:** standard
**Arquivos revisados:** 18
**Status:** issues_found

## Resumo

Revisei os 18 arquivos escritos nesta fase dentro de `taqciti/`: o pipe de streaming (`agenteConfig.ts`, `wordDelta.ts`, `agenteStreamer.ts`, ligação em `sessionController.ts`), o store em `chrome.storage.local` e a tela nova no side panel. Comparei tudo com as convenções que o próprio `taqciti/` já usa (`prefsStore.ts`, streamer com injeção de dependência, primitivas `AppShell`/`TextField`/`Button`), e não com as regras de layout do `CLAUDE.md`.

No geral o código está limpo, com funções puras bem separadas e testes de ponta a ponta de verdade. Os problemas mais sérios estão na **semântica do cursor de streaming**:

- Uma reunião nova (`meetingId` novo) com o mesmo `session_id` trava o envio em silêncio, enquanto a tela continua dizendo "Ligado — a transcrição ao vivo está sendo enviada". Não existe um caminho de recuperação que alguém descubra sozinho, e o comportamento muda dependendo de o service worker ter reiniciado ou não (CR-01).
- O cursor avança antes de o envio ser confirmado. Qualquer falha de rede perde palavras de vez, e os envios concorrentes podem chegar fora de ordem (WR-01).
- Depois de um reinício do service worker, ou quando o toggle é religado, as palavras do primeiro flush são descartadas. O teste trata essa perda como o comportamento esperado (WR-02).

Do lado do store e do formulário:

- A fila de patches herda do `prefsStore.ts` um envenenamento permanente depois de uma única falha (WR-03).
- O hook não trata erros (WR-04).
- O hook manda o objeto inteiro, contrariando o contrato documentado do store (WR-05).
- A chave `x-agente-key` pode ir em texto puro por `http://` (WR-06).

## Critical Issues

### CR-01: Reunião nova com o mesmo session_id trava o streaming em silêncio, enquanto a UI diz "Ligado"

**Arquivos:** `taqciti/src/features/agente/wordDelta.ts:115-118`, `taqciti/src/sidepanel/screens/AgenteConfigScreen.tsx:19`, `taqciti/src/shared/config/agenteConfig.ts:116-126`

**Problema:** Quando `prev.meetingId !== session.meetingId` e `binding.sessionId === prev.sessionId`, `planStreamStep` devolve `{ cursor: prev, deltas: [] }` **para sempre**. O cursor continua preso na reunião antiga, e todo flush seguinte cai no mesmo ramo. Esse caso aparece em situações bem reais:

- A pessoa volta para a mesma sala depois da janela de `REJOIN_RESUME_WINDOW_MS` (10 min). A máquina cria um `meetingId` novo, mas a sessão do Agente continua ativa e é a mesma.
- A pessoa cola o ID novo ainda durante o fim da reunião anterior. O ramo da linha 122-123 "migra" o cursor da reunião antiga para o ID novo, e quando a reunião nova começa cai de novo no ramo de espera.

Nos dois casos:

1. `getStreamingReadiness` só olha a config, então a tela mostra `ready` → "Ligado — a transcrição ao vivo está sendo enviada ao Agente." Nada é enviado, e nenhum log ou aviso aparece.
2. Salvar o mesmo UUID de novo não destrava, porque o binding não muda. A única saída é desligar o toggle, **esperar um flush acontecer** (alguém falar) e religar. Isso não está documentado em lugar nenhum.
3. A garantia "nada vai para a sessão da reunião anterior" nem sempre vale: se o service worker reiniciar (coisa comum no MV3), `cursor` volta a `null` e a linha 112-113 faz prime da reunião nova direto no session_id antigo. O resultado depende de um detalhe de ciclo de vida que ninguém controla.

Na prática, a transcrição da reunião é perdida sem nenhum aviso, e a tela afirma o contrário.

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

### WR-01: O cursor avança antes do envio ser confirmado: falha de rede perde palavras de vez, e a ordem de chegada não é garantida

**Arquivo:** `taqciti/src/background/agenteStreamer.ts:52-70`

**Problema:** `cursor = result.cursor` é gravado antes de qualquer `send`. Cada delta é disparado em fire-and-forget, e um 5xx, um timeout de 10 s ou uma queda de Wi-Fi só geram `logger.error`. As palavras daquele trecho nunca mais são reenviadas, porque o cursor já as conta como enviadas. Além disso, os envios de uma mesma rodada (vários segmentos) e de rodadas seguidas (a cada 250 ms) correm em paralelo, sem ordem garantida. Com a latência variando, o backend recebe "como vai" antes de "olá tudo bem" e monta a transcrição embaralhada.

**Correção:** Serialize os envios numa fila própria (sem bloquear `flushState`) e só confirme a contagem no cursor depois de um `response.ok`. Se não der, mantenha um buffer de pendentes com retry limitado:

```ts
let sendQueue: Promise<void> = Promise.resolve();
for (const delta of result.deltas) {
  const request = buildExtensionChunkRequest(config, { text: delta.text, speaker: delta.speaker });
  sendQueue = sendQueue.then(async () => {
    try {
      const res = await deps.send(request);
      if (!res.ok) logger.warn('Agente recusou o trecho', { status: res.status });
    } catch (error) {
      logger.error('envio ao Agente falhou', error);
    }
  });
}
```

(A fila garante a ordem. Para não perder palavras é preciso retry ou um cursor "confirmado", o que é uma decisão de desenho.)

### WR-02: Depois de reiniciar o service worker ou religar o toggle, as palavras do primeiro flush são descartadas

**Arquivos:** `taqciti/src/features/agente/wordDelta.ts:112-113`, `taqciti/src/background/agenteStreamer.test.ts:385-397`

**Problema:** O prime acontece com o estado **do primeiro flush depois do reinício**, que já traz o chunk novo aplicado. No teste, "e mais isso" foi falado depois do reinício e mesmo assim nunca é enviado, e o teste (linhas 391-397) fixa essa perda como comportamento esperado. O mesmo vale para religar o toggle (linhas 330-337): "e agora" é falado com o streaming já ligado e se perde. Como o MV3 derruba o service worker com frequência, a perda se repete ao longo de uma reunião longa.

**Correção:** Faça o prime com o estado **hidratado** (antes de aplicar o evento novo). Por exemplo, exponha `primeAgenteStreamer(getState())` e chame depois de `hydrate()` no boot do service worker. Outra opção é persistir o `StreamCursor` em `chrome.storage.session` junto com `taq:state`. Para religar o toggle, faça o prime no momento em que o `onChanged` do reader detecta `streamingEnabled: false → true`, com o estado atual. Depois ajuste o teste para exigir que "e mais isso" seja enviado.

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

**Arquivo:** `taqciti/src/shared/config/agenteConfig.ts:55-61, 99-106, 144-146`

**Problema:** `isValidAgenteBackendUrl` aceita `http:` para qualquer host, e `buildExtensionChunkRequest` anexa a chave sempre que ela existe. Com uma URL `http://agente.empresa.com`, a credencial do gate `EXTENSION_SHARED_KEY` e a transcrição da reunião trafegam sem TLS. No sentido oposto, `normalizeAgenteBackendUrl('localhost:8000')` vira `https://localhost:8000` (mesmo com o placeholder da tela sendo `http://localhost:8000`), o envio falha com erro de TLS e a tela mostra "Ligado".

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

**Arquivos:** `taqciti/src/sidepanel/screens/AgenteConfigScreen.tsx:19, 120-122`, `taqciti/src/background/agenteStreamer.ts:62-69`

**Problema:** O status é calculado só a partir da config salva. Chave errada (401 em todo chunk), session_id de uma sessão já encerrada (4xx), backend fora do ar: tudo isso fica só no `logger` do service worker, que ninguém de produto ou soluções vai abrir. A tela afirma que a transcrição "está sendo enviada" mesmo quando 100% dos envios falham.

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

### WR-09: As asserções de ausência nos testes usam uma espera que não faz nada

**Arquivo:** `taqciti/src/background/agenteStreamer.test.ts:181, 325, 336, 396`

**Problema:** `await vi.waitFor(() => expect(true).toBe(true))` resolve na primeira tentativa, sem esperar nada. O comentário "Dá tempo real para qualquer envio indevido aparecer" não é verdade. As asserções `not.toHaveBeenCalled()` / `toHaveBeenCalledTimes(1)` logo depois só funcionam porque, hoje, a cadeia assíncrona termina dentro de `advanceTimersByTimeAsync`. Se `loadConfig` ou o storage ganharem mais um `await`, os testes de "desligado não envia" continuam verdes sem provar nada.

**Correção:** Espere o passo do streamer terminar de forma explícita. Por exemplo, exponha a promessa de `onSessionFlushed` ou aguarde `await agenteStreamer.onSessionFlushed(sessionController.getState())` antes de afirmar a ausência. Outra opção é rodar `await vi.runAllTimersAsync()` seguido de alguns `await Promise.resolve()`.

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

**Arquivo:** `taqciti/src/shared/config/agenteConfig.ts:55-61, 142`
**Problema:** `https://x.com/?a=b` vira `https://x.com/?a=b/webhook/extension`. `ftp://x` recebe o prefixo e vira `https://ftp://x`, que `new URL` aceita (host `ftp`). Nos dois casos o status mostra `ready`.
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

---

_Revisado em: 2026-09-26_
_Revisor: Claude (gsd-code-reviewer)_
_Profundidade: standard_
