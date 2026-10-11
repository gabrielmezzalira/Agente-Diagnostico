# Fase 8: Taqciti Session Association - Mapa de Padrões

**Mapeado:** 2026-10-11
**Arquivos analisados:** 31 (novos/modificados)
**Analogs encontrados:** 28 / 31
**Gate de rastreio (#3645):** todos os analogs abaixo foram conferidos com `git ls-files` (tracked). Nenhum caminho é espelho gitignorado.

> Regra para o planejador: o código novo nasce em camadas (router -> service -> repository no backend; componente apresentacional + hook + service worker na Taqciti). Nada de lógica nova em `PanelApp.tsx` (1348 linhas) nem em `agenteStreamerInstance.ts` (288). Cada arquivo novo deve ficar abaixo de ~200 linhas.

## Classificação dos Arquivos

### Taqciti (`taqciti/src/`)

| Arquivo novo/modificado | Papel | Fluxo de dados | Analog mais próximo | Qualidade |
|---|---|---|---|---|
| `features/agente/association.ts` (reducer puro) | model/utility | transform | `features/meeting/machine.ts` + `features/agente/sendRetryPolicy.ts` (puro, sem chrome) | role-match |
| `features/agente/clientDirectory.ts` (interface) | service (porta) | request-response | `background/agenteSender.ts` (`AgenteSenderDeps`, injeção) | role-match |
| `features/agente/clientSearch.ts` | utility | transform | `features/agente/wordDelta.ts` (função pura + teste) | role-match |
| `features/agente/outbox.ts` | utility | batch | `features/agente/sendRetryPolicy.ts` | role-match |
| `features/agente/meetingUploader.ts` | service | batch (blocos paced) | `background/agenteSender.ts` + `wordDelta.ts` | role-match |
| `shared/config/agenteAssociationStore.ts` | store | CRUD (storage.local) | `shared/config/agenteBindingStore.ts` | exato |
| `shared/config/agenteOutboxStore.ts` | store | CRUD | `shared/config/agenteBindingStore.ts` + fila de escrita de `agenteConfigStore.ts` | exato |
| `shared/config/agenteDeliveryStore.ts` | store | pub-sub (onChanged) | `agenteConfigStore.ts` (`subscribeAgenteConfig`) | exato |
| `shared/config/constants.ts` (novas `STORAGE_KEYS`) | config | - | próprio arquivo (`agenteBinding: 'taq:agenteBinding'`) | exato |
| `background/agenteAssociationService.ts` | service | event-driven | `background/agenteStreamer.ts` (raiz de composição com deps injetadas) | role-match |
| `background/httpClientDirectory.ts` | service | request-response | `defaultSend` em `agenteStreamer.ts` + `buildExtensionChunkRequest` | role-match |
| `background/agenteSender.ts` (modificar: pacing, outbox, sem "descarta o mais antigo") | service | streaming/queue | ele mesmo | exato |
| `shared/config/agenteConfig.ts` (modificar: `chunk_id`, builders das rotas novas) | utility | transform | ele mesmo (`buildExtensionChunkRequest`) | exato |
| `background/history.ts` (modificar: evicção protegida) | service | CRUD | ele mesmo (`upsertRecord`) | exato |
| `shared/types/messages.ts` (+ `ui/agente/*`) | model | request-response | `ui/history/delete` e `ui/history/rename` | exato |
| `background/index.ts` (+ cases dos comandos) | controller | request-response | `case 'ui/history/delete'` | exato |
| `shared/hooks/useClientDirectory.ts` | hook | request-response | `shared/hooks/useAgenteStreamingStatus.ts` | role-match |
| `shared/hooks/useMeetingAssociation.ts` | hook | pub-sub | `shared/hooks/useAgenteStreamingStatus.ts` | exato |
| `sidepanel/components/AgenteNudge.tsx` | component | - | `shared/ui/Badge.tsx` (apresentacional puro) | role-match |
| `sidepanel/components/AgenteDecisionCard.tsx` | component | - | `shared/ui/ConfirmModal.tsx` + `Surface` | role-match |
| `sidepanel/components/ClientPicker.tsx` | component | CRUD (lista/seleção) | `sidepanel/screens/AgenteConfigScreen.tsx` + `OptionCard` | role-match |
| `sidepanel/components/AgenteBindingBar.tsx` | component | - | aviso de captura em `PanelApp` (banner warning) | role-match |
| `sidepanel/components/AgenteEndPrompt.tsx` | component | - | `AgenteConfigScreen` (cartão de confirmação CR-01) | role-match |
| `sidepanel/components/AssociationBadge.tsx` | component | - | `sidepanel/components/StatusBadge.tsx` | exato |
| `shared/ui/ConfirmModal.tsx` (+ `cancelLabel`) | component | - | ele mesmo | exato |
| `shared/ui/Icon.tsx` (+ `alert`), `tailwind.config.ts` (+ `nudge`) | config/component | - | entradas existentes de `PATHS` e `keyframes` | exato |
| `sidepanel/screens/AgenteConfigScreen.tsx` (plano B) | component | request-response | ele mesmo | exato |

### Backend (`backend/`)

| Arquivo novo/modificado | Papel | Fluxo de dados | Analog mais próximo | Qualidade |
|---|---|---|---|---|
| `app/routers/extension_clients.py` | router | request-response | `app/routers/webhook.py` (gate) + `app/routers/pricings.py` (Depends de service) | exato |
| `app/services/extension_session_service.py` | service | CRUD | `app/services/pricing_service.py` | exato |
| `app/repositories/{projects,sessions,transcript_chunks}_repository.py` | repository | CRUD | `app/repositories/pricing_repository.py` | exato |
| `app/models/extension.py` | model | - | `app/models/projects.py`, `app/models/sessions.py` | exato |
| `app/models/projects.py` (modificar: `gemini_api_key` opcional) | model | - | `ProjectUpdate` (já `Optional`) | exato |
| `app/routers/projects.py` (modificar: vault só se houver chave) | router | CRUD | `create_project` + `pricing_api_key` (já condicional) | exato |
| `app/routers/webhook.py` (modificar: `chunk_id`) | router | request-response | ele mesmo | exato |
| `app/main.py` (+ `include_router`) | config | - | linhas 75-82 | exato |
| `supabase/migrations/<data>_add_chunk_id_to_transcript_chunks.sql` | migration | - | `20260921000000_add_mode_to_projects.sql` | role-match |
| `app/services/pipeline.py` (`asyncio.Lock` em `get_or_create`) | service | event-driven | ele mesmo | exato |
| `backend/tests/test_extension_clients.py`, `test_webhook_idempotency.py`, `test_pipeline_get_or_create_lock.py` | test | - | `tests/test_webhook_auth.py`, `tests/test_finish_stops_pipeline.py` | exato |
| `frontend/src/pages/ProjectFormPage.tsx`, `ProjectDetailPage.tsx` (D-15, bloqueado B2) | component | CRUD | eles mesmos | exato |

## Atribuição de Padrões

### `shared/config/agenteAssociationStore.ts`, `agenteOutboxStore.ts`, `agenteDeliveryStore.ts` (store, storage.local)

**Analog:** `taqciti/src/shared/config/agenteBindingStore.ts` (escritor único, chave própria, valor inteiro, sem ler antes) e `agenteConfigStore.ts` (fila de escrita + `onChanged`).

**Escrita direta do valor inteiro** (`agenteBindingStore.ts` linhas 17-41):
```typescript
import { readLocal, writeLocal } from '@/shared/services/storage';
import { STORAGE_KEYS } from './constants';

export function normalizeAgenteBinding(raw: unknown): AgenteBinding | null {
  if (typeof raw !== 'object' || raw === null) return null;
  ...
}
export async function loadAgenteBinding(): Promise<AgenteBinding | null> {
  return normalizeAgenteBinding(await readLocal<unknown>(STORAGE_KEYS.agenteBinding));
}
/** Escrita direta do valor inteiro — sem leitura antes, então nada de ninguém pode ser desfeito. */
export function writeAgenteBinding(sessionId: string, meetingId: string): Promise<void> {
  return writeLocal(STORAGE_KEYS.agenteBinding, { sessionId, meetingId });
}
```

**Fila de escrita serializada** (use no store de associações, que é um mapa `meetingId -> association` e portanto precisa de read-modify-write) (`agenteConfigStore.ts` linhas 25-47):
```typescript
let queue: Promise<AgenteConfig> = Promise.resolve({ ...DEFAULT_AGENTE_CONFIG });
export function patchAgenteConfig(patch: Partial<AgenteConfig>): Promise<AgenteConfig> {
  const run = queue.catch(() => undefined).then(async () => {
    const current = await loadAgenteConfig();
    const next = normalizeAgenteConfig({ ...current, ...patch });
    await writeLocal(STORAGE_KEYS.agenteConfig, next);
    return next;
  });
  queue = run;
  return run;
}
```

**Assinatura com `onChanged` (para o painel no Meet ler a entrega/associação)** (`agenteConfigStore.ts` linhas 53-82): copiar `subscribeAgenteConfig`, incluindo o guard `gotChange` (IN-02) e o filtro `area !== 'local' || !(KEY in changes)`.

**Chaves novas** (`constants.ts`, junto de `agenteBinding: 'taq:agenteBinding'`): `agenteAssociations: 'taq:agenteAssociations'`, `agenteOutbox: 'taq:agenteOutbox'`, `agenteDelivery: 'taq:agenteDelivery'`. Importante: o status de entrega vai em `storage.local`, NÃO em `storage.session` (content script não lê `session`; as chaves da Fase 7 `agenteSendOutcome`/`agenteWaiting` ficam como estão).

**Segredo:** nenhum item persistido pode conter `x-agente-key`. O item da outbox guarda `{chunkId, backendUrl, sessionId, text, speaker, enqueuedAt}`; o header é montado na hora do envio.

**Teste:** `taqciti/src/test/chromeStorageMock.ts` (`installChromeStorageMock`, com `onChanged` real), como em `agenteStreamer.test.ts`.

---

### `features/agente/association.ts` (reducer puro) e `clientSearch.ts`, `outbox.ts`, `meetingUploader.ts` (puros)

**Analog:** `taqciti/src/features/agente/sendRetryPolicy.ts` (sem `fetch`, `setTimeout` nem `chrome`; constantes exportadas + funções puras + teste ao lado) e `wordDelta.ts` (`planStreamStep`, `computeSegmentDeltas`, `primeCursor`).

**Estilo** (`sendRetryPolicy.ts` linhas 29-45):
```typescript
export type SendAttemptResult =
  | { kind: 'response'; ok: boolean; status: number }
  | { kind: 'network-error' };
export type SendVerdict = 'delivered' | 'rejected' | 'retryable';
export function classifySendAttempt(result: SendAttemptResult): SendVerdict {
  if (result.kind === 'network-error') return 'retryable';
  if (result.ok) return 'delivered';
  if (result.status === 429 || result.status >= 500) return 'retryable';
  return 'rejected';
}
export function retryDelayMs(retryIndex: number): number {
  return AGENTE_SEND_RETRY_BASE_MS * 2 ** retryIndex;
}
```
Constantes novas (tamanho do bloco `K`, pausa `P`, teto da outbox) vão aqui como `export const`, com comentário do porquê, como `AGENTE_SEND_MAX_QUEUED`.

**Atenção:** `AGENTE_SEND_MAX_QUEUED = 50` (linha 27) e o `waiting.shift()` de `agenteSender.submit` contradizem D-10/D-18; o uploader deve alimentar o sender sob demanda e a fila ao vivo passa a ser a outbox durável com status `overflow` explícito.

**Teste:** `sendRetryPolicy.test.ts` (29 linhas) e `wordDelta.test.ts` (casos de borda nomeados pela situação real, `describe/it` do vitest, helper `segment(overrides)`).

---

### `background/agenteSender.ts` (modificar) e `background/agenteAssociationService.ts` (novo)

**Analog:** `taqciti/src/background/agenteSender.ts` (fábrica com deps injetadas, `sleep` injetável, geração para cancelar).

**Deps injetáveis + `onOutcome`** (linhas 21-43):
```typescript
export interface AgenteSenderDeps {
  send: (request: ExtensionChunkRequest) => Promise<Response>;
  /** Injetável só para teste; o padrão é `setTimeout`. */
  sleep?: (ms: number) => Promise<void>;
  onOutcome?: (outcome: AgenteSendOutcome, httpStatus: number | null) => void;
}
export function createAgenteSender(deps: AgenteSenderDeps) {
  const sleep = deps.sleep ?? defaultSleep;
  const waiting: ExtensionChunkRequest[] = [];
  let running = false; let idle: Promise<void> = Promise.resolve();
  let generation = 0; let disposed = false;
  const isCurrent = (gen: number) => !disposed && gen === generation;
```

**Laço de entrega com veredito** (linhas 57-80) — o ponto de mudança de D-18 é o ramo `retry >= AGENTE_SEND_MAX_RETRIES` (hoje `report('failed')` e abandona o trecho): passa a mover o item para a outbox durável + `offline`, sem descartar:
```typescript
if (verdict === 'delivered') { report('sent', status); return; }
if (verdict === 'rejected') { logger.warn('Agente recusou o trecho', { status }); report('rejected', status); return; }
if (retry >= AGENTE_SEND_MAX_RETRIES) { ...; report('failed', status); return; }
report('retrying', status);
await sleep(retryDelayMs(retry));
```

**Serial (nunca `Promise.all`)**, ordem garantida (linhas 82-107): `run()` faz `waiting.shift()` + `await deliver`. Manter. O uploader por blocos (D-10) chama `submit` em lotes de `K` e espera `whenIdle()` + `sleep(P)` entre lotes.

**`chunk_id`:** `buildExtensionChunkRequest` em `agenteConfig.ts` (linhas 213-234) ganha parâmetro opcional `chunkId` e o inclui no `JSON.stringify({ session_id, text, speaker, chunk_id })`. O backend atual ignora campo extra (suposição A1 do RESEARCH: validar com request real). Ao vivo: `crypto.randomUUID()` gerado uma vez e reaproveitado nas tentativas; upload: `bulk:{meetingId}:{index}`.

**Orquestrador `agenteAssociationService.ts`:** copiar o estilo de composição de `background/agenteStreamer.ts` (linhas 24-63): deps com defaults de produção + `configure...(partial)` como seam de teste; efeitos de status via `logStatusWriteFailure(write)` (nunca trava o fluxo):
```typescript
function logStatusWriteFailure(write: Promise<void>): void {
  write.catch((error: unknown) => { logger.error('gravar o status do Agente falhou', error); });
}
let activeDeps: AgenteStreamerDeps = { loadConfig: createAgenteConfigReader(), send: defaultSend, ... };
export function configureAgenteStreamer(partial: Partial<AgenteStreamerDeps>): void { ... }
```
O `defaultSend` usa `AbortSignal.timeout(AGENTE_REQUEST_TIMEOUT_MS)` (linhas 24-29).

**Destino efetivo derivado da associação:** o streamer passa a usar `{ ...config, agenteSessionId: association.sessionId }` só quando `state === 'linked'` (Pattern 2 do RESEARCH); `planStreamStep`/`buildPhraseRequests` ficam intactos. Backfill "desde o início" por parâmetro explícito no `StreamBinding`, NÃO reutilizando `confirmedMeetingId` (CR-01).

**Testes:** estender `background/agenteSender.test.ts` (fake timers, helper `response(status)`, `request(text)`, `bodies(send)`; ver linhas 1-60) e `background/agenteStreamer.test.ts` (dispatch real + `installChromeStorageMock` + `vi.useFakeTimers`; constantes `AGENTE_URL = 'https://agente.test'` — https obrigatório fora de loopback, WR-06). Novos: `agenteAssociationService.test.ts`, `agenteOutbox.test.ts` (arquivos novos; `AgenteConfigScreen.test.tsx` já tem 530 linhas, não inflar).

---

### `shared/types/messages.ts` + `background/index.ts` (comandos `ui/agente/*`)

**Analog:** `ui/history/delete` / `ui/history/rename`.

**Schema zod** (`messages.ts` linhas 186-191):
```typescript
z.object({ type: z.literal('ui/history/delete'), id: z.string() }),
z.object({ type: z.literal('ui/history/rename'), id: z.string(), title: z.string().min(1).max(200) }),
```
Novos no mesmo `discriminatedUnion` (`uiMessageSchema`): `ui/agente/clients/list`, `ui/agente/clients/create` (`name: z.string().trim().min(1).max(120)`), `ui/agente/meeting/{defer,bind,send,discard}` (com `meetingId`; `bind` com `clientId`/`manualSessionId` opcionais).

**Handler** (`index.ts` linhas 207-222): `case` dentro do `switch`, `await` e `return { ok: true }`. O `discard` estende o case existente: validar que a reunião existe e não foi enviada, depois `deleteRecord` + remover associação + limpar outbox. Cada `case` apenas delega a `agenteAssociationService` (não colocar lógica no `index.ts`).

---

### `shared/hooks/useMeetingAssociation.ts`, `useClientDirectory.ts`

**Analog:** `shared/hooks/useAgenteStreamingStatus.ts` (estado local + `useEffect(() => subscribeX(setX), [])`, derivação pura via função de `shared/config/*`, ação que grava via store/mensagem):
```typescript
const [status, setStatus] = useState<AgenteStreamingStatus>(EMPTY_AGENTE_STATUS);
useEffect(() => subscribeAgenteStatus(setStatus), []);
const view = readiness ? describeAgenteStreaming(readiness, status, formatClockTime) : null;
```
Toda lógica stateful nos hooks; componentes nunca chamam API (`platform.send` só nos hooks).

---

### Componentes novos (`AgenteNudge`, `AgenteDecisionCard`, `ClientPicker`, `AgenteBindingBar`, `AgenteEndPrompt`, `AssociationBadge`)

**Analogs:** `shared/ui/Badge.tsx` (apresentacional puro, mapa de tons), `shared/ui/ConfirmModal.tsx` (Esc em `document`, `role="dialog"`, `aria-label`), `OptionCard role="single"`, `SearchField`/`TextField` de `shared/ui/Field` (obrigatórios: seguram o teclado para o Meet), `Surface`, `ProgressRail`, `Button`. Usar apenas o kit "Liquid Glass"; nenhum token novo (UI-SPEC).

**Padrão apresentacional** (`Badge.tsx`):
```typescript
type Tone = 'primary' | 'neutral' | 'warning' | 'danger';
const TONES: Record<Tone, string> = { primary: 'bg-primary/14 text-glow ...', warning: 'bg-amber-400/12 text-amber-200/90 ...', ... };
export function Badge({ tone = 'neutral', children }: BadgeProps) { ... }
```
`AssociationBadge`: mapear `AssociationState` -> `Badge` (`Sem cliente` warning, `Enviando` primary, `Enviada` primary, `Envio parou` warning), seguindo `StatusBadge.tsx`.

**Props mínimas (ISP):** `ClientPicker` recebe `status: 'loading'|'ready'|'error'`, `clients`, `mode: 'live'|'ended'`, `onSelect`, `onCreate`, `onManualId`.

**Aviso de banner warning** (para `AgenteBindingBar` offline): literal já usado em `PanelApp`: `rounded-control border border-[#f2c94c]/25 bg-[#f2c94c]/10 px-3 py-2 text-caption text-[#f7dd8f]`, `role="status"`, `aria-live="polite"`.

**Fiação mínima** em `PanelApp`/`LiveBody`/`MeetingScreen`/`RecordDetail`; qualquer extração do `PanelApp` é commit de refator separado.

**`ConfirmModal`** (modificar): adicionar `cancelLabel?: string` (padrão `'Cancelar'`) em `ConfirmModalProps`; o botão de recusa hoje fixa o texto na linha ~60. `Esc` e clique no fundo continuam chamando `onCancel`. Novo teste `ConfirmModal.test.tsx`.

**`Icon alert` / keyframe `nudge`:** acrescentar `'alert'` em `IconName` e `PATHS` (traço 1.8, `currentColor`) em `shared/ui/Icon.tsx`; acrescentar em `tailwind.config.ts` `keyframes` (junto de `fade-slide-in`, linhas ~81-88) um `nudge` só com `transform: translateY` (nunca opacidade) e a `animation` de 5s `infinite`.

---

### `backend/app/routers/extension_clients.py` (router, request-response)

**Analogs:** `app/routers/webhook.py` (gate) e `app/routers/pricings.py` (factory de service via `Depends`).

**Gate reutilizado** (`webhook.py` linhas 20-27) — importar `verify_extension_key`, não duplicar:
```python
def verify_extension_key(x_agente_key: str | None = Header(default=None)) -> None:
    expected = os.environ.get("EXTENSION_SHARED_KEY", "")
    if not expected:
        return  # opt-in: gate desativado até a env var existir
    if not x_agente_key or not secrets.compare_digest(x_agente_key, expected):
        raise HTTPException(status_code=401, detail="Missing or invalid x-agente-key header")
```
Aplicar com `_: None = Depends(verify_extension_key)` como em `extension_webhook` (linhas 31-35). Risco T1: gate é opt-in; rotas de escrita abertas sem a env var (decisão do time).

**Factory de service por `Depends`** (`pricings.py` linhas 77-80):
```python
def _get_service(db: Client = Depends(get_supabase)) -> PricingService:
    repo = PricingRepository(db)
    return PricingService(repo)
```
Router só roteia: `service.list_clients()`, `service.create_client(payload.name)`, `service.create_session(...)`. Prefixo `APIRouter(prefix="/webhook/extension", tags=["webhook-extension"])`; registrar em `app/main.py` ao lado de `app.include_router(webhook_router)` (linha 79). Cuidado com colisão de rota: `webhook.py` já tem `POST /webhook/extension`; as novas são `/webhook/extension/clients` e `/webhook/extension/sessions`.

**Resposta mínima (T2/LGPD):** schema próprio `{id, client, name}`; nunca `ProjectResponse` (que carrega `pre_meeting_context`, orçamento).

---

### `backend/app/services/extension_session_service.py` (service)

**Analog:** `app/services/pricing_service.py` (construtor recebe o repository; erros como `HTTPException`):
```python
class PricingService:
    def __init__(self, repo: PricingRepository) -> None: ...
    ...
    raise HTTPException(status_code=404, detail="Project not found")
    raise HTTPException(status_code=409, detail="Already approved")
```
Regras do service novo: `strip` + checagem de duplicidade sem acento/caixa -> 409; fixar `mode="discovery"` e `source="extension"` (Pitfall 7, depende de confirmação); 404 para `session_id` desconhecido (T9). Não usar `POST /sessions/start` (D-13; ele busca briefings no CITi Flow e cria segredo no Vault a cada chamada, `sessions.py` linhas 43-75).

---

### `backend/app/repositories/*_repository.py` (repository)

**Analog:** `app/repositories/pricing_repository.py` (classe com `self._db`, só `db.table()`, devolve dict bruto, sem regra de negócio):
```python
class PricingRepository:
    def __init__(self, db: Client) -> None:
        self._db = db
    def get_project(self, project_id: str) -> dict | None:
        result = self._db.table("projects").select("id, project_type").eq("id", project_id).execute()
        return result.data[0] if result.data else None
    def insert_pricing(self, row: dict) -> dict:
        result = self._db.table("pricings").insert(row).execute()
        return result.data[0]
```
Não refatorar `projects.py`/`sessions.py` existentes (acesso direto ao banco) no mesmo commit; código novo nasce em camadas.

**Repositório de chunks (D-19, bloqueado B3):** `insert_chunk(...) -> bool`, capturando `postgrest.exceptions.APIError` com `.code == "23505"` e devolvendo `False` (duplicata -> 202 sem `push_chunk`).

---

### `backend/app/models/extension.py` (schemas separados)

**Analog:** `app/models/sessions.py` (`SessionCreate`, linhas 9-15) e `app/models/projects.py` (`Create`/`Update`/`Response` separados, `field_validator`):
```python
class ProjectCreate(BaseModel):
    name: str
    client: str
    ...
    @field_validator("data_maturity_score")
    @classmethod
    def validate_dms(cls, v): ...
```
Novos: `ExtensionClientCreate(name: str = Field(min_length=1, max_length=120))` com `strip`, `ExtensionClientResponse(id, client, name)`, `ExtensionSessionCreate(project_id: UUID, ...)`.

---

### `backend/app/models/projects.py` + `routers/projects.py` (D-15, bloqueado B2)

`ProjectCreate.gemini_api_key: str` (linha 18) -> `Optional[str] = None` (como em `ProjectUpdate`). `create_project` (`projects.py` linhas ~53-65) hoje chama `_vault_store(db, payload.gemini_api_key, ...)` sempre; copiar o padrão condicional que o próprio arquivo já usa para `pricing_api_key`:
```python
if payload.pricing_api_key:
    row["pricing_api_key_secret_id"] = _vault_store(db, payload.pricing_api_key, f"pricing-{payload.client}")
```
O pipeline já tem o fallback `GEMINI_API_KEY` (`pipeline.py` ~linhas 53-54 e 664-665). Frontend: `ProjectFormPage.tsx` (~296-299, `required={!isEdit}`) e `ProjectDetailPage.tsx` (~284-290, texto "Não configurada" em vermelho). Estender `tests/test_projects.py`.

---

### `backend/app/routers/webhook.py` (D-19, bloqueado B3)

**Analog:** o próprio `extension_webhook` (linhas 30-52). Modelo `ExtensionChunk` (linhas 14-17) ganha `chunk_id: str | None = Field(default=None, max_length=200)`; sem `chunk_id` o comportamento permanece idêntico (recall segue válido). Trocar o `insert` direto pelo `insert_chunk` do repositório; em duplicata, `return {"accepted": True}` sem `asyncio.create_task(pipeline_manager.push_chunk(...))`.

**Migration:** seguir `supabase/migrations/20260921000000_add_mode_to_projects.sql`. `ALTER TABLE transcript_chunks ADD COLUMN IF NOT EXISTS chunk_id text; CREATE UNIQUE INDEX IF NOT EXISTS ux_transcript_chunks_session_chunk ON transcript_chunks (session_id, chunk_id);` (NULLs distintos no Postgres: linhas antigas e `/webhook/recall` seguem válidos). Roda no Supabase de produção, fora do repo (planejar com seção 6 do template).

---

### `backend/tests/test_extension_clients.py`, `test_webhook_idempotency.py`, `test_pipeline_get_or_create_lock.py`

**Analog:** `backend/tests/test_webhook_auth.py` (testes puros, sem `TestClient`; chamar a dependência/função direto; `monkeypatch.setenv/delenv`) e `backend/tests/test_finish_stops_pipeline.py` (fakes de `db`/`pipeline_manager`, `async def test_...` direto pois `asyncio_mode = auto`).

**Estilo** (`test_webhook_auth.py` linhas 18-52):
```python
import pytest
from fastapi import HTTPException
from app.routers.webhook import verify_extension_key

def test_verify_extension_key_rejects_missing_header_when_set(monkeypatch):
    monkeypatch.setenv("EXTENSION_SHARED_KEY", "s3cr3t")
    with pytest.raises(HTTPException) as exc_info:
        verify_extension_key(x_agente_key=None)
    assert exc_info.value.status_code == 401
```
Cabeçalho de comentário no topo explicando a fase/plano e os SC cobertos (padrão das duas fases anteriores). Não usar `conftest.supabase_client`/`test_schema.py` (falam com o Supabase real e exigem `.env`). Para o lock: duas chamadas concorrentes a `PipelineManager.get_or_create` via `asyncio.gather` resultam em 1 pipeline (fake de `llm_service`).

---

## Padrões Compartilhados

### Gate `x-agente-key` (Taqciti e backend)
**Fonte backend:** `backend/app/routers/webhook.py::verify_extension_key` (linhas 20-27).
**Fonte Taqciti:** `taqciti/src/shared/config/agenteConfig.ts::buildExtensionChunkRequest` (linhas 213-234): header só quando `agenteApiKey.length > 0`; usa `AGENTE_KEY_HEADER = 'x-agente-key'`.
**Aplicar em:** todas as rotas novas (`/clients`, `/sessions`, e `finish` se a decisão 4 aprovar) e todo builder de request novo (`httpClientDirectory.ts`), sempre via helper compartilhado, nunca remontando o header à mão.
```typescript
const headers: Record<string, string> = { 'Content-Type': 'application/json' };
if (config.agenteApiKey.length > 0) headers[AGENTE_KEY_HEADER] = config.agenteApiKey;
```

### Validação de URL do backend
**Fonte:** `agenteConfig.ts` (`isValidAgenteBackendUrl`, https obrigatório fora de loopback, WR-06). **Aplicar em:** `httpClientDirectory.ts` antes de qualquer `fetch`. Fetch só no service worker (CORS/CSP do Meet).

### Fire-and-forget, nunca travar o Meet
**Fonte:** `agenteStreamer.ts` `logStatusWriteFailure` e `agenteSender.submit` (só enfileira). **Aplicar em:** outbox, uploader, escrita de status de entrega.

### Logging sem texto
**Fonte:** `@/shared/services/log` (`logger.error/warn`, só contagens e status). **Aplicar em:** todo arquivo novo do service worker; nunca logar transcrição ou chave.

### Tratamento de erro HTTP (backend)
**Fonte:** `PricingService` (`HTTPException` 404/409 dentro do service). **Aplicar em:** `extension_session_service.py`; 401 padrão da Fase 6; 404 para `session_id` desconhecido.

### Máquina de estados puro + store de escritor único
**Fonte:** `features/meeting/machine.ts` e `agenteBindingStore.ts`. **Aplicar em:** `association.ts` + `agenteAssociationStore.ts`; a UI nunca grava, só emite comandos validados por zod.

## Sem Analog

| Arquivo | Papel | Fluxo | Motivo |
|---|---|---|---|
| `agenteOutboxStore.ts` (fila durável paginada) | store | batch | Nenhuma fila durável existe; a fila atual é memória do SW (`waiting` em `agenteSender`). Combinar `agenteBindingStore` (escrita) + `sendRetryPolicy` (veredito); o planejador usa o Pattern 5 do RESEARCH. |
| Hook de lock por sessão em `PipelineManager.get_or_create` | service | event-driven | Nenhum `asyncio.Lock` por chave existe; usar o Pitfall 5 do RESEARCH. |
| Rota `POST /webhook/extension/sessions/{id}/finish` (decisão 4) | router | request-response | `finish_session` em `sessions.py` (~linha 255) é o analog funcional, mas sem gate; reaproveitar a lógica via service, não via cópia. Bloqueado B4. |

## Mapa de bloqueios (do RESEARCH, para ordenar planos)

- Livre: domínio da associação, stores, `ClientDirectory` + fake, comandos zod, UI inteira (contra o fake), descarte, evicção protegida do histórico, sender/outbox/uploader (cliente), lock em `get_or_create`.
- B1 (rotas novas), B2 (`gemini_api_key` opcional), B3 (`chunk_id`/migration/`Continuar envio`/reenvio automático seguro), B4 (quem encerra a sessão; `mode='discovery'`): parar e registrar DECISÃO EM ABERTO, conforme CLAUDE.md.

## Metadados

**Escopo da busca:** `taqciti/src/{background,features/agente,shared/{config,ui,hooks,types},sidepanel,test}`, `backend/app/{routers,services,repositories,models}`, `backend/tests`, `supabase/migrations`.
**Arquivos lidos com extração:** 18.
**Data da extração:** 2026-10-11.
