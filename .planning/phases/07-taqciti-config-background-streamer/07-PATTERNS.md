# Phase 7: Taqciti Config + Background Streamer - Pattern Map

**Mapped:** 2026-09-25
**Files analyzed:** 6 (novos) + 2 (modificados)
**Analogs found:** 6 / 6

> Nota de escopo: a Task 1 do primeiro plano (`git subtree add --prefix=taqciti ...`) não é um
> arquivo a "codar" — é uma operação de Git. Este mapa cobre os arquivos de código que vêm DEPOIS
> dessa importação. Todo caminho abaixo já está escrito como existirá no repositório após o
> subtree (prefixo `taqciti/`), mesmo que hoje só exista em `../taqciti` (clone read-only usado só
> para leitura de analogs).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `taqciti/src/shared/config/agenteConfig.ts` | config | request-response (constantes lidas em runtime) | `taqciti/src/shared/config/serverConfig.ts` | exact |
| `taqciti/src/shared/config/agenteConfigStore.ts` | store | event-driven (pub-sub via `chrome.storage.onChanged`) | `taqciti/src/features/panel/prefsStore.ts` | exact |
| `taqciti/src/background/agenteStreamer.ts` | service | streaming (event-driven → request-response fire-and-forget) | `extension/background.js` (`TRANSCRIPT_CHUNK` handler) + `taqciti/src/background/sessionController.ts` (ponto de plugagem) | role-match (função) / exact (ponto de plugagem) |
| `taqciti/src/background/agenteStreamer.test.ts` | test | unit | (nenhum teste de `sessionController` ainda lido — ver Vitest conventions em `07-RESEARCH.md`, `taqciti/vitest.config.ts`) | role-match |
| `taqciti/src/sidepanel/screens/AgenteConfigScreen.tsx` | component | request-response (form → store) | `taqciti/src/sidepanel/screens/HomeScreen.tsx` (não lido em detalhe; roteado por `App.tsx`) | role-match |
| `taqciti/src/sidepanel/App.tsx` (modificado) | route | request-response | mesmo arquivo (self) | exact (é o arquivo a estender) |
| `taqciti/src/background/sessionController.ts` (modificado) | service | event-driven | mesmo arquivo (self) — só ganha 1 chamada em `flushState()` | exact |

## Pattern Assignments

### `taqciti/src/shared/config/agenteConfig.ts` (config, request-response)

**Analog:** `taqciti/src/shared/config/serverConfig.ts` (lido integralmente, 34 linhas)

**Padrão completo a espelhar** (`serverConfig.ts:1-34`):
```typescript
export const SERVER_BASE_URL =
  import.meta.env.VITE_DOCCITI_SERVER_URL ?? 'http://localhost:3000';

export const SERVER_SHARED_KEY =
  import.meta.env.VITE_DOCCITI_SHARED_KEY ?? 'taqciti-dev-local';

export const SERVER_SHARED_KEY_HEADER = 'x-docciti-key';
```

**Adaptação (D-08/D-09/D-10) — diferença importante a documentar no arquivo novo:**
`SERVER_SHARED_KEY` tem valor-padrão público (comentário explica: é intencional, serve só pra
barrar uso acidental de um servidor local de dev). A chave do Agente **não pode** seguir esse
padrão — D-10 e a seção "Known Threat Patterns" do RESEARCH.md são explícitos: nenhum valor-padrão
embutido no bundle para `x-agente-key`. Esboço:
```typescript
export const AGENTE_BACKEND_URL_DEFAULT =
  import.meta.env.VITE_AGENTE_BACKEND_URL ?? 'http://localhost:8000';

export const AGENTE_STREAMING_ENABLED_DEFAULT =
  (import.meta.env.VITE_AGENTE_STREAMING_ENABLED ?? 'false') === 'true'; // D-09: OFF por padrão

export const AGENTE_KEY_HEADER = 'x-agente-key'; // espelha backend/app/routers/webhook.py:20-27 (D-10)
// SEM AGENTE_KEY_DEFAULT — a chave só existe no storage runtime (agenteConfigStore.ts),
// nunca hardcoded no bundle.
```

---

