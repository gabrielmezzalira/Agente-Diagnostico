# Fase 10: AGP Question Panel in Taqciti - Mapa de Padrões

**Mapeado em:** 2026-10-28
**Arquivos analisados:** 22 (6 novos, 16 modificados/estendidos)
**Analogs encontrados:** 22 / 22 (todos em `taqciti/src/`, todos rastreados pelo git; nenhum espelho `.gsd/capabilities`)

Fase de fechamento de lacunas: os melhores analogs são os próprios arquivos existentes e seus testes. Backend somente leitura. Todos os caminhos abaixo são relativos a `taqciti/`.

## Classificação dos arquivos

| Arquivo novo/modificado | Papel | Fluxo de dados | Analog mais próximo | Qualidade |
|---|---|---|---|---|
| `src/background/agenteBindResume.ts` (D-02, modif.) | service (regra de preparo) | request-response | ele mesmo (+ `agenteFreshStart.ts:19-25` para `isClosing`) | exato |
| `src/background/agenteBindFlow.ts` / `agenteAssociation.ts` (D-02, ligação) | composição | request-response | `agenteAssociation.ts` (import de `agenteSessionFinisher`, linha 20) | exato |
| `src/background/agenteBindFlow.test.ts` (D-02, estende) | teste | request-response | bloco "continuar o envio" (`setupStopped`, ~640-833) | exato |
| `src/background/meetingRoomTabs.ts` (D-03, NOVO) | porta/adaptador de `chrome.tabs` | request-response | `injectPanel.ts:106` (`chrome.tabs.query({})`) + `meetingTabNavigated.ts:30` | role-match |
| `src/background/meetingRoomTabs.test.ts` (NOVO) | teste | request-response | `injectPanel.test.ts` + `installChromeStorageMock({ extra })` | role-match |
| `src/background/meetingTabClosed.ts`, `meetingTabNavigated.ts` (D-03, modif.) | regra pura c/ portas injetadas | event-driven | eles mesmos | exato |
| `src/features/meeting/machine.ts` (D-03, evento novo) | máquina de estados pura | event-driven | `MEETING_DETECTED`, ramo mesma-sala (205-219) | exato |
| `meetingTabClosed*.test.ts`, `meetingTabNavigated*.test.ts`, `machine.test.ts` (estendem) | teste | event-driven | eles mesmos | exato |
| `manifest.config.ts` (D-04, +`'tabs'`) | config | n/a | ele mesmo (linha ~155) | exato |
| `src/manifest.test.ts` (NOVO) | teste de config | n/a | `agpBackendSmoke.test.ts` (cabeçalho `@vitest-environment node`) | partial |
| `src/features/agente/agpTarget.ts` (D-11) | regra pura | transform | ele mesmo (`selectAgpTarget`) | exato |
| `src/background/agpQuestionsFeedInstance.ts`, `agpQuestionsFeed.ts` (D-11) | composição / dono do WS | event-driven + streaming | eles mesmos | exato |
| `src/shared/config/agpQuestionsStore.ts` (M-1) | store | CRUD (storage.local) | ele mesmo (linhas 14, 25, 33) | exato |
| `agpTarget.test.ts`, `agpQuestionsFeed.test.ts`, `agpQuestionsStore.test.ts`, `agpBackendSmoke.test.ts` | teste | event-driven | rig em `agpQuestionsFeed.test.ts:35-50` | exato |
| `src/sidepanel/components/AgpQuestionsPanel.tsx`, `AgpLiveTabs.tsx` (M-1..M-6) + testes | componente | request-response (props) | eles mesmos | exato |
| `src/background/index.test.ts` (NOVO, antes do D-05) | teste de caracterização | event-driven | `agenteSessionFinisher.test.ts:16` (chrome via `extra`) + `agenteBindFlow.test.ts:76-111` (`setup`) | role-match |
| `src/background/bootstrap.ts`, `browserListeners.ts`, `messageRouter.ts` (D-05, NOVOS) | composição | event-driven | `agpQuestionsFeedInstance.ts:48-53` (`registerX(ready)`) | role-match |

## Atribuições de padrão

### D-02: `agenteBindResume.ts` (service, request-response)

**Analog:** o próprio arquivo, `prepareResume` (linhas 39-71). A checagem entra **antes** de `applyAssociationEvent(... 'send-resumed')` (linha 59), junto da guarda da linha 47.

