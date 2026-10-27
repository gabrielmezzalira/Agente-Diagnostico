# Fase 9: Cutover + Retire Custom Extension - Mapa de Padrões

**Mapeado:** 2026-10-26
**Arquivos analisados:** 14 (criar/modificar) + remoções
**Analogs encontrados:** 12 / 14 (os 2 restantes são texto/docs sem analog de código)

Todos os analogs abaixo são git-tracked (verificado `labels.ts`, `navItems.ts`, `test_webhook_auth.py`). Nenhum caminho de espelho gitignored.

## Classificação dos arquivos

| Arquivo | Papel | Fluxo | Analog | Qualidade |
|---|---|---|---|---|
| `frontend/src/lib/taqcitiInstall.ts` (novo) | utility (dados puros) | transform | `frontend/src/lib/labels.ts` | exato |
| `frontend/src/lib/taqcitiInstall.test.ts` (novo) | test | transform | `frontend/src/lib/labels.test.ts` | exato |
| `frontend/src/pages/ExtensionPage.tsx` (reescrever) | page | request-response (estático) | ela mesma + `HomePage.tsx` | exato |
| `frontend/src/lib/labels.ts` (`EXTENSION_URL`) | utility | transform | ela mesma | exato |
| `frontend/src/components/layout/navItems.ts` (L15) | config | n/a | ela mesma | exato |
| `frontend/src/pages/HomePage.tsx` (L14-17 `ExtensionBanner`) | component | n/a | ela mesma | exato |
| `frontend/src/components/session/TranscriptPanel.tsx` (L24) | component | n/a | ela mesma | exato |
| `backend/tests/test_extension_clients.py` (estender, SC3) | test | request-response | ela mesma | exato |
| `backend/tests/test_webhook_idempotency.py` (estender, SC3) | test | request-response | ela mesma | exato |
| `.planning/phases/09-.../09-UAT.md` (novo) | doc | n/a | `08-UAT.md` | exato (frontmatter/estrutura) |
| `taqciti/src/shared/config/agenteConfig.ts:42`, `taqciti/src/features/agente/wordDelta.ts:3` | comentário | n/a | n/a | só comentário |
| Docs (`CLAUDE.md` §10, `diagnostico/README.md`, `PLANO_AJUSTES.md`, `.planning/PROJECT.md|ROADMAP.md|STATE.md`) | doc | n/a | n/a | só texto |

Fora do mapa por decisão do usuário: rótulos "Extensão Chrome" em `ProjectFormPage.tsx:213` e `SessionSetupPage.tsx:151` ficam como estão.

## Atribuições de padrão

### `frontend/src/lib/taqcitiInstall.ts` (utility, dados puros)

**Analog:** `frontend/src/lib/labels.ts` (constantes exportadas + funções puras, sem imports, sem React).

```typescript
export const EXTENSION_URL =
  'https://github.com/gabrielmezzalira/Agente-Diagnostico/releases/download/v1.0.0/agente-diagnostico-extension-v1.0.0.zip'   // labels.ts:18-19 (será removida/substituída)

export const DMS_LABELS: Record<number, string> = { 1: 'Inicial', ... }   // labels.ts:10 - padrão Record tipado
```

Padrão: arquivo `.ts` puro (sem JSX), exports nomeados. Como `ExtensionPage` usa `React.ReactNode` nos passos (com `<code>`), o `taqcitiInstall.ts` deve guardar só strings/dados (passos em texto, URL da release, texto do aviso D-11) e o JSX (o `<code>`) fica na página. ATENÇÃO: a URL da release é DECISÃO EM ABERTO (CONTEXT) — o planner deve parar e perguntar; não inventar.

### `frontend/src/lib/taqcitiInstall.test.ts` (test)

**Analog:** `frontend/src/lib/labels.test.ts` (vitest, ambiente `node` — `frontend/vite.config.ts:18`).

```typescript
import { describe, expect, it } from 'vitest'
import { DMS_LABELS, sessionDurationLabel } from './labels'

describe('labels', () => {
  it('os 5 níveis de maturidade têm rótulo', () => {
    expect(Object.keys(DMS_LABELS)).toHaveLength(5)
    expect(DMS_LABELS[3]).toBe('Definido')
  })
})
```

Testar: URL é https e não contém `agente-diagnostico-extension`/`.zip`; passos não vazios; aviso da extensão antiga presente; nenhuma menção a chave (D-08). Sem DOM (ambiente node).

### `frontend/src/pages/ExtensionPage.tsx` (page, reescrita)

**Analog:** o próprio arquivo atual (estrutura a manter) + kit de UI.