### `taqciti/src/shared/config/agenteConfigStore.ts` (store, event-driven)

**Analog:** `taqciti/src/features/panel/prefsStore.ts` (lido integralmente, 117 linhas)

**Fila de escrita (patch, não objeto inteiro)** — `prefsStore.ts:57-64`:
```typescript
export function patchPanelPrefs(patch: Partial<PanelPrefs>): Promise<PanelPrefs> {
  queue = queue.then(async () => {
    const next = normalizePanelPrefs({ ...(await loadPanelPrefs()), ...patch });
    await writeLocal(STORAGE_KEYS.prefs, next);
    return next;
  });
  return queue;
}
```

**Assinatura multi-contexto via `chrome.storage.onChanged`** — `prefsStore.ts:92-116`:
```typescript
export function subscribePanelPrefs(onPrefs: (prefs: PanelPrefs) => void): Unsubscribe {
  let live = true;
  void loadPanelPrefs().then((prefs) => { if (live) onPrefs(prefs); });

  const listener = (changes, area) => {
    if (!live || area !== 'local' || !(STORAGE_KEYS.prefs in changes)) return;
    onPrefs(normalizePanelPrefs((changes[STORAGE_KEYS.prefs]?.newValue) ?? null));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => { live = false; chrome.storage.onChanged.removeListener(listener); };
}
```

**Seed explícito na instalação** — `prefsStore.ts:77-83` (`ensurePanelPrefs`): garante que a
primeira execução não seja um caso especial (chave ausente nunca dispara `onChanged`). Aplicar o
mesmo padrão a `ensureAgenteConfig()`.

**Adaptação necessária:** nova chave de storage própria (não reaproveitar `STORAGE_KEYS.prefs`) —
adicionar `agenteConfig` em `taqciti/src/shared/config/constants.ts::STORAGE_KEYS` (mesmo objeto
onde já vive `STORAGE_KEYS.prefs`/`STORAGE_KEYS.state`). Shape sugerido do valor guardado:
`{ agenteBackendUrl, streamingEnabled, agenteSessionId, agenteApiKey }` (D-04/D-08/D-09/D-10).

---

### `taqciti/src/background/agenteStreamer.ts` (service, streaming/event-driven)

**Analog 1 — ponto de plugagem exato:** `taqciti/src/background/sessionController.ts:161-196`
(lido integralmente nesta sessão de research):
```typescript
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function isCoalescable(event: MeetingEvent): boolean {
  return event.type === 'CAPTION_CHUNK';
}

async function flushState(): Promise<void> {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await writeSession(STORAGE_KEYS.state, state);
  broadcast();
  // ★ NOVO nesta fase: chamar aqui, fire-and-forget:
  // void onSessionFlushed(state).catch((error) => logger.error('streamer do Agente falhou', error));
}

function scheduleFlush(): void {
  if (flushTimer !== null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushState().catch((error) => logger.error('flush do estado falhou', error));
  }, STATE_FLUSH_INTERVAL_MS);
}

// dispatch():
if (isCoalescable(event)) {
  scheduleFlush();
} else {
  await flushState();
}
```
Import relevante já presente no topo do arquivo (`sessionController.ts:16-22`):
```typescript
import { buildMeetingRecord } from '@/features/meeting/payload';
import {
  LIVE_SAVE_THROTTLE_MS,
  STATE_FLUSH_INTERVAL_MS,
  STORAGE_KEYS,
} from '@/shared/config/constants';
import { readSession, writeSession } from '@/shared/services/storage';
```

**`LiveSegment`/`captionId`** — `taqciti/src/shared/types/domain.ts:107-118`:
```typescript
/** Fatia de legenda emitida pelo provider. `captionId` é estável por linha de
 * legenda [...] */
export interface TranscriptSegment {
  captionId: string;
  // ... demais campos de texto/falante
}

/** Segmento em construção; `captionId` é interno e removido no payload final. */
export interface LiveSegment extends TranscriptSegment {
  captionId: string;
}
```
`captionId` é estável só **dentro** de uma sessão — não confiar nele sozinho para detectar sessão
nova; comparar `state.session?.meetingId` (Pitfall 4 do RESEARCH.md) para resetar o `Map` do
streamer.

