---
phase: 07-taqciti-config-background-streamer
reviewed: 2026-09-29T20:30:00Z
depth: standard
iteration: 2
diff_base: 43a941c2913cdbeadfd6c68b779717a06e70d32f
files_reviewed: 37
files_reviewed_list:
  - taqciti/docs/publicar-release.md
  - taqciti/src/background/agenteSender.test.ts
  - taqciti/src/background/agenteSender.ts
  - taqciti/src/background/agenteStatusReporter.ts
  - taqciti/src/background/agenteStreamer.test.ts
  - taqciti/src/background/agenteStreamer.ts
  - taqciti/src/background/agenteStreamerDeps.ts
  - taqciti/src/background/agenteStreamerInstance.ts
  - taqciti/src/background/agenteStreamerSnapshot.ts
  - taqciti/src/background/index.ts
  - taqciti/src/background/phraseWindowTimer.ts
  - taqciti/src/background/sessionController.ts
  - taqciti/src/document/baixarDocumento.ts
  - taqciti/src/features/agente/phraseBatcher.test.ts
  - taqciti/src/features/agente/phraseBatcher.ts
  - taqciti/src/features/agente/sendRetryPolicy.test.ts
  - taqciti/src/features/agente/sendRetryPolicy.ts
  - taqciti/src/features/agente/wordDelta.test.ts
  - taqciti/src/features/agente/wordDelta.ts
  - taqciti/src/shared/config/agenteConfig.test.ts
  - taqciti/src/shared/config/agenteConfig.ts
  - taqciti/src/shared/config/agenteConfigStore.test.ts
  - taqciti/src/shared/config/agenteConfigStore.ts
  - taqciti/src/shared/config/agenteStatus.test.ts
  - taqciti/src/shared/config/agenteStatus.ts
  - taqciti/src/shared/config/agenteStatusStore.ts
  - taqciti/src/shared/config/constants.ts
  - taqciti/src/shared/hooks/useAgenteConfigForm.ts
  - taqciti/src/shared/hooks/useAgenteStreamingStatus.ts
  - taqciti/src/shared/ui/Toggle.test.tsx
  - taqciti/src/shared/ui/Toggle.tsx
  - taqciti/src/sidepanel/backNavigation.test.ts
  - taqciti/src/sidepanel/backNavigation.ts
  - taqciti/src/sidepanel/components/AgenteApiKeyField.tsx
  - taqciti/src/sidepanel/screens/AgenteConfigScreen.test.tsx
  - taqciti/src/sidepanel/screens/AgenteConfigScreen.tsx
  - taqciti/src/sidepanel/screens/AgenteConfigScreenBack.test.tsx
findings:
  critical: 1
  warning: 5
  info: 6
  total: 12
status: issues_found
---

# Fase 7: Relatório de Code Review (re-revisão incremental)

**Revisado em:** 2026-09-29T20:30:00Z
**Profundidade:** standard
**Arquivos revisados:** 37
**Status:** issues_found

## Resumo

Esta é a segunda passada, só sobre o que mudou desde `43a941c`: as correções CR-01, WR-01..WR-13 e
IN-01..IN-11, os refactors mecânicos e o novo `Toggle`/`AgenteApiKeyField`. Os itens já dispostos em
`07-REVIEW-DISPOSITION.md` (inclusive os adiados IN-07, IN-08 e IN-09) **não** foram reabertos. Os
achados abaixo são ou lacunas novas criadas pelas correções, ou casos que a correção prometeu cobrir e
não cobre.

Rodei `npx tsc --noEmit`, `npx eslint` nos arquivos do escopo e `npx vitest run` em `taqciti/`: typecheck
limpo, lint limpo e **561/561 testes passando**. Os problemas abaixo passam pela suíte porque nenhum teste
exercita esses caminhos.

Sobre a chave de API: não achei vazamento. Ela não vai para o snapshot (`taq:agenteStreamer`), nem para o
status (`taq:agenteStatus`), nem para o DOM (o teste do IN-05 confere o `innerHTML`), nem para os logs
(`agenteSender` só loga o erro do `fetch` e o status HTTP). O único caminho teórico está no IN-01 abaixo, e
hoje ele não é alcançável.

O problema principal é o **CR-01**: a proteção "nada vai para a sessão errada sem a pessoa confirmar"
só vale enquanto o cursor em memória/`storage.session` existe. No caso mais comum, que é fechar o navegador
entre uma reunião e outra, ela não funciona.