**Imports/estrutura** (L1-4, 15-24):
```tsx
import { CheckCircle, Download } from 'lucide-react'
import AppShell from '../components/layout/AppShell'
import { Card, PageHeader, SectionLabel } from '../components/ui'

<AppShell>
  <PageHeader eyebrow="Captura" title="Extensão Chrome" subtitle="..." />
  <Card className="px-[26px] py-6 flex flex-col gap-6 max-w-[860px]">
    <SectionLabel>Instalação</SectionLabel>
```

**Lista numerada de passos** (L26-38): `<ol>` com bolha numerada `w-7 h-7 ... bg-ds-green-soft border-ds-green-line text-ds-green` e texto `text-[14.5px] leading-[1.6] text-ds-text-2`. `<code className="font-mono text-[12.5px] px-1.5 py-0.5 rounded bg-white/[0.06] text-ds-green">` para trechos de código.

**Link externo como botão:** hoje é `<a>` com classes inline copiadas do botão primary (L40-46). O kit já tem o helper `buttonClasses` (`frontend/src/components/ui/buttonStyles.ts:23`), que gera exatamente essas classes:
```tsx
import { buttonClasses } from '../components/ui/buttonStyles'   // conferir se o barrel components/ui reexporta
<a href={URL} target="_blank" rel="noopener noreferrer" className={buttonClasses('primary')}>
  <Download size={14} aria-hidden /> Baixar a Taqciti
</a>
```
Nota: remover o atributo `download` (era para o .zip; agora é link de página de release). O único uso de `buttonClasses('primary')` hoje é em `buttonStyles.test.ts:6`; `ButtonLink` (HomePage) serve só para rota interna (react-router), não para link externo. Adicionar `target`/`rel` (novo, não há analog).

**Aviso D-11:** reusar o padrão `Card`/`StatusDot` (ver `HomePage.tsx` ExtensionBanner). Manter rota `/extension` e item de menu.

### `frontend/src/lib/labels.ts`

Remover `EXTENSION_URL` (L18-19) e mover a URL nova para `taqcitiInstall.ts` (um arquivo, uma responsabilidade). Único consumidor atual é `ExtensionPage.tsx:2`; `labels.test.ts` não referencia a constante. Verificar com grep antes de apagar.

### `navItems.ts` (L15), `HomePage.tsx` (L14-17), `TranscriptPanel.tsx` (L24)

Só texto. Linha atual de cada um:
```ts
{ to: '/extension', label: 'Extensão Chrome' },                          // navItems.ts:15
<span ...>Extensão Chrome disponível</span>                               // HomePage.tsx:14
<span ...>Necessária para capturar transcrições do Google Meet</span>     // HomePage.tsx:15
<ButtonLink to="/extension" variant="secondary">Instalar extensão</ButtonLink>  // HomePage.tsx:17
Abra a reunião no Google Meet com a extensão ativa.                       // TranscriptPanel.tsx:24
```
Trocar por "Taqciti" mantendo a rota. Confira se algum teste compara esses textos (grep em `*.test.*` antes).

### Testes SC3 do backend

**Analog A:** `backend/tests/test_extension_clients.py` — unitário puro, sem rede/.env, repositório fake, inspeção do `APIRouter`:
```python
from app.routers import extension_clients as router_mod
from app.routers.webhook import verify_extension_key

def _routes() -> dict[tuple[str, str], APIRoute]:       # L76-82
    return {
        (path_method, route.path): route
        for route in router_mod.router.routes
        if isinstance(route, APIRoute)
        for path_method in route.methods
    }

def _gate_calls(route: APIRoute) -> list:                # L85-86
    return [dep.call for dep in route.dependant.dependencies]
```
Usar `_routes()` para afirmar que `("POST", "/webhook/extension/sessions")`, `/clients` e `/sessions/{id}/finish` continuam registradas e com `verify_extension_key` como gate. Cabeçalho do arquivo (L1-15) mostra o formato do comentário de bloco a replicar.