**Analog 2 — diff palavra-a-palavra a espelhar (D-07):** `extension/content_meet.js:96-127`
(`emitNew()`, lido integralmente):
```javascript
// Emite só as PALAVRAS NOVAS no fim da legenda, ignorando o que já foi enviado
function emitNew() {
  if (!currentText) return
  const words = currentText.replace(/\n/g, ' ').split(/\s+/).filter(Boolean)
  if (!words.length) return

  let startIdx = 0
  if (emittedTail.length) {
    let found = false
    for (let aLen = Math.min(ANCHOR, emittedTail.length); aLen >= 1 && !found; aLen--) {
      const anchor = emittedTail.slice(-aLen).map(norm).join(' ')
      for (let i = words.length - aLen; i >= 0; i--) {
        if (words.slice(i, i + aLen).map(norm).join(' ') === anchor) {
          startIdx = i + aLen
          found = true
          break
        }
      }
    }
  }

  const newWords = words.slice(startIdx)
  if (!newWords.length) return

  emittedTail = emittedTail.concat(newWords).slice(-TAIL_KEEP)
  lastEmitTs = Date.now()

  const text = newWords.join(' ').trim()
  if (!text || isNoise(text)) return
  safeSend({ type: 'TRANSCRIPT_CHUNK', text, speaker: currentSpeaker })
}
```
**Adaptação obrigatória (não copiar 1:1):** este código tem UM `currentText`/`emittedTail` global
(uma fala de cada vez). A Taqciti tem múltiplos `LiveSegment` simultâneos — trocar a variável única
por `Map<captionId, wordsSentCount>`, um contador por segmento (esboço já no RESEARCH.md, seção
"Pattern 2").

**Analog 3 — envio HTTP + header condicional + fire-and-forget:** `extension/background.js:112-132`
(handler `TRANSCRIPT_CHUNK`, lido integralmente):
```javascript
if (msg.type === 'TRANSCRIPT_CHUNK') {
  if (!state.sessionId) {
    sendResponse({ ok: false, reason: 'no session' })
    return
  }
  const url = `${normalizeUrl(state.backendUrl)}/webhook/extension`
  const headers = { 'Content-Type': 'application/json' }
  if (state.extensionKey) headers['x-agente-key'] = state.extensionKey
  fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      session_id: state.sessionId,
      text: msg.text,
      speaker: msg.speaker || null
    })
  })
  .then(r => sendResponse({ ok: r.ok, status: r.status }))
  .catch(e => sendResponse({ ok: false, error: e.message }))
  return
}
```
Pontos a copiar: (1) header `x-agente-key` só é adicionado se a chave não for vazia (linha 119);
(2) gate por `session_id` ausente vira `no-op silencioso, log` no streamer novo (D-04: sem
`session_id` preenchido, não há para onde mandar — mas aqui não há UI de callback, é fire-and-forget
puro dentro de `flushState()`, então o "retorno" é só logging, sem `sendResponse`); (3) `normalizeUrl`
(`background.js:13-19`) é o padrão de validação de URL citado na seção "Security Domain / V5" do
RESEARCH.md — reaproveitar a mesma lógica (trim, remove barra final, força `https://` se faltar
protocolo) dentro de `agenteConfig`/`agenteStreamer`.

