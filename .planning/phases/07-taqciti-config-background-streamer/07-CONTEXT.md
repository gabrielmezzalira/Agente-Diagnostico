# Phase 7: Taqciti Config + Background Streamer - Context

**Gathered:** 2026-09-25
**Status:** Ready for planning

<domain>
## Phase Boundary

A Taqciti (extensão de captura do Google Meet, hoje num repositório próprio e separado) passa a
enviar os segmentos de legenda já mesclados para o backend do Agente Diagnóstico
(`POST /webhook/extension`) durante a chamada, em quase-tempo-real — sem quebrar o fluxo em lote
que ela já tem hoje (`POST /api/generate`, usado para gerar atas/documentos ao final da reunião).

Esta fase também decide, de forma estrutural, ONDE esse código passa a viver: o código-fonte da
Taqciti entra neste mesmo repositório (Agente Diagnóstico), via `git subtree`, numa pasta
`taqciti/` — deixando de ser um repositório externo coordenado à parte. Essa importação em si é
parte do trabalho desta fase (não uma tarefa de infraestrutura separada).

Fora do escopo desta fase: o binding automático de sessão (ler `localStorage`, detectar a sessão
ativa) é da Fase 8 (TAQ-02) — esta fase só entrega o campo manual de session_id que a Fase 8 vai
completar com auto-detect por cima.

</domain>

<decisions>
## Implementation Decisions

### Onde o código vive (repositório)
- **D-01:** O código-fonte completo do repositório `taqciti`
  (`https://github.com/gabrielmezzalira/taqciti.git`, branch `main`, confirmado limpo e
  atualizado com origin) é importado para dentro deste repositório via `git subtree`, preservando
  histórico de commits, numa pasta `taqciti/` na raiz. Isso inclui o `server/` (gerador de
  documentos DocCITi, um app Next.js separado, sem relação com o Agente) — ele entra junto como
  peso morto por enquanto; removê-lo ou não é uma decisão futura, separada desta.
  — **Reversibility:** costly — é possível separar de volta com `git subtree split`, mas depois que
  outros commits tocarem os mesmos arquivos dos dois lados (aqui e no repo original), reconciliar
  fica mais trabalhoso quanto mais tempo passar.
- **D-02:** Esta importação é a **Task 1 do primeiro plano da Fase 7**, como um commit isolado
  (só a importação via subtree, nada de código de feature junto) — não acontece manualmente fora
  do fluxo do GSD.
- **D-03:** Não se cria uma branch separada no repositório `taqciti`. Toda esta fase — subtree +
  feature — usa a única branch já aberta neste repositório
  (`feat/fase-07-taqciti-config-background-streamer`). Mandar as mudanças de volta pro repositório
  `taqciti` original (via `git subtree push`) fica para quando o time decidir, fora desta fase.

### session_id antes do binding automático (Fase 8)
- **D-04:** Como o binding automático de sessão é escopo da Fase 8 (TAQ-02), esta fase entrega um
  **campo manual** (na tela/painel da Taqciti) onde a pessoa cola o `session_id` da sessão ativa do
  Agente. Sem esse campo preenchido, o streaming não tem para onde mandar nada.
- **D-05:** Esse campo manual **não é descartável** — é a mesma peça que a Fase 8 (SC2) já prevê
  como fallback manual quando o auto-detect falhar. A Fase 8 adiciona a detecção automática por
  cima deste campo; não o reconstrói do zero.

### Cadência e conteúdo do streaming
- **D-06:** O streamer se conecta ao **mesmo mecanismo de agrupamento (debounce)** que
  `sessionController.ts` já usa para gravar no `chrome.storage` a cada `CAPTION_CHUNK` — não cria
  uma cadência própria/paralela. Um só ponto de agrupamento no código.
- **D-07:** Cada envio ao `/webhook/extension` carrega **apenas o texto novo desde o último envio**
  daquele segmento (mesmo padrão que a extensão antiga do Agente já usa: diff palavra a palavra),
  e não o texto inteiro do segmento em crescimento. Isso evita duplicar linhas na tabela
  `transcript_chunks` — o webhook não deduplica no `insert`, só o pipeline em memória deduplica o
  broadcast, não a escrita no banco.

### Configuração e autenticação (agenteConfig.ts)
- **D-08:** `agenteConfig.ts` (espelhando o padrão já existente em `serverConfig.ts`) expõe URL do
  backend do Agente e toggle de streaming como **variável de build** (`VITE_AGENTE_*`), com valor
  **também editável em runtime** na mesma tela que vai ter o campo de `session_id` manual (D-04) —
  sem precisar recompilar a extensão para trocar de ambiente.
- **D-09:** O streaming vem **desligado por padrão** (opt-in) nesta build da Taqciti — mesmo
  espírito da Fase 6 (chave `EXTENSION_SHARED_KEY` opt-in): ninguém é afetado até decidir ligar.
- **D-10:** A Taqciti reaproveita o mesmo mecanismo de autenticação da Fase 6 — envia o header
  `x-agente-key` (valor configurável, mesmo campo de config) em toda chamada a
  `/webhook/extension`. Campo vazio = nenhum header enviado = comportamento idêntico ao de hoje
  enquanto `EXTENSION_SHARED_KEY` não estiver configurada em produção.

### Claude's Discretion
- Nome exato dos campos de configuração na UI da Taqciti (URL do backend, toggle, session_id,
  chave) e onde exatamente ficam (popup vs. painel lateral) — segue o padrão visual já usado em
  `serverConfig.ts`/telas existentes da Taqciti.
- Formato/local exato do novo `agenteConfig.ts` dentro de `src/shared/config/` (mesma pasta de
  `serverConfig.ts`).
