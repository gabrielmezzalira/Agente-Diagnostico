# Phase 7: Taqciti Config + Background Streamer - Research

**Researched:** 2026-09-25
**Domain:** Chrome MV3 extension (TypeScript/React/Vite) — importação de repositório via `git subtree` + streaming de legendas em tempo real para um webhook FastAPI já existente
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Onde o código vive (repositório)**
- **D-01:** O código-fonte completo do repositório `taqciti` (`https://github.com/gabrielmezzalira/taqciti.git`, branch `main`, confirmado limpo e atualizado com origin) é importado para dentro deste repositório via `git subtree`, preservando histórico de commits, numa pasta `taqciti/` na raiz. Isso inclui o `server/` (gerador de documentos DocCITi, um app Next.js separado, sem relação com o Agente) — ele entra junto como peso morto por enquanto; removê-lo ou não é uma decisão futura, separada desta. — **Reversibility:** costly.
- **D-02:** Esta importação é a **Task 1 do primeiro plano da Fase 7**, como um commit isolado (só a importação via subtree, nada de código de feature junto).
- **D-03:** Não se cria uma branch separada no repositório `taqciti`. Toda esta fase usa a única branch já aberta neste repositório (`feat/fase-07-taqciti-config-background-streamer`). `git subtree push` fica para quando o time decidir, fora desta fase.

**session_id antes do binding automático (Fase 8)**
- **D-04:** Campo manual (na tela/painel da Taqciti) onde a pessoa cola o `session_id` da sessão ativa do Agente. Sem esse campo preenchido, o streaming não tem para onde mandar nada.
- **D-05:** Esse campo manual **não é descartável** — é a mesma peça que a Fase 8 (SC2) já prevê como fallback manual quando o auto-detect falhar.

**Cadência e conteúdo do streaming**
- **D-06:** O streamer se conecta ao **mesmo mecanismo de agrupamento (debounce)** que `sessionController.ts` já usa para gravar no `chrome.storage` a cada `CAPTION_CHUNK` — não cria uma cadência própria/paralela.
- **D-07:** Cada envio ao `/webhook/extension` carrega **apenas o texto novo desde o último envio** daquele segmento (mesmo padrão que a extensão antiga do Agente já usa: diff palavra a palavra), e não o texto inteiro do segmento em crescimento.

**Configuração e autenticação (agenteConfig.ts)**
- **D-08:** `agenteConfig.ts` (espelhando o padrão já existente em `serverConfig.ts`) expõe URL do backend do Agente e toggle de streaming como **variável de build** (`VITE_AGENTE_*`), com valor **também editável em runtime** na mesma tela que vai ter o campo de `session_id` manual (D-04) — sem precisar recompilar a extensão.
- **D-09:** O streaming vem **desligado por padrão** (opt-in) nesta build da Taqciti — mesmo espírito da Fase 6.
- **D-10:** A Taqciti reaproveita o mesmo mecanismo de autenticação da Fase 6 — envia o header `x-agente-key` (valor configurável, mesmo campo de config) em toda chamada a `/webhook/extension`. Campo vazio = nenhum header enviado.

### Claude's Discretion
- Nome exato dos campos de configuração na UI da Taqciti (URL do backend, toggle, session_id, chave) e onde exatamente ficam (popup vs. painel lateral) — segue o padrão visual já usado em `serverConfig.ts`/telas existentes da Taqciti.
- Formato/local exato do novo `agenteConfig.ts` dentro de `src/shared/config/` (mesma pasta de `serverConfig.ts`).
- Mecanismo técnico exato de onde no `sessionController.ts`/pipeline de eventos o streamer se pluga (qual side effect, qual função) — decisão de implementação, não de produto.

### Deferred Ideas (OUT OF SCOPE)
- **Enviar as mudanças de volta para o repositório `taqciti` original** (`git subtree push`) — adiado.
- **Remover o `server/` (DocCITi)** trazido junto pelo subtree — decisão futura separada.
- **Deduplicar no backend** (`/webhook/extension`) em vez de na Taqciti — descartado (D-07).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TAQ-01 | Taqciti streams live captions (merged segments) to the backend during the call | Seções "Architecture Patterns" (ponto de plugagem no `sessionController.ts`), "Code Examples" (streamer + diff de palavras), "Don't Hand-Roll" (reuso do debounce e do contrato `/webhook/extension`) |
</phase_requirements>

## Summary

Esta fase tem duas partes bem separadas: (1) uma importação estrutural de repositório via `git subtree` — mecânica de Git, sem ambiguidade — e (2) uma feature de streaming que se pluga num código já maduro e testado (a Taqciti tem 105 commits, ~150 arquivos de source e testes vitest cobrindo a máquina de estados, o agregador de legendas e o merge de legendas). O trabalho da feature é essencialmente: ler o texto **novo** de cada segmento no ponto em que o `sessionController.ts` já teria disparado a gravação no storage, guardar quanto já foi enviado por segmento, e disparar um `fetch` fire-and-forget para `POST /webhook/extension` — endpoint que já existe neste repositório e não muda nesta fase.