**Dependências hoje** (linhas 21-24):
```typescript
export interface ResumeDeps {
  getRecord: (meetingId: string) => Promise<MeetingRecord | null>;
  loadConfig: () => Promise<AgenteConfig>;
}
```
Acrescentar `isClosing: (meetingId: string) => boolean` (opcional com padrão `() => false`, para não quebrar fixtures).

**Guarda a estender** (linhas 44-49, 59):
```typescript
const association = await getAssociation(meetingId);
if (association === null) return { failure: bindFail('not-found') };
const { sessionId } = association;
if (association.state !== 'send-failed' || sessionId === undefined || live) {
  return { failure: bindFail('invalid-state') };
}
...
const resumed = await applyAssociationEvent(meetingId, { type: 'send-resumed' });
```
Nova linha sugerida: `if (deps.isClosing?.(meetingId) === true) return { failure: bindFail('invalid-state') };` antes da linha 59. NÃO recusar por `sessionFinished` (contradiz DA-2, teste da linha 743).

**Ligação de produção:** `agenteAssociation.ts` já importa `agenteSessionFinisher` (linha 20); usar `isClosing: (id) => agenteSessionFinisher.isClosing(id)` (precedente `agenteFreshStart.ts:19-25`).

**Teste a estender** (`agenteBindFlow.test.ts`): `setup()` (linhas 76-111) monta `createBindFlow({ directory, sessions, getMeetingState, getRecord, loadConfig, send, sleep, onLinked, onSettled })`; adicionar `isClosing` ao `SetupOptions`/`createBindFlow`. Teste novo no molde da linha 784-790:
```typescript
const { flow, store, world, send } = await setupStopped();
send.mockClear();
expect(await flow.resumeSend('m2')).toEqual({ ok: false, error: 'invalid-state' });
```
com `isClosing: () => true`; afirmar também `finishBy`/`finishTries` intactos e `send` não chamado.

### D-03: `meetingRoomTabs.ts` (NOVO, porta sobre `chrome.tabs`)

**Analogs:** `injectPanel.ts:106` (`const tabs = await chrome.tabs.query({});`) e `isStillInMeetingRoom` (`meetingTabNavigated.ts:30-40`).

**Regra reaproveitada** (não escrever outra regex):
```typescript
export function isStillInMeetingRoom(url: string, meetingCode: string): boolean {
  let parsed: URL;
  try { parsed = new URL(url); } catch { return false; }
  if (parsed.hostname !== MEET_HOST) return false;
  const roomCode = meetingCodeFromPath(parsed.pathname, { allowSubpath: true });
  return roomCode !== null && roomCode.toLowerCase() === meetingCode.toLowerCase();
}
```
Mover para módulo comum evita ciclo (`meetingRoomTabs` -> `meetingTabNavigated` -> `meetingRoomTabs`). Forma sugerida:
`export async function findOtherRoomTab(meetingCode: string, excludeTabId: number): Promise<number | null>` usando `chrome.tabs.query({ url: '*://meet.google.com/*' })`, descartando `excludeTabId`. Não gravar nem logar `tab.url` (LGPD).

**Teste:** `installChromeStorageMock({ extra: { tabs: { query: vi.fn(async () => [...]) } } })` (`chromeStorageMock.ts:71-104`, `extra` é mesclado no `chrome` global). Cobrir cenários (a)-(g) do RESEARCH, inclusive consulta que rejeita.

### D-03: `meetingTabClosed.ts` e `meetingTabNavigated.ts` (regra pura, event-driven)

**Padrão de deps injetadas** (`meetingTabClosed.ts:19-24`; `meetingTabNavigated.ts:20-25` idêntico):
```typescript
export interface MeetingTabClosedDeps {
  getState: () => MeetingState;
  dispatch: (event: MeetingEvent) => Promise<unknown>;
  /** Relógio injetado; o padrão é `Date.now`. */
  now?: () => number;
}
```
Acrescentar `otherRoomTabId?: (meetingCode: string, excludeTabId: number) => Promise<number | null>` (padrão `async () => null` mantém os testes atuais verdes).