**Analog B:** `backend/tests/test_webhook_idempotency.py` — chama a função de rota direto (não há TestClient neste conjunto):
```python
from app.routers.webhook import ExtensionChunk, extension_webhook
from app.services import pipeline as pipeline_mod

async def _post(monkeypatch, db, payload: dict) -> list:    # L~96
    pushed: list = []
    async def _fake_push_chunk(session_id, text, speaker=None):
        pushed.append((session_id, text, speaker))
    monkeypatch.setattr(pipeline_mod.pipeline_manager, "push_chunk", _fake_push_chunk)
    result = await extension_webhook(ExtensionChunk.model_validate(payload), db=db, _=None)
```
Teste de contrato novo: (1) `ExtensionChunk.model_validate({"session_id":"s","text":"t"})` continua válido (campos obrigatórios/opcionais, `chunk_id` max 200 — ver `test_extension_chunk_chunk_id_is_optional_and_capped_at_200`); (2) `extension_webhook` registrado em `POST /webhook/extension` (inspecionar `webhook.router.routes` como `_routes()` acima); (3) `source=extension` aceito no enum — localizar o enum/modelo de sessão antes de escrever (`grep` em `backend/app/models`). Os greps de `webhook.py`/`test_webhook_auth.py` com padrão `source.*extension` não retornaram nada, então o local exato do enum precisa ser confirmado pelo planner; também ler `test_webhook_auth.py` e `test_extension_chunk_extra_fields.py` (não excertados aqui) para escolher onde estender, preferindo estender a criar arquivo.

### `09-UAT.md`

**Analog:** `.planning/phases/08-taqciti-session-association/08-UAT.md`.

Frontmatter (L1-7): `status`, `phase`, `source`, `started`, `updated`. Seção `## Current Test` (L9-11) e `## Tests` (L13). Bloco de teste:
```markdown
### 1. Cold Start Smoke Test
expected: <o que deve acontecer>
result: pass
evidence: Evidência colhida em AAAA-MM-DD: ...
```
Campos extras usados em testes mais complexos: `rationale:` e `evidence_anterior:`. Fim do arquivo tem a seção de observações (não excertada por tamanho; o planner deve ler as últimas ~40 linhas de `08-UAT.md` para o formato exato). Mapear os 4 itens de D-03 como 4 testes (transcrição `source=extension`; `coverage_snapshots` + perguntas produto e dados; `reports` com seção de precificação; sair da sala -> `finished`) mais o item de limpeza `ZZ-TESTE` (D-04, incluindo as sessões `ce75b9af-…` e `6cd362ad-…`).

### Comentários na Taqciti

- `taqciti/src/shared/config/agenteConfig.ts:42`: "`extension/background.js::normalizeUrl` (trim, remove barras finais, ..." -> reescrever sem citar caminho apagado, mantendo a descrição da regra.
- `taqciti/src/features/agente/wordDelta.ts:3`: "Espelha o padrão de `extension/content_meet.js::emitNew()`," -> idem.
Commit separado de qualquer remoção (CLAUDE.md: refator != comportamento). Os outros hits de `/webhook/extension/*` em `taqciti/src` são o contrato vivo — NÃO tocar.

### Docs (um commit só, D-12)

Linhas que citam `extension/` (grep):
- `CLAUDE.md:838, 840, 858` (seção 10)
- `diagnostico/README.md:9`
- `PLANO_AJUSTES.md:247`
- `.planning/ROADMAP.md:203` (linha longa; é a que diz "repo separado" — corrigir) e `:327` (SC2 da fase; texto do critério, manter)
- `.planning/PROJECT.md`, `.planning/STATE.md`: o grep específico não retornou hits para `extension/`/"repo separado"; conferir "separado"/"Taqciti" por outro termo antes de editar.

## Padrões compartilhados

- **Sem lógica em JSX / um arquivo, uma responsabilidade:** dados em `lib/`, página só compõe (CLAUDE.md).
- **Kit de UI:** importar de `../components/ui` (`Card`, `PageHeader`, `SectionLabel`, `ButtonLink`, `StatusDot`); tokens `ds-*`.
- **Testes backend:** unitários puros, fakes em memória, sem rede/.env, cabeçalho de comentário descrevendo fase/plano.
- **Commits atômicos e na ordem do CONTEXT:** deploy (humano) -> prova SC1 -> ExtensionPage+URL -> `git rm extension/` + zip -> limpeza de comentários -> docs -> teste SC3.

## Sem analog / pontos em aberto

| Item | Motivo |
|---|---|
| URL da release/repo original da Taqciti | DECISÃO EM ABERTO (CONTEXT); não existe no repo |
| Link externo com `target="_blank" rel="noopener noreferrer"` | Nenhum uso existente no kit; só `ButtonLink` interno |
| Localização exata do enum `source` | Não encontrado pelos greps em `webhook.py`/testes; planner confirma em `backend/app/models` |

## Metadados

**Escopo de busca:** `frontend/src`, `backend/tests`, `backend/app/routers`, `taqciti/src`, docs da raiz e `.planning`.
**Exclusões:** `node_modules`, `.claude/worktrees`, `taqciti/server/.next`, dist; nenhum `.env` lido.