A pesquisa confirmou o mecanismo exato de agrupamento (`isCoalescable()` + `scheduleFlush()` + `flushState()` em `taqciti/src/background/sessionController.ts`, debounce de 250 ms via `STATE_FLUSH_INTERVAL_MS`), a estrutura exata do `LiveSegment` (com `captionId` estável por linha de legenda), e o padrão de diff palavra-a-palavra a espelhar (`extension/content_meet.js::emitNew()`, com âncora de N palavras para tolerar reescritas). Um achado importante: o texto de um segmento **pode ser reescrito** (não só crescer) — `mergeVisible()` documenta 4 casos, incluindo correção de acento/pontuação no fim da fala — então um diff por contagem de palavras enviadas ocasionalmente reenviará uma palavra já mandada com grafia corrigida. Isso é aceitável (é o mesmo comportamento da extensão antiga que D-07 manda espelhar) e não quebra nada, porque o backend não deduplica no insert — só gera uma linha a mais em `transcript_chunks`, não uma linha errada.

Outro achado relevante para o planner: `host_permissions: ['<all_urls>']` **já está** no manifesto da Taqciti — não é preciso nenhuma mudança de manifest/permissão MV3 para o `fetch` ao backend do Agente (nem para Railway, nem para `localhost`) funcionar a partir do service worker. Também existe, já testado em produção na Taqciti, um padrão de config runtime multi-contexto pronto para copiar (`src/features/panel/prefsStore.ts` — fila de escrita + `chrome.storage.onChanged` para sincronizar todas as abas/painéis), que é um espelho melhor do D-08 (config editável em runtime) do que o polling a cada 3s usado pelo popup da extensão antiga do Agente.

**Primary recommendation:** importar a Taqciti via `git subtree add --prefix=taqciti https://github.com/gabrielmezzalira/taqciti.git main` (sem `--squash`) como commit isolado após garantir working tree limpa; criar `taqciti/src/shared/config/agenteConfig.ts` espelhando `serverConfig.ts` (env var de build + fallback); criar um novo módulo `taqciti/src/background/agenteStreamer.ts` com estado `Map<captionId, wordsSentCount>` por sessão, chamado a partir de `flushState()` em `sessionController.ts` (mesmo ponto de debounce, D-06); persistir a config runtime (backend URL, toggle, session_id, chave) via o padrão `prefsStore.ts` (fila + `chrome.storage.local` + `onChanged`), com uma nova tela/rota no painel lateral.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Captura e merge de legendas do Meet | Browser / Client (content script) | — | Já implementado na Taqciti (`content/providers/googleMeet`, `features/transcription`); esta fase não toca aqui |
| Agrupamento/debounce de eventos de legenda | Browser / Client (service worker MV3) | — | `sessionController.ts` já é o dono; o streamer é um consumidor a mais do mesmo ponto, não um novo dono |
| Diff palavra-a-palavra (texto novo por segmento) | Browser / Client (service worker MV3) | — | Estado efêmero do streamer (quanto já foi enviado por `captionId`); vive só na sessão viva, não precisa persistir |
| Configuração (URL backend, toggle, session_id, chave) | Browser / Client (chrome.storage.local) | — | Mesmo padrão de `serverConfig.ts`/`prefsStore.ts`; nenhuma configuração do Agente vive no backend nesta fase |
| Envio HTTP do chunk (`fetch`) | Browser / Client (service worker MV3) | — | Fire-and-forget, non-blocking — nunca deve atrasar a captura |
| Recepção, persistência e broadcast do chunk | API / Backend (`backend/app/routers/webhook.py`) | Database / Storage (`transcript_chunks`) | Contrato já existe (Fase 6) e não muda nesta fase — só é respeitado pelo novo chamador |
| Autenticação opcional do webhook (`x-agente-key`) | API / Backend | Browser / Client (envio do header) | Gate já implementado no backend (Fase 6); Taqciti é o segundo consumidor do mesmo mecanismo (D-10) |

## Standard Stack

### Core

Esta fase **não introduz nenhuma dependência nova**. Tudo que a feature precisa já está em `taqciti/package.json` (chega junto pelo `git subtree add`) e em `backend/` (contrato já existe). Ver `taqciti/package.json` lido nesta sessão:

| Library | Version (declarada em `taqciti/package.json`) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react` / `react-dom` | `^18.3.1` | UI do painel lateral/popup | Já em uso em toda a extensão |
| `zod` | `^3.25.0` | Validação de mensagens (`messageSchema`) entre contextos da extensão | Já em uso em `shared/types/messages.ts`; usar o mesmo padrão para validar a config se necessário |
| `vite` + `@crxjs/vite-plugin` | `^6.4.3` / `^2.4.0` | Build MV3 (bundling do manifest, HMR) | Já configurado; nenhuma mudança de build necessária para esta fase |
| `vitest` + `jsdom` | `^3.2.7` / `^29.1.1` | Testes unitários | Framework já configurado (`vitest.config.ts`); novo teste do streamer segue o mesmo padrão |
| `typescript` + `typescript-eslint` | `^5.6.3` / `^8.15.0` | Tipagem estática + lint | `tsc --noEmit` e `eslint src` já são scripts do `package.json` |

**Version verification:** `[VERIFIED: taqciti/package.json:11-33, lido nesta sessão em ../taqciti]` — não é necessário rodar `npm view` porque nenhuma versão nova está sendo escolhida; as versões acima são as que o `git subtree add` vai trazer automaticamente (arquivo de lockfile `package-lock.json` já commitado no repo de origem).

**Installation:** nenhuma instalação de pacote novo. Após o `git subtree add`, rodar `npm ci` dentro de `taqciti/` para materializar `node_modules/` (confirmado ausente em `../taqciti` nesta sessão — `[VERIFIED: ls node_modules em ../taqciti retornou "MISSING", checado nesta sessão]`).

### Supporting

Nenhuma. Nenhuma nova lib é necessária para o diff palavra-a-palavra (função pura, ver Code Examples) nem para o `fetch` (Web API nativa do service worker).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Diff de palavras feito à mão (espelhando `content_meet.js::emitNew`) | Uma lib de diff de texto (ex: `diff-match-patch`) | Overkill: o problema é "quantas palavras já enviei deste segmento", não diff genérico de texto arbitrário; D-07 pede explicitamente espelhar o padrão já existente, não trocar de abordagem |
| `prefsStore.ts` (fila + `onChanged`) para a config do Agente | Reescrever o padrão simples de `popup.js` do `extension/` antigo (polling a cada 3s) | `prefsStore.ts` já resolve exatamente o problema de duas abas divergirem e é o padrão mais recente/idiomático da própria Taqciti; polling é um padrão mais antigo do outro projeto |

## Package Legitimacy Audit

**Não aplicável nesta fase.** Nenhum pacote novo é instalado — a fase consome exclusivamente (a) dependências que chegam junto no `git subtree add` (já auditadas e em uso em produção pela Taqciti) e (b) o contrato HTTP já existente no backend deste repositório. Se, na execução, o planner decidir usar alguma lib adicional para o diff de texto ou para a UI de config, essa decisão deve voltar a passar pelo gate de legitimidade de pacotes antes de ser aprovada.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Google Meet (legendas na página)
    │
    ▼
content script Taqciti (captura + parse, JÁ EXISTENTE — não muda)
    │  chrome.runtime.sendMessage({ type: 'meet/chunk', chunk })
    ▼
background/index.ts (onMessage) ──► dispatch({ type: 'CAPTION_CHUNK', chunk })
    │
    ▼
features/meeting/machine.ts :: transition()
    │  aplica applyCaptionChunk() → segments[] atualizado (merge/append/novo segmento)
    ▼
background/sessionController.ts :: dispatch()
    │
    ├─ isCoalescable(event) === true (CAPTION_CHUNK)
    │       │
    │       ▼
    │   scheduleFlush()  ── debounce 250ms (STATE_FLUSH_INTERVAL_MS) ──┐
    │                                                                   │
    └─ outros eventos ──────────────────────────────────────────────►  │
                                                                        ▼
                                                                  flushState()
                                                              ┌─────────┴─────────┐
                                                              ▼                   ▼
                                                     writeSession(state)   broadcast()
                                                     (chrome.storage)      (painel/aba)
                                                              │
                                                              ▼  ★ NOVO — plugagem desta fase
                                                     agenteStreamer.onFlush(state.session)
                                                              │
                                                              ▼
                                            calcula delta por segmento (diff palavra-a-palavra,
                                            Map<captionId, wordsSentCount>)
                                                              │
                                                    (streaming habilitado E session_id preenchido?)
                                                              │ sim
                                                              ▼
                                              fetch POST {agenteBackendUrl}/webhook/extension
                                              headers: Content-Type, x-agente-key? (D-10)
                                              body: { session_id, text: delta, speaker }
                                                              │
                                                              ▼
                              backend/app/routers/webhook.py :: extension_webhook()  (JÁ EXISTE)
                                      │                                  │
                                      ▼                                  ▼
                          insert em transcript_chunks          pipeline_manager.push_chunk()
                          (Supabase)                            (asyncio.create_task, fire-and-forget)

Configuração (D-08, D-09, D-10) ── nova tela no painel lateral / popup ──►
    chrome.storage.local (padrão prefsStore.ts: fila de escrita + onChanged)
    campos: agenteBackendUrl, streamingEnabled, agenteSessionId, agenteApiKey
    lidos por agenteStreamer no momento do flush (fallback: VITE_AGENTE_* de build)

Fluxo em lote (SC2 — não pode regredir):
document/generateDocument.ts :: requestGeneration() ──► POST {SERVER_BASE_URL}/api/generate
    (server/ Next.js — DocCITi — intocado por esta fase)
```

### Recommended Project Structure

```
taqciti/
├── src/
│   ├── background/
│   │   ├── sessionController.ts   # existente — só ganha 1 chamada nova em flushState()
│   │   ├── agenteStreamer.ts      # NOVO — módulo puro + efeito de fetch (streaming da fase 7)
│   │   └── agenteStreamer.test.ts # NOVO — testes do diff e do gate on/off
│   ├── shared/
│   │   └── config/
│   │       ├── serverConfig.ts    # existente — padrão a espelhar
│   │       ├── agenteConfig.ts    # NOVO — espelha serverConfig.ts (D-08)
│   │       └── agenteConfigStore.ts # NOVO (opcional) — espelha prefsStore.ts para runtime override
│   └── sidepanel/
│       └── screens/
│           └── AgenteConfigScreen.tsx  # NOVO (nome/local a critério do executor) — campos D-04/D-08/D-09/D-10
```

### Pattern 1: Plugar no ponto de debounce já existente (D-06)

**What:** o streamer não cria seu próprio timer; ele é chamado dentro de `flushState()`, que já roda a cada 250ms quando há `CAPTION_CHUNK`s coalescidos (e imediatamente para qualquer outro evento).
**When to use:** sempre que uma feature nova precisa "ver" o estado após um lote de legendas, sem duplicar o debounce.
**Example (ponto exato de plugagem — trecho já lido nesta sessão):**
```typescript
// Fonte: taqciti/src/background/sessionController.ts:167-174 (lido nesta sessão)
async function flushState(): Promise<void> {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await writeSession(STORAGE_KEYS.state, state);
  broadcast();
  // ★ NOVO nesta fase: void onSessionFlushed(state).catch((error) =>
  //     logger.error('streamer do Agente falhou', error));
  //   Fire-and-forget dentro do próprio flush — nunca bloqueia writeSession/broadcast.
}
```