**Ponto de inserção** (closed, 30-35; navigated, 49-52):
```typescript
if (current.session?.tabId !== tabId) return;
switch (current.phase) {
  case 'captionsRequired': case 'recording': case 'paused':
    await deps.dispatch({ type: 'MEETING_FINISHED', at: (deps.now ?? Date.now)() });
```
Antes do `MEETING_FINISHED`: se há outra aba, `dispatch({ type: 'MEETING_TAB_CHANGED', tabId: other })` e `return`. No `closed`, "outra aba" = qualquer da sala; no `navigated`, só se a aba que saiu deixou a sala (após `isStillInMeetingRoom` falso).

**Testes:** molde de `meetingTabClosed.test.ts:34-41`:
```typescript
function stateOf(phase: MeetingPhase, tabId: number | null = 7): MeetingState { return { phase, session: session(tabId) }; }
function setup(state: MeetingState) {
  const dispatch = vi.fn(() => Promise.resolve(state));
  return { dispatch, deps: { getState: () => state, dispatch, now: () => NOW } };
}
```
e, para a sequência (c) (fecha dona, depois a restante, encerra uma vez), molde de `meetingTabNavigatedFlow.test.ts:27-35` com a máquina real:
```typescript
function liveMeeting() {
  let state: MeetingState = transition(IDLE_STATE, detected);
  const dispatch = (event: MeetingEvent) => { state = transition(state, event); return Promise.resolve(state); };
  return { current: () => state, deps: { getState: () => state, dispatch, now: () => NOW } };
}
```

### D-03: `features/meeting/machine.ts` (evento novo)

**Analog:** ramo mesma-sala de `MEETING_DETECTED` (linhas 205-219) e a união `MeetingEvent` (linhas 42-72, termina em `| { type: 'MEETING_FINISHED'; at: number } | { type: 'RESET' };`).
```typescript
if (isActive(state) && current?.meetingCode === event.meetingCode) {
  const next = withSession(state, { tabId: event.tabId, captionsEnabled: event.captionsEnabled });
```
Novo: `| { type: 'MEETING_TAB_CHANGED'; tabId: number }` na união e `case 'MEETING_TAB_CHANGED': return isActive(state) ? withSession(state, { tabId: event.tabId }) : state;`. Testes em `machine.test.ts` (padrão de tabela de eventos já existente). Não reaproveitar `MEETING_DETECTED`.

### D-04: `manifest.config.ts` e `src/manifest.test.ts` (NOVO)

**Analog:** `manifest.config.ts` (permissões, ~linha 155; `host_permissions` ~173):
```typescript
permissions: ['storage', 'sidePanel', 'scripting', 'identity', 'alarms'],
...
host_permissions: ['<all_urls>'],
```
Acrescentar `'tabs'` com comentário (mesmo estilo longo dos comentários vizinhos). Commit isolado.

**Teste (NOVO):** `defineManifest` é identidade, então importar `../manifest.config`. Cabeçalho como em `agpBackendSmoke.test.ts:1` (`// @vitest-environment node`) caso o import sob jsdom pese. Afirmar `permissions` contém `'tabs'` e `host_permissions` contém `'<all_urls>'` (a segunda justifica "sem aviso novo"). Atenção: `vitest.config.ts` inclui `src/**/*.test.{ts,tsx}`, então o arquivo fica em `src/manifest.test.ts`. Não há analog exato de teste de manifesto (match parcial).

### D-11: `agpTarget.ts` (regra pura, transform)

**Analog:** `selectAgpTarget` (linhas 17-27), mantida e testada por `agpTarget.test.ts`; compor por cima.
```typescript
export function selectAgpTarget(associations, liveMeetingId: string | null): AgpTarget | null {
  if (liveMeetingId === null) return null;
  const association = associations[liveMeetingId];
  if (association === undefined) return null;
  if (association.origin === undefined || association.sessionId === undefined) return null;
  if (association.state !== 'linked' || association.sessionFinished === true) return null;
  return { meetingId: liveMeetingId, sessionId: association.sessionId };
}
```
Nova função pura `decideAgpFollow(associations, phase, liveMeetingId, streamingEnabled)` devolvendo união discriminada `{ kind: 'follow' | 'hold' | 'none' }`, implementando a tabela do RESEARCH (follow só em `recording` + `streamingEnabled`). Teste de tabela no estilo de `agpTarget.test.ts`.

### D-11: `agpQuestionsFeedInstance.ts` (composição)