## Critical Issues

### CR-01: A confirmação de "reunião nova" some quando o cursor é nulo, e a reunião do dia seguinte vai para a sessão antiga sem ninguém confirmar

**Arquivos:** `taqciti/src/features/agente/wordDelta.ts:116-118`, `taqciti/src/background/agenteStreamerInstance.ts:98-103`, `taqciti/src/background/agenteStreamerInstance.ts:172-176`, `taqciti/src/background/agenteStreamerSnapshot.ts:8-10`

**Problema:** o combinado do CR-01 (`07-DECISOES-REVIEW.md`, linha 36) é: "Nada vai para a sessão
errada sem a pessoa confirmar". A detecção de reunião nova, porém, depende de existir um cursor anterior
(`prev.meetingId !== session.meetingId`). Quando `prev === null`, `planStreamStep` faz o `primeCursor`
direto e começa a enviar, sem sinalizar espera. O cursor volta a ser `null` em três situações comuns:

1. **O navegador fechou.** O snapshot mora em `chrome.storage.session`, que é apagado quando o navegador
   fecha (o próprio comentário de `agenteStreamerSnapshot.ts:10` diz isso). Já `streamingEnabled` e
   `agenteSessionId` ficam em `chrome.storage.local`, que é permanente. Resultado: na segunda-feira a
   pessoa liga o streaming para a sessão S1 do cliente A. Na terça abre o Chrome e entra na reunião do
   cliente B. O primeiro flush tem `cursor === null`, faz o prime e manda toda a fala do cliente B para
   a sessão S1 do cliente A.
2. **A extensão foi atualizada ou recarregada**, o que também limpa o `storage.session`.
3. **O toggle foi desligado e religado.** `stopStreaming()` zera o cursor, e `applyConfigChange` faz o
   prime da reunião atual sem comparar com a reunião anterior.

O backend não segura isso: `backend/app/routers/webhook.py:40-44` insere em `transcript_chunks` para
qualquer `session_id`, inclusive de sessão já encerrada. Então a transcrição de um cliente acaba
misturada no diagnóstico/relatório de outro. Isso é resultado errado e também um problema de
privacidade/LGPD (dado de um cliente dentro da sessão de outro).

**Correção:** guardar a reunião a que a sessão está vinculada num lugar que sobrevive ao fechamento do
navegador, e tratar "cursor nulo com reunião diferente da vinculada" como espera. Um jeito simples:
gravar `boundMeetingId` junto da config em `storage.local` (só o id, sem texto) no primeiro prime de
cada `agenteSessionId`, e limpar esse valor quando o `agenteSessionId` mudar.

```ts
// wordDelta.ts — planStreamStep
export interface StreamBinding {
  sessionId: string;
  confirmedMeetingId?: string;
  /** Última reunião enviada para esta sessão (persistida em storage.local). */
  boundMeetingId?: string;
}

if (prev === null) {
  const bound = binding.boundMeetingId;
  if (bound && bound !== session.meetingId && binding.confirmedMeetingId !== session.meetingId) {
    return { cursor: null, deltas: [], waitingForNewMeeting: true };
  }
  return { cursor: primeCursor(session, binding.sessionId), deltas: [] };
}
```

O streamer grava `boundMeetingId` (via `patchAgenteConfig`) quando faz o prime ou a confirmação.
`patchAgenteConfig({ agenteSessionId })` limpa esse valor. Falta pelo menos um teste: cursor nulo
(sem snapshot), config com `boundMeetingId = 'M1'`, sessão `M2`: nada é enviado e aparece
`waitingForNewMeeting`. Como isso muda o contrato da config, é **DECISÃO EM ABERTO** do time pela regra
do CLAUDE.md, mas o bug precisa ser resolvido antes de mergear a fase.

## Warnings

### WR-01: Trocar a URL (ou a sessão) não limpa a fila de envio: trechos para o backend antigo seguem tentando por minutos, seguram os novos e sobrescrevem o status

**Arquivos:** `taqciti/src/background/agenteStreamerInstance.ts:164-181`, `taqciti/src/background/agenteSender.ts:57-80`, `taqciti/src/background/agenteSender.ts:94-107`