### Pattern 2: Diff palavra-a-palavra por segmento (D-07)

**What:** cada segmento (`LiveSegment`, chave `captionId`) mantém, do lado do streamer, quantas palavras já foram enviadas. A cada flush, recorta só a cauda nova.
**When to use:** streaming incremental de texto que cresce (e ocasionalmente é reescrito) por chunks.
**Reference (padrão a espelhar, já em produção na extensão antiga do Agente):**
```javascript
// Fonte: extension/content_meet.js:96-127 (lido nesta sessão) — padrão de referência do D-07
// Emite só as PALAVRAS NOVAS no fim da legenda, ignorando o que já foi enviado
function emitNew() {
  const words = currentText.replace(/\n/g, ' ').split(/\s+/).filter(Boolean)
  let startIdx = 0
  if (emittedTail.length) {
    // ... âncora de até 4 palavras para achar o ponto novo, tolerando resets parciais
  }
  const newWords = words.slice(startIdx)
  // ...
}
```
**Adaptação necessária para a Taqciti (não copiar 1:1):** o `content_meet.js` antigo tem **um único** `currentText`/`emittedTail` global (uma fala de cada vez). A Taqciti mantém **múltiplos segmentos simultâneos** (`state.session.segments: LiveSegment[]`, um por `captionId`) — o streamer precisa de um mapa `Map<captionId, wordsSentCount>` (ou `lastSentWordCount` por segmento), não uma única variável. Estrutura sugerida:
```typescript
// taqciti/src/background/agenteStreamer.ts (esboço — nomes a critério do executor)
const sentWordCount = new Map<string, number>(); // captionId -> nº de palavras já enviadas

function wordsOf(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

function newTextFor(segment: LiveSegment): string {
  const words = wordsOf(segment.text);
  const already = sentWordCount.get(segment.captionId) ?? 0;
  const fresh = words.slice(already);
  sentWordCount.set(segment.captionId, words.length);
  return fresh.join(' ');
}
```
**Limitação aceita (documentar, não corrigir):** `mergeVisible()` (`taqciti/src/features/transcription/mergeCaption.ts:89-124`, lido nesta sessão) reescreve o **fim** de um segmento no "caso 2b" (correção de acento/pontuação: `"o orcamento"` → `"o orçamento."`) sem crescer a contagem de palavras na mesma proporção do texto novo. Um diff por contagem de palavras pode, nesse caso raro, reenviar 1-2 palavras já mandadas com grafia diferente, ou perder a correção. É o **mesmo comportamento** da extensão antiga do Agente (`content_meet.js`) — D-07 pede espelhar esse padrão, não resolver esse caso à parte. O backend não deduplica no insert (D-07 já assume isso), então o efeito é no máximo uma linha a mais em `transcript_chunks`, nunca uma quebra.

### Pattern 3: Config runtime multi-contexto (referência para D-08)

**What:** fila de escrita (patch, não objeto inteiro) + `chrome.storage.onChanged` para todo contexto (painel, popup, aba com painel injetado) ficar sincronizado sem polling.
**When to use:** qualquer config editável em runtime que precisa ser lida por mais de uma superfície da extensão ao mesmo tempo — exatamente o caso de D-08 (a URL/toggle/chave precisam valer tanto para o streamer no service worker quanto para a tela de config).
**Example (padrão já testado em produção na própria Taqciti):**
```typescript
// Fonte: taqciti/src/features/panel/prefsStore.ts:57-64 (lido nesta sessão)
export function patchPanelPrefs(patch: Partial<PanelPrefs>): Promise<PanelPrefs> {
  queue = queue.then(async () => {
    const next = normalizePanelPrefs({ ...(await loadPanelPrefs()), ...patch });
    await writeLocal(STORAGE_KEYS.prefs, next);
    return next;
  });
  return queue;
}
```
Recomenda-se um `agenteConfigStore.ts` análogo (`patchAgenteConfig`/`subscribeAgenteConfig`) em vez de reescrever o padrão de polling do popup antigo do Agente — a Taqciti já tem um padrão melhor e testado (`prefsStore.test.ts` existe).

### Anti-Patterns to Avoid