**Analog:** o próprio arquivo, linhas 24-31 e 48-53:
```typescript
async function selectTarget(): Promise<AgpFeedTarget | null> {
  const state = getState();
  const liveMeetingId = isLivePhase(state) ? (state.session?.meetingId ?? null) : null;
  const target = selectAgpTarget(await loadAssociations(), liveMeetingId);
  if (target === null) return null;
  const url = buildAgpSocketUrl((await readConfig()).agenteBackendUrl, target.sessionId);
  return url === null ? null : { sessionId: target.sessionId, url };
}
export function registerAgpQuestionsFeed(ready: Promise<void>): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (changesTarget(changes, area)) void ready.then(() => agpQuestionsFeed.reconcile());
  });
  void ready.then(() => agpQuestionsFeed.reconcile());
}
```
`readConfig()` já devolve `streamingEnabled`; a config já dispara reconciliação (`STORAGE_KEYS.agenteConfig in changes`). Acrescentar `readStored: loadAgpFeed` às deps do feed (armadilha 2).

### D-11: `agpQuestionsFeed.ts` e testes (rig)

**Rig a estender** (`agpQuestionsFeed.test.ts:35-50`; `selectTarget` hoje devolve `AgpFeedTarget | null`, passará a devolver follow/hold/none; atualizar também `agpBackendSmoke.test.ts:48-55`):
```typescript
function rig() {
  let current: AgpFeedTarget | null = null;
  const feed = createAgpQuestionsFeed({
    selectTarget: () => Promise.resolve(current),
    openSocket: (url) => { const s = new FakeSocket(url); sockets.push(s); return s; },
    write: (value) => { writes.push(value); return Promise.resolve(); },
    setTimer: ..., clearTimer: ...,
  });
```
`FakeSocket implements AgpSocket` (linhas 23-33, sem `send` do lado do cliente: invariante D-12 nº 5). Testar o worker dormindo criando um segundo `createAgpQuestionsFeed` sobre o mesmo storage. Invariantes D-12 (backoff, 4004 sem timer, sem relógio local) não podem mudar.

### M-1: `agpQuestionsStore.ts` (store)

**Analog:** o próprio arquivo, linhas 14, 25, 33. Adicionar `'paused'` ao tipo **e** a `CONNECTIONS` (senão `?? 'idle'` apaga em silêncio):
```typescript
export type AgpConnection = 'idle' | 'connecting' | 'live' | 'reconnecting';
const CONNECTIONS: readonly AgpConnection[] = ['idle', 'connecting', 'live', 'reconnecting'];
const connection = CONNECTIONS.find((candidate) => candidate === record.connection) ?? 'idle';
```
Teste de ida e volta `writeAgpFeed` -> `loadAgpFeed` para cada valor em `agpQuestionsStore.test.ts`.

### UI (M-1..M-6): `AgpQuestionsPanel.tsx`, `AgpLiveTabs.tsx`
Analog: eles mesmos e `HistoryList`/`popup/App.tsx:122` (padrão `scroll-region` + `tabIndex={0}`); lacunas e linhas em RESEARCH "Lacunas do UI-SPEC". Testes `AgpQuestionsPanel.test.tsx` / `AgpLiveTabs.test.tsx` usam `textContent` exato (`'AGP2'`, `'ProdutoPergunta a?'`): não acrescentar texto visível dentro do botão da aba nem do `<li>`.

### D-05: `index.test.ts` (NOVO, antes do corte) + `bootstrap.ts` / `browserListeners.ts` / `messageRouter.ts`

**Analog do teste:** `agenteSessionFinisher.test.ts:16` e o padrão de import dinâmico de `agenteBindFlow.test.ts:76-80`:
```typescript
installChromeStorageMock({ extra: withAlarms ? { alarms } : {} });
const module = await import('./agenteSessionFinisher');
```
No novo teste: `vi.resetModules()`, `installChromeStorageMock({ extra: { runtime: { onInstalled, onStartup, onMessage }, action: { onClicked }, tabs: { onRemoved, onUpdated, query }, alarms: {..., onAlarm} } })` com `addListener = vi.fn()`; `await import('./index')`; afirmar sincronamente cada `addListener` chamado uma vez (onInstalled, action.onClicked, tabs.onRemoved, tabs.onUpdated, runtime.onStartup, alarms.onAlarm, storage.onChanged, runtime.onMessage). Atenção: `onMessage` vem de `@/shared/services/messaging` (não é `chrome.runtime.onMessage` direto; conferir o wrapper antes de simular). Tabela "tipo de mensagem -> porta chamada" para os `case` (`index.ts:166-285`).