**Problema:** `applyConfigChange` só chama `sender.cancelAll()` quando o streaming fica desligado. Se a
config continua pronta e só muda a URL, a sessão ou a chave, os `ExtensionChunkRequest` que já estão em
`waiting` foram montados com a URL/chave antiga e continuam sendo enviados em ordem, com até 3 novas
tentativas cada. O cenário típico é justamente o de consertar o problema: o backend está fora ou a URL
tem um erro de digitação, a tela mostra "sem conexão", a pessoa corrige a URL e salva. A fila tem até 50
trechos, e cada um pode segurá-la por cerca de 47 s (4 × 10 s de timeout + 1 + 2 + 4 s de espera). As
falas novas, já para a URL certa, ficam atrás desses trechos por minutos (no pior caso, dezenas de
minutos).

Além disso, `status.resetSendOutcome()` roda na mudança de config, mas o primeiro `report('retrying')`
ou `report('failed')` de um trecho antigo sobrescreve o reset logo em seguida. A tela volta a mostrar
"Falha ao enviar… tentando de novo" mesmo com a config nova correta. Isso é o mesmo tipo de status falso
que o WR-07 tentou eliminar. A regra do IN-11 ("fala de outro backend é descartada") vale para a janela
(`buildPhraseRequests`), mas não para a fila de envio.

**Correção:** invalidar a fila quando muda o destino (URL, sessão ou chave), com a mesma regra da janela:

```ts
// agenteStreamerInstance.ts
let lastDestinationKey: string | null = null;
const destinationKey = (c: AgenteConfig) => `${c.agenteBackendUrl}\n${c.agenteSessionId}\n${c.agenteApiKey}`;

async function applyConfigChange(config: AgenteConfig): Promise<void> {
  if (disposed) return;
  const key = destinationKey(config);
  if (lastDestinationKey !== null && key !== lastDestinationKey) sender.cancelAll();
  lastDestinationKey = key;
  status.resetSendOutcome();
  ...
}
```

Se o time preferir manter os trechos já liberados para a sessão antiga, então o mínimo é: não reportar
status de trechos de uma "geração de config" anterior, e não segurar os novos atrás deles. Teste semente:
URL A fora do ar com 3 trechos na fila, config muda para URL B, o próximo trecho sai para B sem esperar
os retries de A.

### WR-02: Se a config for corrigida com o service worker dormindo, o erro antigo continua na tela

**Arquivos:** `taqciti/src/background/agenteStreamerInstance.ts:163-189`, `taqciti/src/background/index.ts:41-44`, `taqciti/src/shared/hooks/useAgenteConfigForm.ts:97-140`

**Problema:** quem zera o status (`resetSendOutcome`) é só o listener `onConfigChange` do service worker.
Esse listener é registrado de forma preguiçosa, em `ensureSubscribed()`, depois da cadeia assíncrona
`migrateLocalStorage().then(hydrate).then(resume)`. Ele não é registrado no nível de cima do script. O
fluxo esperado é: a reunião termina com "Último envio recusado: a chave de autenticação não foi aceita
(HTTP 401)", a pessoa cola a chave certa e salva. Nessa hora não há reunião, então o service worker do
MV3 provavelmente já dormiu. O `storage.onChanged` dessa gravação não chega ao listener do streamer:
ou o service worker não acorda, ou acorda e o evento é entregue antes de o listener existir. Como
`taq:agenteStatus` fica em `storage.session` e sobrevive ao reinício do service worker, a tela continua
mostrando o 401 com a chave já corrigida, até o próximo envio de verdade.

**Correção:** zerar o resultado do último envio também do lado de quem grava a config. No hook, depois
de um `patchAgenteConfig` que mexeu em URL, sessão ou chave:

```ts
// useAgenteConfigForm.ts — dentro de save(), após o patch
await patchAgenteStatus(NO_SEND_OUTCOME).catch((err) => logger.error('zerar status do Agente falhou', err));
```

Outra opção é guardar no status um "fingerprint" da config (hash de URL+sessão, sem a chave em claro) e
fazer `describeAgenteStreaming` ignorar um resultado que seja de outra config.

### WR-03: A URL padrão da build não é normalizada, e o runbook afirma o contrário

**Arquivos:** `taqciti/src/shared/config/agenteConfig.ts:17-18`, `taqciti/src/shared/config/agenteConfig.ts:60-66`, `taqciti/src/shared/config/agenteConfig.ts:123-125`, `taqciti/docs/publicar-release.md:90`

