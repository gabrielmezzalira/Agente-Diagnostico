---
phase: 05-two-lens-monitoring-frontend
reviewed: 2026-09-23T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - backend/app/models/sessions.py
  - backend/app/routers/sessions.py
  - backend/tests/test_readiness_route.py
  - frontend/package.json
  - frontend/src/lib/api.ts
  - frontend/src/lib/lens.test.ts
  - frontend/src/lib/lens.ts
  - frontend/src/lib/useSessionWS.ts
  - frontend/src/pages/ProjectDetailPage.tsx
  - frontend/src/pages/SessionActivePage.tsx
  - frontend/vite.config.ts
findings:
  critical: 2
  warning: 3
  info: 2
  total: 7
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-09-23
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

A fase 05 introduz o monitoramento "duas lentes" (Produto/Dados) na tela de sessão ativa, o botão "Gerar PRD" na página do projeto (D-47) e a rota `GET /sessions/{id}/readiness` (D-49). A camada pura (`lens.ts` + `lens.test.ts`) está bem coberta e correta — a inferência de modo (`isDiscoveryCoverage`) e o agrupamento por lente (`groupCoverageByLens`) preservam corretamente o comportamento sales byte-a-byte, como os testes provam.

O problema real está na composição dessas peças no lado React: o novo botão "Gerar PRD" reusa um único estado de erro para dois motivos de falha completamente diferentes (o que produz uma mensagem enganosa e um travamento permanente do botão), e a lógica que oculta o botão "Relatório" da sessão ao vivo em modo discovery depende de um heurístico (`ws.coverage`) que começa vazio a cada montagem do componente — não de um sinal de modo confiável vindo do servidor. As duas coisas juntas abrem uma janela real, ainda que curta, em que o fluxo de geração de PRD com gate de readiness pode ser contornado. Também há uma lacuna de configuração de teste (vitest) que vai silenciosamente ignorar futuros testes de componente `.tsx`.

## Critical Issues

### CR-01: Botão "Relatório" da sessão ativa vaza para sessões discovery na janela antes do primeiro evento WS

**File:** `frontend/src/pages/SessionActivePage.tsx:1053` (interage com `frontend/src/lib/useSessionWS.ts:62-70`)

**Issue:** O botão manual "Relatório" (que dispara `POST /sessions/{id}/report` diretamente, sem qualquer gate de readiness) agora só deveria aparecer no modo sales:

```tsx
{!isDiscoveryCoverage(ws.coverage) && (
  <button onClick={handleGenerateReport} ...>
```

O problema é que `isDiscoveryCoverage` é derivado do payload de WebSocket (`ws.coverage`), e este estado nasce vazio (`coverage: {}`, ver `useSessionWS.ts:62-70`, onde o `INITIAL_COVERAGE` fixo foi removido nesta mesma fase). `isDiscoveryCoverage({})` retorna `false` (nenhuma área tem `lens != null` porque não há áreas) — logo `!isDiscoveryCoverage(ws.coverage)` é `true` e o botão **é renderizado e clicável** desde o primeiro render, até que a mensagem `initial_state` chegue pelo WebSocket e popule `ws.coverage` com os dados reais (incluindo `lens`).

Essa janela (do mount do componente até o `onmessage` do `initial_state`) é exatamente o intervalo em que o usuário mais provavelmente vai olhar/clicar na tela (ex.: ao entrar numa sessão discovery já em andamento, ou após uma reconexão de rede — `useSessionWS` não tem lógica de reconexão automática: ao cair, `ws.onclose` só marca `connected:false`, sem novo `new WebSocket(...)`, então "reconectando..." nunca de fato reconecta e uma nova montagem/navegação é o único jeito de reabrir a conexão, reabrindo a mesma janela vazia). Um clique nessa janela dispara `handleGenerateReport` → `api.sessions.generateReport` → `POST /sessions/{id}/report`, que no backend (`backend/app/routers/sessions.py:325-343`) **não verifica `readiness_score()` em nenhum momento** — ou seja, o único gate do fluxo D-47 é esse `!isDiscoveryCoverage(...)` no frontend, e ele é derivado de um estado que começa incorreto por design.

**Fix:** Não inferir o modo a partir do payload de WebSocket, que é assíncrono e pode estar vazio. Buscar o modo de uma fonte síncrona e confiável — por exemplo, incluir `mode` no `SessionResponse` (backend) e usá-lo diretamente:

```tsx
// backend/app/models/sessions.py — adicionar ao SessionResponse
mode: str  # veio de projects.mode via join, ou herdado explicitamente na criação da sessão

// SessionActivePage.tsx
{session.mode !== 'discovery' && (
  <button onClick={handleGenerateReport} ...>
)}
```
Enquanto isso não existir, pelo menos usar um estado derivado explícito (`hasReceivedInitialState`) para não decidir a visibilidade do botão antes do primeiro `initial_state`.