**Analog dos módulos de registro:** `registerAgpQuestionsFeed(ready)` (`agpQuestionsFeedInstance.ts:48-53`): cada módulo novo exporta `registerX(ready)` chamado no topo de `index.ts`, sem `await` antes (MV3). Costuras (`index.ts`): bootstrap = 49-76 (exporta `ready`, ordem da cadeia intocada); `browserListeners.ts` = 94-153; `messageRouter.ts` = 155-287 (subdividir por grupo se passar de 200 linhas). O `index.test.ts` deve passar sem edição após o corte; não alterar nenhum `*.test.ts` existente no commit do refator.

**Padrão de listener a copiar** (`index.ts:126-140`):
```typescript
chrome.tabs.onRemoved.addListener((tabId) => {
  void forgetPanelTab(tabId);
  void ready.then(() => onMeetingTabRemoved(tabId, { getState, dispatch, now: Date.now }));
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url === undefined) return;
  const url = changeInfo.url;
  void ready.then(() => onMeetingTabNavigated(tabId, url, { getState, dispatch, now: Date.now }));
});
```
Em D-03 injetar `otherRoomTabId: findOtherRoomTab` nessas duas chamadas.

## Padrões compartilhados

### Portas injetadas, regra pura
**Fonte:** `meetingTabClosed.ts:19-24`, `agpQuestionsFeed.ts` (deps), `agenteBindResume.ts:21-24`.
**Aplicar a:** D-02, D-03, D-11. A regra mora em módulo sem `chrome`; a composição (`*Instance.ts`, `agenteAssociation.ts`, `index.ts`) liga as portas reais. Deps novas opcionais com padrão neutro para não quebrar fixtures.

### Mock do `chrome` em testes
**Fonte:** `src/test/chromeStorageMock.ts:71-106`. `installChromeStorageMock({ local?, session?, extra? })` faz `vi.stubGlobal('chrome', ...)`, com `storage.onChanged` real (gravar dispara listeners) e `alarms` básico; `extra` mescla `tabs`, `runtime`, `action`. Testes que dependem de estado de módulo usam `vi.resetModules()` + `await import(...)` depois do mock.

### Máquina da reunião
**Fonte:** `features/meeting/machine.ts` (`MeetingEvent` na linha 42; `transition` na 203). Toda mudança de `tabId`/fase passa por evento + `dispatch` (flush, broadcast, efeitos). Nunca gravar `taq:state` direto.

### Commits
Correção e refator nunca juntos; `tabs` (D-04) em commit próprio; `index.test.ts` antes do corte do D-05; M-6 (espaçamento) mecânico em commit próprio. Todo plano de task leva as 7 seções do `CLAUDE.md`.

### Privacidade
Com `tabs`, o código novo não pode gravar nem logar URL de aba (nem em `logger`, nem em storage): comparar em memória.

## Sem analog

| Arquivo | Papel | Fluxo | Motivo |
|---|---|---|---|
| `src/manifest.test.ts` | teste de config | n/a | Nenhum teste existente lê o manifesto; usar só o padrão `@vitest-environment node` de `agpBackendSmoke.test.ts`. |
| `index.test.ts` (parte de "listeners síncronos") | caracterização | event-driven | Nenhum teste importa `background/index.ts` hoje (RESEARCH, D-05); montar o mock de `chrome.*.onX.addListener` do zero sobre `installChromeStorageMock`. |

## Metadados

**Escopo de busca:** `taqciti/src/background`, `src/features/{meeting,agente}`, `src/shared/config`, `src/test`, `manifest.config.ts`.
**Rastreamento (#3645):** todos os caminhos citados existem em `taqciti/` e são código rastreado; nenhum é espelho `.gsd/capabilities`.
**Limite:** o RESEARCH foi lido até a linha 373 (de 617); as seções "Exemplos de Código", "Perguntas em aberto" e "Divisão em planos" não foram relidas aqui. Os componentes de UI (`AgpQuestionsPanel.tsx`, `AgpLiveTabs.tsx`) não foram reabertos: use as linhas do RESEARCH (M-1..M-6).
**Data:** 2026-10-28