**Problema:** a nota nova do IN-06 no runbook diz que, para `VITE_AGENTE_BACKEND_URL`, "a barra no fim
é normalizada". Isso não é verdade. `normalizeAgenteConfig` só normaliza o que vem do storage. Quando o
campo está vazio ou ausente, e esse é justamente o caso de quem nunca abriu a tela e depende do padrão
da build, o código usa `AGENTE_BACKEND_URL_DEFAULT` cru (linha 125). O `DEFAULT_AGENTE_CONFIG` também
usa o valor cru (linha 61). Uma build com `VITE_AGENTE_BACKEND_URL=https://agente.up.railway.app/` (ou com
espaço no fim) manda para `https://agente.up.railway.app//webhook/extension`. O Starlette responde 404
nesse caminho, e aí a tela mostra "Último envio recusado pelo Agente (HTTP 404) — confira o ID da
sessão", uma pista errada. Quem ler o runbook vai confiar que a barra é tratada.

**Correção:** normalizar o padrão na origem e ajustar o texto do runbook:

```ts
export const AGENTE_BACKEND_URL_DEFAULT =
  normalizeAgenteBackendUrl(import.meta.env.VITE_AGENTE_BACKEND_URL ?? '') || 'http://localhost:8000';
```

Para isso, `normalizeAgenteBackendUrl` precisa ser declarada antes da constante ou virar `function`
hoisted, o que ela já é. Vale acrescentar um teste com `vi.stubEnv` e barra no fim.

### WR-04: Trechos que já saíram da janela e estão na fila de reenvio se perdem quando o service worker reinicia, e o status fica "tentando de novo…" para sempre

**Arquivos:** `taqciti/src/background/agenteStreamerInstance.ts:74-86`, `taqciti/src/background/agenteStreamerInstance.ts:111-116`, `taqciti/src/background/agenteSender.ts:37-41`

**Problema:** o WR-02 persiste o cursor e as falas **pendentes na janela**. Só que `drain()` tira a fala
do `pending` e a entrega ao `sender` (que é só memória). Em seguida o `persist(cursor, pending)` grava um
snapshot em que aquelas palavras já contam como enviadas. Se o service worker morrer enquanto o trecho
espera um retry, ele se perde de vez: o cursor avançou e a fila não foi persistida. Isso é bem possível,
porque os `setTimeout` do backoff não mantêm o service worker do MV3 vivo, e isso acontece exatamente no
fim da reunião, quando os flushes param. É a mesma perda que o WR-01 e o WR-02 queriam eliminar, só que
agora no trecho entre a janela e a entrega. De quebra, o último status gravado foi `retrying` em
`storage.session`, e ninguém o substitui depois do reinício. A tela fica "Falha ao enviar… tentando de
novo…" sem que exista tentativa nenhuma rodando.

**Correção:** incluir no snapshot os trechos ainda não entregues. Grave só `{ backendUrl, sessionId,
text, speaker }`, **nunca** o `init` com o header: no restore, remonte o pedido com
`buildPhraseRequests` e a chave da config atual, aplicando o mesmo descarte do IN-11. Se o time aceitar a
perda, então pelo menos no boot (`resume`) grave `lastOutcome: 'failed'` quando o status restaurado for
`retrying`, para a tela não mentir. Nos dois casos, registre a decisão no plano.

### WR-05: "← Voltar" fica sem efeito quando a tela é aberta numa aba nova (Ctrl/Cmd+clique ou clique do meio)

**Arquivos:** `taqciti/src/sidepanel/backNavigation.ts:25-29`, `taqciti/src/sidepanel/screens/AgenteConfigScreen.tsx:37-41`

**Problema:** `canGoBackWithinExtension` só confere se o `document.referrer` é da mesma extensão. Quando
a pessoa abre o link "Agente Diagnóstico · streaming ao vivo" (`HomeScreen.tsx:75-80`) numa aba nova, o
referrer continua sendo a página da extensão, mas o histórico da aba nova só tem uma entrada. O handler
chama `preventDefault()` e depois `history.back()`, que não faz nada. O botão fica morto e o `href="?"`,
que funcionaria, nunca roda.

**Correção:** exigir que exista uma entrada anterior no histórico:

```ts
function handleBackClick(event: MouseEvent<HTMLAnchorElement>): void {
  if (window.history.length <= 1) return;
  if (!canGoBackWithinExtension(document.referrer, window.location.href)) return;
  event.preventDefault();
  window.history.back();
}
```

Pode ser como parâmetro da função pura (`historyLength`), para continuar testável. Vale acrescentar um
caso em `AgenteConfigScreenBack.test.tsx`.

## Info