---

### CR-02: `readinessError` mistura dois erros diferentes e trava o botão "Gerar PRD" permanentemente após uma falha transitória

**File:** `frontend/src/pages/ProjectDetailPage.tsx:97, 118-127, 129-140, 399-416`

**Issue:** O mesmo estado `readinessError` é usado para dois cenários completamente distintos:

1. Falha ao **buscar** o readiness (`getReadiness`, linha 125): `.catch(() => setReadinessError('Erro ao carregar readiness'))`
2. Falha ao **gerar** o relatório (`handleGeneratePrd`, linha 135-136): `catch (e) { setReadinessError(e instanceof Error ? e.message : 'Erro ao gerar PRD') }`

O JSX que renderiza o erro, porém, sempre mostra o texto fixo do caso 1, independentemente da causa real:

```tsx
{readinessError ? (
  <p className="text-xs text-[var(--color-red)]">Erro ao carregar readiness</p>
) : (
  <ReadinessBar pct={...} />
)}
```

Ou seja: se a chamada de geração do PRD falhar (ex.: chave Gemini ausente, erro 422 do backend "Could not generate report — check Gemini API key"), a mensagem real capturada em `e.message` é descartada e o usuário vê "Erro ao carregar readiness" — uma mensagem que não corresponde ao problema.

Pior: como `readinessError` também entra na condição de desabilitar o botão (`disabled={!readiness?.ready || readinessLoading || !!readinessError || generatingPrd}`, linha 406) e na guarda de `handleGeneratePrd` (linha 130), uma vez que esse estado é setado por uma falha de geração, **o botão "Gerar PRD" fica permanentemente desabilitado** — não há nenhum caminho de retry, porque o único `useEffect` que limpa/recalcula `readinessError` roda apenas quando `discoverySessionId` muda (linha 118-127), o que não vai acontecer de novo para a mesma sessão. O usuário precisa recarregar a página inteira para tentar de novo, mesmo que a falha tenha sido transitória (timeout de rede, rate limit do Gemini, etc.) e o readiness continue "pronto".

**Fix:** Separar os dois estados de erro e permitir retry:

```tsx
const [readinessError, setReadinessError] = useState<string | null>(null)   // erro ao carregar readiness
const [prdError, setPrdError] = useState<string | null>(null)               // erro ao gerar o PRD

async function handleGeneratePrd(sessionId: string) {
  if (!readiness?.ready || readinessLoading || readinessError || generatingPrd) return
  setGeneratingPrd(true)
  setPrdError(null)
  try {
    await api.sessions.generateReport(sessionId)
    navigate(`/sessions/${sessionId}`)
  } catch (e: unknown) {
    setPrdError(e instanceof Error ? e.message : 'Erro ao gerar PRD')
  } finally {
    setGeneratingPrd(false)
  }
}
```
E no botão, não incluir `prdError` na condição de `disabled` (deixar o usuário tentar de novo), mostrando `prdError` como uma mensagem separada da barra de readiness.

## Warnings

### WR-01: Redirect de "Gerar PRD" pode não exibir o relatório recém-gerado quando a sessão discovery ainda está ativa

**File:** `frontend/src/pages/ProjectDetailPage.tsx:129-140` + `frontend/src/pages/SessionActivePage.tsx:668-685, 999-1128`

**Issue:** `pickDiscoverySession` (linha 34-39 de `ProjectDetailPage.tsx`) escolhe a sessão discovery mais recente por `started_at`, **sem filtrar por `status`** — ou seja, o bloco "Gerar PRD" pode aparecer associado a uma sessão ainda `active` (o readiness é calculado ao vivo, então isso é um caminho esperado: o analista pode atingir o threshold de prontidão antes de encerrar a call).

Quando `handleGeneratePrd` termina com sucesso, ele navega para `/sessions/${sessionId}` (linha 134). Se a sessão ainda estiver `active`:
- `SessionActivePage` renderiza o layout de monitoramento ao vivo, não a view de "sessão encerrada" que busca e exibe `finishedReport` (esse fetch só acontece em `else` quando `s.status !== 'active'`, linhas 675-679).
- O único outro caminho para mostrar o relatório recém-criado seria o evento WS `report_ready` (emitido em `pipeline.py` dentro de `trigger_report()`), mas esse broadcast já ocorreu **antes** da nova conexão WebSocket ser aberta (a conexão só é criada depois que `api.sessions.generateReport` resolve e o `navigate()` monta o novo componente) — logo esse evento nunca chega ao cliente.
- O botão "Relatório" do topbar ao vivo fica oculto para sessões discovery (ver CR-01), então não há nem esse atalho manual para reabrir o modal.

Resultado: o PRD foi gerado e persistido corretamente no banco, mas o usuário é redirecionado para uma tela que não mostra nada disso — precisa encerrar a sessão e voltar para conseguir vê-lo.