- **Criar um segundo timer/debounce para o streamer:** D-06 é explícito — reusar `scheduleFlush()`/`flushState()`. Um timer paralelo duplicaria o custo que `sessionController.ts` já resolveu (ver o comentário de linha 155-159 do arquivo sobre o custo quadrático de retransmitir o estado inteiro a cada legenda).
- **Enviar o texto inteiro do segmento a cada flush:** D-07 proíbe explicitamente — quebraria `transcript_chunks` com texto duplicado a cada envio (o webhook não deduplica no insert).
- **Bloquear a captura esperando a resposta do `fetch`:** o padrão do projeto (ver `06-CONTEXT.md` e `backend/app/routers/webhook.py`) é fire-and-forget; uma falha de rede no Agente NUNCA pode atrasar ou travar a captura do Meet. `flushState()` já é `async` mas não deve `await` o `fetch` do streamer de forma bloqueante — disparar e tratar erro só em log.
- **Adicionar `host_permissions` novo para o backend do Agente:** desnecessário — `<all_urls>` já cobre (ver `manifest.config.ts:169`, lido nesta sessão). Adicionar uma entrada mais específica não muda nada e só adiciona superfície de manutenção.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Agrupamento de eventos de legenda (debounce) | Um novo timer/queue no streamer | `scheduleFlush()`/`isCoalescable()`/`flushState()` já existentes em `sessionController.ts` | D-06; já testado, já resolve o custo quadrático documentado no próprio arquivo |
| Merge/reconstrução de texto de legenda | Lógica própria de "o que mudou na legenda" | `applyCaptionChunk()` + `mergeVisible()` (já existentes) — o streamer só lê `state.session.segments` depois de já mesclado | A Taqciti já resolve os 4 casos de reescrita de legenda do Meet (crescimento, correção de fim, corte de início, reuso de linha); reimplementar seria redescobrir bugs já corrigidos |
| Sincronização de config entre abas/painéis | Polling manual (`setInterval` + `GET_STATE`) | `chrome.storage.onChanged` + fila de escrita (padrão `prefsStore.ts`) | Já resolve exatamente esse problema em produção na própria Taqciti (ver comentário de cabeçalho do arquivo, linhas 13-26) |
| Validação de mensagens entre contextos da extensão | `if/else` manual de shape | `zod` via `messageSchema` (`shared/types/messages.ts`) — só necessário se o streamer introduzir uma nova mensagem entre contextos | Já é o padrão estabelecido (`onMessage`/`sendMessage` em `shared/services/messaging.ts`) |

**Key insight:** esta fase é, na maior parte, um exercício de **não reescrever** o que a Taqciti já resolveu — o valor da fase está em plugar no lugar certo (debounce), no formato certo (delta por segmento) e com o gate certo (opt-in + auth reaproveitada), não em nova lógica de captura.

## Common Pitfalls

### Pitfall 1: Tentar importar via subtree com o working tree sujo
**What goes wrong:** `git subtree add` falha (ou, pior, mistura mudanças não relacionadas no mesmo merge commit) se houver alterações não commitadas.
**Why it happens:** `git subtree` roda uma checagem equivalente à de `git merge` — exige working tree limpo. `[VERIFIED: git status --porcelain neste repo, lido nesta sessão]` mostra hoje: `M .planning/config.json`, `M CLAUDE.md`, `?? .planning/debug/` — working tree **não está limpo** no momento desta pesquisa.
**How to avoid:** antes da Task 1, commitar (ou stash) essas mudanças **separadamente** do commit da importação — D-02 exige que o commit do subtree seja isolado ("só a importação via subtree, nada de código de feature junto"). Sugestão: um commit `docs: ...` para `.planning/config.json`/`CLAUDE.md`/`.planning/debug/` antes, depois o subtree add como commit seguinte.
**Warning signs:** `git subtree add` recusando rodar com mensagem sobre working tree sujo, ou (se forçado) um merge commit com arquivos de `.planning/` misturados aos de `taqciti/`.

### Pitfall 2: Usar `--squash` no subtree add
**What goes wrong:** perde o histórico de commits da Taqciti — direto contrário a D-01 ("preservando histórico").
**Why it happens:** `--squash` é a opção mais comumente recomendada em tutoriais de `git subtree` (reduz ruído no log), mas colapsa toda a história importada num único commit.
**How to avoid:** rodar sem `--squash`: `git subtree add --prefix=taqciti https://github.com/gabrielmezzalira/taqciti.git main` (sem a flag). Confirmar depois com `git log --follow taqciti/README.md` mostrando múltiplos commits antigos da Taqciti.
**Warning signs:** o merge commit resultante tem só 1 commit de diferença na árvore do lado da Taqciti (`git log --graph` mostrando um único nó estranho ao invés de ~105 commits).

### Pitfall 3: Reverter o merge commit do subtree com `git revert` simples
**What goes wrong:** `git revert <merge-sha>` sem `-m 1` falha com erro ("commit is a merge but no -m option was given").
**Why it happens:** o commit do `subtree add` é um merge de 2 parents (histórico local + histórico importado); `git revert` precisa saber qual parent é o "mainline".
**How to avoid:** documentar o rollback correto: `git revert -m 1 <merge-sha>` (mantém o histórico local como mainline). Alternativa mais simples **enquanto a branch não foi enviada/mergeada**: `git reset --hard <sha-antes-do-subtree>` (a branch é local e isolada — CLAUDE.md permite reset apenas com cuidado; preferir revert se já houver commits em cima).
**Warning signs:** tentativa de revert falhando com a mensagem de erro acima.

### Pitfall 4: Streamer duplicando texto por reentrada de flush
**What goes wrong:** se o mapa `sentWordCount` não for resetado corretamente numa nova sessão (`MEETING_DETECTED` com sessão nova, ou `RESET`), o streamer da sessão anterior pode continuar contando a partir de um estado velho, ou (pior) uma sessão nova reusar `captionId`s de uma anterior e herdar contagem indevida.
**Why it happens:** o estado do streamer (`Map<captionId, wordsSentCount>`) vive fora da máquina de estados (`transition()`), como módulo próprio no service worker — precisa ser explicitamente limpo nos mesmos pontos em que `sessionController.ts` já limpa/sela segmentos (`PAUSE`, `CLEAR_TRANSCRIPT`, nova sessão via `MEETING_DETECTED`).
**How to avoid:** resetar o `Map` sempre que `state.session?.meetingId` mudar entre um flush e o anterior (comparar o `meetingId`, não confiar em `captionId` sozinho — `captionId` é só estável **dentro** de uma sessão, não entre sessões diferentes, ver comentário em `LiveSegment` sobre isso).
**Warning signs:** teste que simula duas sessões seguidas mandando texto — se o segundo `fetch` de uma sessão nova vier com delta vazio ou incorreto, o reset não está acontecendo.