### IN-01: O caminho de compatibilidade "fala sem `backendUrl`" é código morto, e se algum dia rodar reabre o IN-11

**Arquivo:** `taqciti/src/features/agente/phraseBatcher.ts:32-37`, `taqciti/src/features/agente/phraseBatcher.ts:162-169`

**Problema:** o fallback manda uma fala sem `backendUrl` para a URL da config **atual**, com a chave
atual. Isso é justamente o vazamento que o IN-11 fechou (uma fala acumulada para o backend A saindo com a
chave de B, para B). Hoje esse caminho não é alcançável: o snapshot fica em `storage.session`, que é
apagado quando a extensão é atualizada ou recarregada e quando o navegador fecha. Então nunca existe um
snapshot "do formato antigo" rodando com o código novo.

**Correção:** tornar `backendUrl` obrigatório e descartar, no `restoreOnce`, a fala que vier sem esse
campo, em vez de mandá-la para a URL atual.

### IN-02: O toggle aceita clique antes de a config carregar e mostra "desligado" mesmo quando o streaming está ligado

**Arquivo:** `taqciti/src/sidepanel/screens/AgenteConfigScreen.tsx:82-86`

**Problema:** `checked={config?.streamingEnabled ?? false}` sem `disabled`. Por alguns milissegundos o
toggle aparece desligado e aceita clique, que grava `streamingEnabled: true` sem conhecer o valor real.
A mensagem "Carregando configuração…" do C11 aparece, mas o controle continua ativo.

**Correção:** `disabled={config === null}` no `<Toggle>`.

### IN-03: Salvar só com espaços no campo da chave não faz nada nem avisa

**Arquivo:** `taqciti/src/shared/hooks/useAgenteConfigForm.ts:107-113`

**Problema:** a chave com `trim()` vazio é filtrada do patch. Se ela era o único campo editado, `save()`
retorna em silêncio: sem "Salvo!", sem erro, e os pontinhos continuam no campo. A pessoa acha que trocou
a chave.

**Correção:** nesse caso, limpar o rascunho da chave e marcar o campo como não editado (ou mostrar um
aviso).

### IN-04: A fala descartada por ter outro backend não deixa rastro

**Arquivo:** `taqciti/src/features/agente/phraseBatcher.ts:162-163`

**Problema:** o `filter` do IN-11 joga texto de reunião fora em silêncio. O descarte por fila cheia é
logado (`agenteSender.ts:100`), mas este não. Quando alguém reclamar de "trecho que sumiu", não haverá
pista nenhuma.

**Correção:** contar os descartados e fazer um `logger.warn`, sem o texto, no chamador (`drain`), já que
`phraseBatcher` é puro.

### IN-05: Sessão inexistente vira HTTP 500 no backend, é tratada como falha temporária e gera reenvio e mensagem enganosa

**Arquivos:** `taqciti/src/features/agente/sendRetryPolicy.ts:35-40`, `taqciti/src/shared/config/agenteStatus.ts:114-118`

**Problema:** um `session_id` com formato de UUID válido, mas que não existe, provavelmente quebra a FK
de `transcript_chunks` no insert do Supabase (`webhook.py:40-44`) e volta como 500. A política trata isso
como retryable: 4 envios por trecho, e depois "falhou… (HTTP 500)". A orientação útil ("confira o ID da
sessão") nunca aparece. A correção é de contrato, do lado do backend: responder 404 para sessão
desconhecida.

**Correção:** registrar como pendência do backend. Do lado do cliente, nada a mudar agora.

### IN-06: `baixarDocumento.ts` tem caracteres de controle literais na regex, e por isso o git trata o arquivo como binário

**Arquivo:** `taqciti/src/document/baixarDocumento.ts:26`

**Problema:** a regex `CONTROLE` foi escrita com os bytes NUL–US e DEL crus. O `git diff` mostra
`Bin 4265 -> 4220 bytes`, então nenhuma mudança nesse arquivo aparece em revisão ou PR. A remoção do
`eslint-disable` está correta: o `eslint.config.js` só estende `tseslint.configs.recommended`, que não
liga a regra `no-control-regex`, então a diretiva não servia para nada. O problema de legibilidade
continua.

**Correção:** `const CONTROLE = /[\u0000-\u001f\u007f]/g;`. Com a configuração atual do lint, não
precisa de diretiva.

---

_Revisado: 2026-09-29T20:30:00Z_
_Revisor: Claude (gsd-code-reviewer)_
_Profundidade: standard_