**Contrato do backend (não muda, só respeitado)** — `backend/app/routers/webhook.py:14-52`:
```python
class ExtensionChunk(BaseModel):
    session_id: str
    text: str
    speaker: str | None = None


def verify_extension_key(x_agente_key: str | None = Header(default=None)) -> None:
    """Gate opcional por shared-secret. Sem EXTENSION_SHARED_KEY configurada,
    a rota se comporta exatamente como hoje (TAQ-03 / D-01)."""
    expected = os.environ.get("EXTENSION_SHARED_KEY", "")
    if not expected:
        return
    if not x_agente_key or not secrets.compare_digest(x_agente_key, expected):
        raise HTTPException(status_code=401, detail="Missing or invalid x-agente-key header")


@router.post("/extension", status_code=202)
async def extension_webhook(
    payload: ExtensionChunk,
    db: Client = Depends(get_supabase),
    _: None = Depends(verify_extension_key),
):
    if not payload.text.strip():
        return {"accepted": True}
    db.table("transcript_chunks").insert({
        "session_id": payload.session_id,
        "speaker": payload.speaker,
        "text": payload.text.strip(),
    }).execute()
    from app.services.pipeline import pipeline_manager
    asyncio.create_task(
        pipeline_manager.push_chunk(payload.session_id, payload.text.strip(), payload.speaker)
    )
    return {"accepted": True}
```
Body a enviar: `{ "session_id": str, "text": str, "speaker": str | null }`. Texto vazio após
`strip()` é aceito e simplesmente não gera insert nem push — o streamer não precisa checar
"texto vazio" antes de enviar (mas deve evitar chamadas desnecessárias por economia, não por
correção).

**Error handling:** fire-and-forget — nunca `await` bloqueante no caminho de `flushState()`.
Seguir o padrão já usado no próprio arquivo para o flush (`.catch((error) => logger.error(...))`,
`sessionController.ts:180`) e no backend (`asyncio.create_task`, nunca bloqueia o insert).

---

### `taqciti/src/background/agenteStreamer.test.ts` (test, unit)

**Convenção de teste (Vitest + jsdom):** `taqciti/vitest.config.ts` (ambiente `jsdom`,
`include: ['src/**/*.test.{ts,tsx}']`, alias `@` → `taqciti/src`). Comando de execução:
`cd taqciti && npx vitest run src/background/agenteStreamer.test.ts`.
Casos mínimos (do RESEARCH.md, seção "Phase Requirements → Test Map"):
1. diff calcula texto novo corretamente por `captionId`, incluindo reescrita de fim de segmento;
2. múltiplos segmentos concorrentes não vazam contagem entre si;
3. reset do `Map` quando `meetingId` muda entre flushes;
4. `fetch` só dispara com `streamingEnabled=true` E `session_id` preenchido (D-09);
5. header `x-agente-key` omitido quando a chave está vazia, presente quando preenchida (D-10).

**Nenhum arquivo de teste existente foi encontrado para `sessionController.ts` nem para
`prefsStore.ts`** neste levantamento (não achei `*.test.ts` correspondente lido nesta sessão) — usar
a convenção geral do `vitest.config.ts` e mockar `chrome.storage`/`fetch` global (padrão comum em
extensões MV3 com Vitest + jsdom: `vi.stubGlobal('chrome', {...})` / `vi.stubGlobal('fetch', vi.fn())`).

---

### `taqciti/src/sidepanel/screens/AgenteConfigScreen.tsx` (component, request-response)