### Pitfall 5: `npm ci` não rodado após o subtree add
**What goes wrong:** `npm run test`/`typecheck`/`build` dentro de `taqciti/` falham com "module not found" porque `node_modules/` não existe.
**Why it happens:** `git subtree add` só traz os arquivos versionados; `node_modules/` está no `.gitignore` da Taqciti e nunca foi commitado. `[VERIFIED: ls node_modules em ../taqciti retornou "MISSING", checado nesta sessão]`.
**How to avoid:** primeira task de código (depois do subtree) deve incluir `npm ci` dentro de `taqciti/` antes de rodar qualquer teste/typecheck.
**Warning signs:** erro `Cannot find module 'react'` (ou qualquer dependência) ao rodar `npx vitest` pela primeira vez.

## Code Examples

### Estrutura de `agenteConfig.ts` (espelhando `serverConfig.ts`)
```typescript
// Fonte de referência: taqciti/src/shared/config/serverConfig.ts:1-34 (lido nesta sessão, integral)
// Padrão a reproduzir para o Agente (nomes de env var a critério do executor,
// mas devem seguir o prefixo VITE_AGENTE_* citado em D-08):

export const AGENTE_BACKEND_URL_DEFAULT =
  import.meta.env.VITE_AGENTE_BACKEND_URL ?? 'http://localhost:8000';

export const AGENTE_STREAMING_ENABLED_DEFAULT =
  (import.meta.env.VITE_AGENTE_STREAMING_ENABLED ?? 'false') === 'true'; // D-09: default OFF

export const AGENTE_KEY_HEADER = 'x-agente-key'; // espelha backend/app/routers/webhook.py:26 (D-10)
```
**Nota:** diferente de `SERVER_SHARED_KEY` (que tem um valor-padrão público, pensado para um servidor local de dev), a chave do Agente (D-10) **não deve** ter um valor-padrão embutido no bundle — ela é sempre lida do storage runtime (vazio = sem header), pois o gate real (`EXTENSION_SHARED_KEY` no backend) é opt-in e nem sempre configurado (ver Fase 6, D-03: ainda não ativado em produção).

### Contrato HTTP exato que a Taqciti deve enviar
```
POST {agenteBackendUrl}/webhook/extension
Content-Type: application/json
x-agente-key: <valor configurado>        # OMITIR o header inteiro se vazio (D-10)

{
  "session_id": "<uuid da sessão do Agente, colado manualmente — D-04>",
  "text": "<apenas as palavras novas deste segmento desde o último envio — D-07>",
  "speaker": "<nome do falante ou null>"
}
```
**Fonte:** `ExtensionChunk` em `backend/app/routers/webhook.py:14-17` (lido nesta sessão) — `session_id: str`, `text: str`, `speaker: str | None = None`. Resposta: `202 {"accepted": true}` (ou `{"accepted": true}` sem insert se `text` vazio após `strip()`).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Extensão própria do Agente (`extension/`) captura, faz diff de 1 fala por vez, e envia via WebSocket + fetch | Taqciti captura com máquina de estados + múltiplos segmentos concorrentes, streaming ainda não existe (esta fase adiciona) | Fase 7 (esta) | A extensão antiga (`extension/`) continua sendo a referência de padrão (D-07), mas o motor de captura passa a ser o da Taqciti, mais robusto a rolagem de janela de legenda e a múltiplas falas simultâneas |
| `google-generativeai` (deprecated, mencionado na Seção 9 do CLAUDE.md) | `google.genai` | Já migrado antes desta fase, não afeta Fase 7 (que é 100% frontend/extensão do lado que streama) | N/A para esta fase — mencionado só para não confundir escopo |

**Deprecated/outdated:** nenhuma API usada nesta fase está deprecada. `fetch` nativo, `chrome.storage`, MV3 service worker — todos correntes para Chrome ≥116 (`minimum_chrome_version` do manifesto, lido nesta sessão).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | O nome de tela/rota exata para a config do Agente no painel lateral (ex: uma nova entrada em `PanelRoute`) é a melhor forma de expor D-04/D-08/D-09/D-10 — não há tela de "configurações" hoje na Taqciti (confirmado: `sidepanel/App.tsx` só roteia por fase da máquina de estados, sem rota de config) | Architecture Patterns / Pattern 3 | Baixo — é explicitamente "Claude's Discretion" no CONTEXT.md; se o executor escolher outro lugar (ex: popup, já que `popup/App.tsx` existe mas não está ligado ao manifest — ver nota abaixo), não quebra nenhum requisito |
| A2 | O `popup/index.html`/`popup/App.tsx` **não está** referenciado por `default_popup` no manifesto (`[VERIFIED: manifest.config.ts:76-85, lido nesta sessão — comentário explícito "Sem default_popup de propósito"]`) — logo a superfície viva para qualquer config nova é o painel lateral/painel injetado, não o popup | Architecture Patterns | Baixo — é uma observação factual verificada, não uma suposição de risco |

**Se esta tabela parecer pequena:** a maior parte das decisões de produto já estava fechada no CONTEXT.md (D-01 a D-10); as únicas áreas remanescentes são de implementação (nome de arquivo/tela), marcadas como discrição do executor pelo próprio CONTEXT.md.

## Open Questions