- Mecanismo técnico exato de onde no `sessionController.ts`/pipeline de eventos o streamer se
  pluga (qual side effect, qual função) — decisão de implementação, não de produto.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap e requisitos
- `.planning/ROADMAP.md` §"Phase 7: Taqciti Config + Background Streamer" — goal, 3 success
  criteria, TAQ-01.
- `.planning/REQUIREMENTS.md` §"Taqciti Transcription (TAQ)" — TAQ-01, TAQ-02 (Fase 8, fora de
  escopo aqui), TAQ-03 (Fase 6, já implementada).
- `.planning/STATE.md` §Blockers/Concerns — nota "Phases 7-8 live in the separate Taqciti repo —
  coordinate access/branch strategy before starting Phase 7" — **resolvida por esta discussão**
  (D-01/D-02/D-03: código importado para este repositório, sem branch separada).
- `.planning/phases/06-opt-in-webhook-auth/06-CONTEXT.md` — decisões da Fase 6 sobre o gate
  opt-in `x-agente-key` / `EXTENSION_SHARED_KEY`, que esta fase reaproveita (D-10).

### Código a alterar — backend do Agente (já neste repositório)
- `backend/app/routers/webhook.py` — `extension_webhook()` (linhas 30-52), `verify_extension_key()`
  (linhas 20-27), `ExtensionChunk` (linhas 14-17): contrato que a Taqciti passa a chamar. Não
  precisa mudar para esta fase — só ser respeitado pelo novo chamador.
- `backend/app/config.py` — `AppConfig`, padrão de campo opcional via env var (`recall_api_key`,
  `EXTENSION_SHARED_KEY`) — referência de padrão, não precisa mudar nesta fase.

### Código a trazer/alterar — Taqciti (a importar via subtree, D-01)
- `taqciti/src/shared/config/serverConfig.ts` — padrão de config a espelhar em `agenteConfig.ts`
  (env var de build via `import.meta.env`, com fallback de dev).
- `taqciti/src/features/transcription/aggregator.ts` — `applyCaptionChunk()`, onde os segmentos
  (`LiveSegment`) são mesclados; é daqui que o streamer lê o texto novo por segmento.
- `taqciti/src/background/sessionController.ts` — `dispatch()`, `scheduleFlush()`,
  `isCoalescable()`: mecanismo de agrupamento (debounce) de eventos `CAPTION_CHUNK` a reaproveitar
  (D-06); `STATE_FLUSH_INTERVAL_MS` em `shared/config/constants.ts`.
- `taqciti/src/document/generateDocument.ts` — `POST /api/generate` (linha ~163): fluxo em lote que
  não pode regredir (SC2 do roadmap).

No external specs beyond ROADMAP/REQUIREMENTS/STATE — requisitos totalmente capturados nas decisões
acima.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `serverConfig.ts` (Taqciti): padrão pronto de config via `import.meta.env.VITE_*` com fallback de
  dev — copiar exatamente essa estrutura para `agenteConfig.ts`.
- Popup/painel de configuração da extensão antiga do Agente (`extension/popup.html`,
  `extension/popup.js`, ver Fase 6 CONTEXT.md): padrão de campo (input + botão salvar +
  `chrome.storage.local`) para replicar na tela de config da Taqciti (URL, toggle, session_id,
  chave).
- `sessionController.ts::scheduleFlush()`/`isCoalescable()`: mecanismo de debounce já testado em
  produção para eventos de legenda — o streamer se conecta aqui em vez de duplicar lógica.

### Established Patterns
- Toda integração com o Agente do lado do backend já segue o padrão "fire-and-forget,
  non-blocking" (`asyncio.create_task`, erros logados e não bloqueiam o pipeline) — o streamer do
  lado da Taqciti deve seguir o mesmo espírito: falha de rede nunca pode atrasar ou travar a
  captura do Meet.
- Autenticação opcional por header (`x-agente-key`) já estabelecida na Fase 6 — este é o segundo
  consumidor desse mesmo mecanismo (D-10), não um novo.

### Integration Points
- `sessionController.ts::dispatch()` → ponto de entrada de todo evento `CAPTION_CHUNK`; é aqui (ou
  em um novo side effect chamado a partir daqui) que o streamer se pluga.
- `POST /webhook/extension` (backend) → destino de todo envio; contrato `ExtensionChunk` já existe
  e não muda.

</code_context>

<specifics>
## Specific Ideas

- Repositório de origem da Taqciti confirmado: `https://github.com/gabrielmezzalira/taqciti.git`
  (mesmo colaborador que já aparece no histórico deste repositório — `gabrielmezzalira` — via PR da
  Fase 6).
- A pasta de destino da importação subtree é `taqciti/` na raiz deste repositório.

</specifics>

<deferred>
## Deferred Ideas

- **Enviar as mudanças de volta para o repositório `taqciti` original** (`git subtree push`) —
  adiado para quando o time decidir; fora desta fase.
- **Remover o `server/` (DocCITi, gerador de documentos Next.js)** trazido junto pelo subtree —
  decisão futura separada; por enquanto fica como peso morto, sem uso nesta fase.
- **Deduplicar no backend (`/webhook/extension`) em vez de na Taqciti** — considerado e descartado
  (D-07): mexeria em mais um sistema para esta fase; a Taqciti já resolve isso mandando só o delta.

### Reviewed Todos (not folded)
None — discussão não cruzou com nenhum todo pendente (`todo.match-phase` retornou 0 resultados).

</deferred>

---

*Phase: 7-Taqciti Config + Background Streamer*
*Context gathered: 2026-09-25*