**Fix:** Ou (a) restringir `pickDiscoverySession`/o bloco "Gerar PRD" a sessões `finished`, ou (b) fazer `SessionActivePage` buscar o relatório mais recente via `api.sessions.getReport(sessionId)` também quando a sessão está ativa (não só no `else`), abrindo o modal se algo for encontrado.

### WR-02: Configuração do vitest não cobre os testes de componente que os devDependencies já preveem

**File:** `frontend/vite.config.ts:17-20`, `frontend/package.json:11`

**Issue:** Este PR liga o `test` script (`"test": "vitest run"`) e o bloco `test` do `vite.config.ts` pela primeira vez:

```ts
test: {
  environment: 'node',
  include: ['src/**/*.test.ts'],
},
```

`environment: 'node'` não tem DOM, e `include` só casa arquivos `*.test.ts` — nunca `*.test.tsx`. O repositório já tem `@testing-library/react`, `@testing-library/jest-dom` e `@testing-library/user-event` como devDependencies (pré-existentes, não adicionados nesta fase), o que só faz sentido para testes de componente React, que por convenção usam extensão `.tsx` e precisam de `environment: 'jsdom'`. Do jeito que está, o primeiro teste de componente `.tsx` escrito por alguém do time será **silenciosamente ignorado** pelo `vitest run` (não aparece como falha, só não roda), e mesmo que a extensão fosse `.ts`, ainda falharia por falta de DOM.

**Fix:**
```ts
test: {
  environment: 'jsdom',
  include: ['src/**/*.test.{ts,tsx}'],
},
```
(requer adicionar `jsdom` como devDependency, já que `environment: 'jsdom'` do vitest depende do pacote `jsdom` instalado separadamente).

### WR-03: `GET /sessions/{session_id}/readiness` não declara `response_model`

**File:** `backend/app/routers/sessions.py:382-394`

**Issue:** Todas as outras rotas deste arquivo (`get_session`, `finish_session`, `get_session_report`, `generate_session_report`, `update_session_report_status`, etc.) declaram `response_model=...` com um schema Pydantic explícito. A nova rota de readiness retorna o dataclass `ReadinessScore` diretamente, sem `response_model`:

```python
@router.get("/{session_id}/readiness")
async def get_session_readiness(session_id: UUID, db: Client = Depends(get_supabase)):
    ...
    return pipeline.state.readiness_score()
```

Funciona porque o `jsonable_encoder` do FastAPI sabe serializar dataclasses, mas quebra a consistência do arquivo: o schema OpenAPI gerado para este endpoint fica genérico (sem os 4 campos documentados), e não há validação de tipo na saída como as demais rotas têm. O frontend já espelha o contrato manualmente em `Readiness` (`api.ts`) — um `response_model=ReadinessScoreResponse` faria esse contrato ser verificado automaticamente em vez de depender só do espelhamento manual.

**Fix:** Criar um `ReadinessResponse(BaseModel)` em `backend/app/models/sessions.py` (mesmo padrão de `ReportResponse`) com os 4 campos (`score: float`, `signals: dict[str, float]`, `ready: bool`, `low_signals: list[str]`) e declarar `response_model=ReadinessResponse` na rota.

## Info

### IN-01: `db` injetado mas nunca usado em `get_session_readiness`

**File:** `backend/app/routers/sessions.py:383`

**Issue:** O parâmetro `db: Client = Depends(get_supabase)` é declarado mas nunca referenciado no corpo da função — toda a resolução de estado passa por `pipeline_manager.get_or_create`. Mesmo padrão já existe em `generate_session_questions` (linha 301) nesse arquivo, então não é uma regressão introduzida por este PR, mas continua sendo peso morto na assinatura.

**Fix:** Remover o parâmetro se de fato não for necessário, ou documentar por que a dependência é mantida (ex.: efeito colateral de inicialização de conexão).

### IN-02: `ReadinessBar`/`% pronto` não faz clamp de `readiness.score`

**File:** `frontend/src/pages/ProjectDetailPage.tsx:393-403`

**Issue:** `Math.round((readiness?.score ?? 0) * 100)` é usado tanto no texto ("X% pronto") quanto na largura da barra (`style={{ width: `${pct}%` }}`), sem `Math.min(100, ...)`. Hoje `readiness_score()` no backend é matematicamente limitado a `[0, 1]` por construção (média ponderada de sinais em `[0,1]`), então na prática não estoura — mas não há nenhuma garantia de contrato que impeça um valor futuro > 1 (ex.: um bug num sinal novo) de estourar a barra visualmente (`width: 130%`) sem qualquer aviso.

**Fix:** `Math.min(100, Math.round((readiness?.score ?? 0) * 100))` como defesa barata.

---

_Reviewed: 2026-09-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