1. **O streamer deve respeitar o "gate de budget" do backend (F7 do SDD v2.0) antes de mandar chunks?**
   - What we know: `extension_webhook()` hoje não verifica budget — só insere e empurra pro pipeline. O corte por budget (se existir na v3.0 atual) acontece no pipeline/LLM, não no recebimento do chunk.
   - What's unclear: se em algum caso o backend rejeitar (ex: sessão `finished`), o streamer deve tratar erro silenciosamente (log) — não há requisito de "parar de tentar".
   - Recommendation: comportamento fire-and-forget com log de erro é suficiente para esta fase; não é um SC desta fase.

2. **Onde exatamente a rota/tela de config deve entrar na navegação do painel lateral?**
   - What we know: não existe hoje nenhuma tela de "configurações" na Taqciti; `PanelRoute` só tem `auto` / `history` / `record`.
   - What's unclear: se o executor deve estender `PanelRoute` com um novo `kind: 'config'`, ou usar uma superfície separada (ex: reaproveitar `popup/App.tsx`, ligando-o via `default_popup` no manifest — o que mudaria o comportamento hoje documentado como proposital de abrir o painel injetado no clique do ícone).
   - Recommendation: **não** ligar `default_popup` (quebraria o comportamento documentado em `manifest.config.ts:76-85` de abrir o painel injetado); estender `PanelRoute`/`sidepanel` é o caminho que não regride nada existente. Decisão de nome/UX fica com o executor (Claude's Discretion, conforme CONTEXT.md).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `git` (com suporte a `subtree`) | Task 1 — importação do repositório | ✓ | 2.51.2.windows.1 | — |
| `node` | Build/test da Taqciti após import | ✓ | v24.12.0 | — |
| `npm` | `npm ci` / scripts do `package.json` da Taqciti | ✓ | 11.13.0 | — |
| `python` (backend, não muda nesta fase) | N/A — backend intocado | ✓ | 3.13.14 | — |
| Repositório `../taqciti` (clone local read-only para pesquisa) | Confirmar paths antes de citar em RESEARCH.md | ✓ | branch `main`, HEAD `c41309a`, working tree limpo | — |

**Missing dependencies with no fallback:** nenhuma.
**Missing dependencies with fallback:** nenhuma.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `^3.2.7` (ambiente `jsdom`) — `[VERIFIED: taqciti/vitest.config.ts, lido nesta sessão, integral]` |
| Config file | `taqciti/vitest.config.ts` (alias `@` → `taqciti/src`, `include: ['src/**/*.test.{ts,tsx}']`) |
| Quick run command | `cd taqciti && npx vitest run src/background/agenteStreamer.test.ts` (arquivo novo desta fase) |
| Full suite command | `cd taqciti && npm test` (= `vitest run`, roda toda a suíte da Taqciti) |

Comandos adicionais confirmados em `taqciti/package.json` (lido nesta sessão): `npm run typecheck` (`tsc --noEmit`), `npm run lint` (`eslint src`), `npm run build` (`vite build`). Rodar `npm ci` antes de qualquer um destes (node_modules ausente hoje).

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TAQ-01 | Diff palavra-a-palavra por segmento calcula corretamente o texto novo (inclui caso de reescrita de fim, múltiplos segmentos concorrentes, reset em nova sessão) | unit | `cd taqciti && npx vitest run src/background/agenteStreamer.test.ts` | ❌ Wave 0 — arquivo novo |
| TAQ-01 | Streamer só dispara `fetch` quando `streamingEnabled=true` e `session_id` preenchido (D-09) | unit | `cd taqciti && npx vitest run src/background/agenteStreamer.test.ts` | ❌ Wave 0 — mesmo arquivo, casos adicionais |
| TAQ-01 | Header `x-agente-key` é omitido quando a chave está vazia, presente quando preenchida (D-10) | unit | `cd taqciti && npx vitest run src/background/agenteStreamer.test.ts` | ❌ Wave 0 |
| TAQ-01 (SC2) | Fluxo em lote `POST /api/generate` continua funcionando sem regressão | unit (já existente) | `cd taqciti && npx vitest run src/document/generateDocument.test.ts` (não existe hoje — ver nota) | ⚠️ Não há teste unitário hoje para `generateDocument.ts`; o SC2 é melhor verificado manualmente (ver abaixo) — não é regressão de código nesta fase (nenhuma linha de `generateDocument.ts` muda), mas vale registrar a ausência |
| TAQ-01 (backend, D-10) | Contrato `/webhook/extension` + `verify_extension_key` já coberto | unit (já existente) | `cd backend && pytest tests/test_webhook_auth.py -x` | ✅ já existe (`backend/tests/test_webhook_auth.py`, confirmado nesta sessão) |

### Sampling Rate
- **Per task commit:** `cd taqciti && npx vitest run src/background/agenteStreamer.test.ts` (e `npx tsc --noEmit` se a task tocar tipos)
- **Per wave merge:** `cd taqciti && npm test && npm run typecheck` — full suite
- **Phase gate:** full suite verde (`npm test` na Taqciti + `pytest` no backend, este último já verde e intocado) antes de `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `taqciti/src/background/agenteStreamer.test.ts` — cobre TAQ-01 (diff, gate on/off, header condicional, reset de sessão)
- [ ] `npm ci` dentro de `taqciti/` — pré-requisito de qualquer teste rodar (node_modules ausente hoje)
- [ ] Nenhum novo teste é necessário no backend — contrato não muda e já tem cobertura (`test_webhook_auth.py`)

**Verificação manual do SC2 (fluxo em lote não regride):** como não há teste automatizado hoje para `generateDocument.ts`/`requestGeneration()`, a verificação ponta-a-ponta deste critério de sucesso deve ser manual: abrir uma reunião de teste, encerrar, usar "Gerar Documento" (ata) e confirmar que o `POST {SERVER_BASE_URL}/api/generate` ainda funciona e devolve o documento — sem nenhuma mudança de comportamento perceptível. Isso é esperado ser trivial de confirmar porque nenhuma linha de `generateDocument.ts` é tocada nesta fase.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Parcial | Header `x-agente-key` comparado por `secrets.compare_digest` no backend (já implementado, Fase 6) — a Taqciti só precisa **enviar** o header corretamente (D-10); não implementa autenticação nova |
| V3 Session Management | Não | Não há sessão de usuário aqui — `session_id` é um identificador de sessão de diagnóstico colado manualmente (D-04), não uma credencial |
| V4 Access Control | Não | Fora de escopo — TAQ-02 (Fase 8) trata do binding correto de sessão; esta fase não valida quem pode usar qual `session_id` |
| V5 Input Validation | Sim | Backend já valida via Pydantic (`ExtensionChunk`); do lado da Taqciti, validar que `agenteBackendUrl` é uma URL bem-formada antes de tentar o `fetch` (mesmo padrão de `normalizeUrl()` do `extension/background.js`, ou o padrão zod já usado em `messages.ts`) |
| V6 Cryptography | Não | Nenhum dado é cifrado nesta fase; a chave `x-agente-key` é um shared-secret simples, já com a ressalva documentada na Fase 6 de que não é autenticação forte |

### Known Threat Patterns for este stack (MV3 + FastAPI)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Vazamento do `x-agente-key`/URL do backend no bundle (chave hardcoded no código-fonte da extensão, visível a qualquer um que abra o `.crx`) | Information Disclosure | Nunca dar um valor-padrão embutido para a chave (diferente de `SERVER_SHARED_KEY`, que é intencionalmente pública); manter o campo vazio por padrão e só popular via storage local da máquina de quem usa |
| `fetch` para uma URL de backend forjada/errada configurada por engano (ex: `session_id` de outra pessoa colado por engano em D-04) | Tampering / Repudiation (dados de outra sessão) | Fora de escopo desta fase (é o problema que a Fase 8/TAQ-02 resolve com auto-detect); mitigação aqui é só validação de formato de UUID no campo, não de autorização |
| Bloqueio da captura de legendas por uma falha de rede do `fetch` ao Agente | Denial of Service (self-inflicted) | Fire-and-forget, sem `await` bloqueante no caminho crítico da captura (padrão já estabelecido no projeto, ver `06-CONTEXT.md`) |

## Sources

### Primary (HIGH confidence)
- `../taqciti` (clone local, branch `main`, HEAD `c41309a1c58f3fa06095db877e6dc8f1dbd65635`, idêntico a `origin/main`) — arquivos lidos integralmente nesta sessão: `src/background/sessionController.ts`, `src/background/index.ts`, `src/features/transcription/aggregator.ts`, `src/features/transcription/mergeCaption.ts`, `src/features/meeting/machine.ts`, `src/shared/types/domain.ts`, `src/shared/config/serverConfig.ts`, `src/shared/config/constants.ts`, `src/shared/services/storage.ts`, `src/shared/services/messaging.ts`, `src/features/panel/prefsStore.ts`, `src/document/generateDocument.ts`, `src/popup/App.tsx`, `src/sidepanel/App.tsx`, `src/sidepanel/screens/HomeScreen.tsx`, `manifest.config.ts`, `vitest.config.ts`, `package.json`, `.gitattributes`, `.gitignore`
- `backend/app/routers/webhook.py`, `backend/app/config.py` (este repositório) — lidos integralmente nesta sessão
- `extension/background.js`, `extension/content_meet.js`, `extension/popup.html`, `extension/popup.js` (este repositório) — lidos integralmente nesta sessão
- `.planning/phases/07-taqciti-config-background-streamer/07-CONTEXT.md`, `.planning/phases/06-opt-in-webhook-auth/06-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — lidos integralmente nesta sessão
- Comandos read-only executados nesta sessão: `git log`/`git status`/`git ls-files` em `../taqciti`; `git subtree --help`, `git subtree add --help`, `git status --porcelain`, `git config --get core.autocrlf` neste repositório; `node --version`, `npm --version`, `python --version`

### Secondary (MEDIUM confidence)
- Nenhuma — toda a pesquisa desta fase foi possível com leitura direta de código local (não foi necessário WebSearch/Context7, já que o domínio inteiro — MV3, Vite, Vitest, git subtree — está resolvido por documentação já lida em sessões anteriores e por leitura de código de primeira mão)

### Tertiary (LOW confidence)
- Nenhuma

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — nenhuma dependência nova, tudo lido diretamente do `package.json` do repositório de origem
- Architecture: HIGH — ponto de plugagem, formato de dados e padrão de diff confirmados por leitura direta de código-fonte (não por inferência)
- Pitfalls: HIGH — working tree sujo e ausência de `node_modules` confirmados por comandos rodados nesta sessão; comportamento de `git revert -m 1` e de `--squash` é conhecimento consolidado de Git, não específico deste projeto

**Research date:** 2026-09-25
**Valid until:** 30 dias (stack estável — Chrome MV3, Vite, Vitest, FastAPI já em produção; risco de mudança só se `../taqciti` receber novos commits no upstream antes da execução — reconferir `git log -1` no remoto antes de rodar a Task 1 se muito tempo tiver passado)