**Analog (roteamento):** `taqciti/src/sidepanel/App.tsx` (lido integralmente, 52 linhas) — roteia
por `state.phase`, nunca decide transição:
```tsx
export function App() {
  const state = useMeetingState();
  const request = useMemo(() => readWideViewRequest(window.location.search), []);
  if (request.history) return <HomeScreen initialRecordId={request.recordId} />;

  switch (state.phase) {
    case 'idle': return <HomeScreen />;
    case 'captionsRequired':
      if (!state.session) return <HomeScreen />;
      return <LiveScreen session={state.session} phase="preparing" />;
    case 'recording':
    case 'paused':
      if (!state.session) return <HomeScreen />;
      return <LiveScreen session={state.session} phase={state.phase === 'paused' ? 'paused' : 'recording'} />;
    case 'ended':
      if (!state.session) return <HomeScreen />;
      return <SummaryScreen session={state.session} />;
  }
}
```
**Adaptação (Open Question 2 do RESEARCH.md, decisão já tomada lá):** não existe hoje rota de
"config" nem `kind: 'config'` em `PanelRoute` — a busca nesta sessão não encontrou o tipo
`PanelRoute` em `App.tsx` (o roteamento aqui é 100% por `state.phase` da máquina de estados, não por
um enum de rota separado). A forma mais direta de expor a tela de config sem interferir no fluxo de
gravação é um `request.*` adicional em `readWideViewRequest`/`route.ts` (mesmo mecanismo que já trata
`request.history`), OU um botão/link em `HomeScreen` que muda `window.location.search` para abrir a
tela em modo "config" antes de qualquer `state.phase` decidir. Nome exato e mecanismo ficam a
critério do executor (Claude's Discretion, D-08/D-09/D-10 do CONTEXT.md) — mas **não** usar
`default_popup` (ver RESEARCH.md, "Anti-Patterns"/"Open Question 2": o manifest documenta
propositalmente a ausência disso).

**Campos do form:** `agenteBackendUrl` (text), `streamingEnabled` (toggle), `agenteSessionId` (text,
D-04), `agenteApiKey` (password-like input). Ler/escrever via `agenteConfigStore.ts`
(`loadAgenteConfig`/`patchAgenteConfig`/`subscribeAgenteConfig`, espelhando `prefsStore.ts`). Padrão
visual de referência mais próximo no repo antigo: `extension/popup.html` + `extension/popup.js`
(input + botão salvar) — mas preferir o fluxo reativo de `prefsStore.ts` (sem polling) em vez do
`chrome.runtime.sendMessage({type:'GET_STATE'})` do popup antigo.

## Shared Patterns

### Fire-and-forget / non-blocking (todo o projeto)
**Source:** `backend/app/routers/webhook.py:47-50` (`asyncio.create_task`) e
`taqciti/src/background/sessionController.ts:180` (`.catch(logger.error)`).
**Apply to:** `agenteStreamer.ts` — o `fetch` ao `/webhook/extension` nunca deve ser `await`-ado de
forma bloqueante dentro de `flushState()`; erro de rede só vira log, nunca atrasa `writeSession`/
`broadcast()` nem trava a captura do Meet.

### Autenticação opcional por header (`x-agente-key`)
**Source:** `backend/app/routers/webhook.py:20-27` (`verify_extension_key`) +
`extension/background.js:119` (`if (state.extensionKey) headers['x-agente-key'] = ...`).
**Apply to:** `agenteStreamer.ts` — mesmíssima regra: campo vazio = header omitido = comportamento
de hoje (D-10). Nenhum valor-padrão embutido (diferente de `SERVER_SHARED_KEY`).

### Config runtime multi-contexto (fila + `onChanged`, sem polling)
**Source:** `taqciti/src/features/panel/prefsStore.ts:43-116` (fila de escrita + assinatura).
**Apply to:** `agenteConfigStore.ts` e qualquer componente (`AgenteConfigScreen.tsx`,
`agenteStreamer.ts`) que precise ler a config mais recente sem duplicar estado local.

### Validação de URL antes do `fetch`
**Source:** `extension/background.js:13-19` (`normalizeUrl`).
**Apply to:** `agenteConfig.ts`/`agenteStreamer.ts` — normalizar `agenteBackendUrl` (trim, remove
barra final, força `https://` se faltar protocolo) antes de montar a URL do `fetch`, mesmo padrão
citado em RESEARCH.md § "Security Domain / V5 Input Validation".

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `taqciti/src/background/agenteStreamer.test.ts` | test | unit | Nenhum `*.test.ts` de `sessionController.ts`/`prefsStore.ts` foi localizado nesta sessão para copiar estrutura exata de mocks de `chrome.*`/`fetch`; usar convenção geral do `vitest.config.ts` (jsdom) e padrões usuais de Vitest para MV3 (`vi.stubGlobal`) |

## Metadata

**Analog search scope:** `../taqciti` (clone read-only, branch `main`, HEAD `c41309a`) —
`src/background/`, `src/shared/config/`, `src/shared/types/`, `src/features/panel/`,
`src/sidepanel/`; este repositório — `extension/`, `backend/app/routers/webhook.py`.
**Files scanned:** `serverConfig.ts`, `prefsStore.ts`, `sessionController.ts`, `domain.ts`,
`sidepanel/App.tsx`, `extension/content_meet.js`, `extension/background.js`,
`backend/app/routers/webhook.py` — todos lidos integralmente ou em trechos não sobrepostos nesta
sessão e na sessão de research anterior (07-RESEARCH.md).
**Pattern extraction date:** 2026-09-25
