# Phase 6: Opt-In Webhook Auth - Context

**Gathered:** 2026-09-24
**Status:** Ready for planning

<domain>
## Phase Boundary

`POST /webhook/extension` (backend) ganha um gate opcional por shared-secret via header
`x-agente-key`, comparado contra a env var `EXTENSION_SHARED_KEY`. Enquanto essa env var não
existir, a rota se comporta exatamente como hoje — o gate é "opt-in": ninguém é afetado até alguém
decidir configurar a chave. A extensão Chrome atual (`extension/`) ganha um campo opcional de chave
que, quando preenchido, envia o mesmo header — vazio, o comportamento dela também não muda.

Fora do escopo: `POST /webhook/recall` (não é tocado), e configurar a chave real em produção
(Railway) — essa ativação fica como decisão do time, fora desta fase.

</domain>

<decisions>
## Implementation Decisions

### Escopo do gate
- **D-01:** O gate cobre apenas `POST /webhook/extension`. `POST /webhook/recall` fica de fora —
  o Recall.ai já opera como bot cloud autenticado pela própria API key da Recall, um modelo de
  ameaça diferente do da extensão exposta publicamente.

### Extensão Chrome
- **D-02:** A extensão Chrome atual (`extension/background.js`, `extension/popup.html`,
  `extension/popup.js`) é atualizada nesta fase para suportar uma chave opcional: um novo campo no
  popup (mesmo padrão do campo "URL do backend" já existente — input + botão salvar +
  `chrome.storage.local`), que, se preenchido, é enviado como header `x-agente-key` em toda
  chamada a `/webhook/extension`. Campo vazio = nenhum header enviado = comportamento idêntico ao
  atual.
  — **Reversibility:** reversible — é só código da extensão; sem migração, sem contrato publicado.

### Ativação em produção
- **D-03:** Esta fase entrega só a capacidade (código pronto, testado, comportamento inalterado
  enquanto `EXTENSION_SHARED_KEY` não existir no ambiente). Configurar a chave real em produção
  (Railway) e distribuir o valor para quem usa a extensão **NÃO** faz parte desta fase — fica como
  **DECISÃO EM ABERTO do time**, a ser feita depois, coordenada com quem já usa a extensão hoje (se
  ativada sem coordenação, quebra o tráfego real de quem ainda não atualizou a extensão).
  — **Reversibility:** one-way (só a ativação, não o código) — depois que a chave for setada em
  produção, qualquer requisição sem o header correto passa a ser rejeitada de verdade; reverter
  exige remover a env var no Railway.

### Claude's Discretion
- Formato do erro de rejeição (código HTTP, corpo da resposta) quando a chave está ausente ou
  errada — não foi pauta de discussão; usar um 401/403 com mensagem clara é aceitável.
- Onde/como comparar a chave (ex: comparação de tempo constante) — decisão técnica de segurança,
  não de produto.
- Nome exato do campo na UI da extensão ("Chave de autenticação (opcional)" ou similar).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap e requisitos
- `.planning/ROADMAP.md` §"Phase 6: Opt-In Webhook Auth" — goal, success criteria (3), TAQ-03.
- `.planning/REQUIREMENTS.md` §"Taqciti Transcription (TAQ)" — TAQ-03: "The transcription webhook
  is protected by an opt-in shared-secret header (does not break current production when unset)."
- `.planning/PROJECT.md` §"Key Decisions" — pivot sales→discovery gated por `mode`; contexto geral
  do milestone v3.0 (esta fase não mexe em `mode`, é ortogonal).

### Código a alterar
- `backend/app/routers/webhook.py` — `extension_webhook()` (linhas 18-36) é onde o gate entra;
  `recall_webhook()` (linhas 39-84) fica intocado (D-01).
- `backend/app/config.py` — `AppConfig` (frozen dataclass) + `load_config()`: padrão a seguir para
  expor `EXTENSION_SHARED_KEY` como campo opcional (default `""`, mesmo padrão de
  `recall_api_key`).
- `extension/background.js` — linhas 90-122, handler `TRANSCRIPT_CHUNK`, monta o `fetch` para
  `/webhook/extension`; é aqui que o header condicional entra (D-02).
- `extension/popup.html` — campo "URL do backend" (linha ~237-240) é o padrão visual a replicar
  para o novo campo de chave.
- `extension/popup.js` — lê/escreve `state.backendUrl` via `chrome.storage.local`; mesmo padrão
  para a nova chave.

No external specs beyond ROADMAP/REQUIREMENTS — requisitos totalmente capturados nas decisões
acima.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `extension/popup.html` + `extension/popup.js`: padrão já existente de campo de configuração
  (input + botão "Salvar" + persistência via `chrome.storage.local`) usado para "URL do backend" —
  reutilizar exatamente esse padrão para o novo campo de chave opcional.
- `backend/app/config.py::AppConfig`: dataclass frozen com campos opcionais (`recall_api_key: str
  = ""`) — mesmo padrão para `extension_shared_key`.

### Established Patterns
- Rotas em `backend/app/routers/webhook.py` não têm autenticação hoje — este é o primeiro gate de
  auth nesse arquivo; deve seguir o padrão FastAPI de dependency injection (`Depends`) para não
  misturar a checagem com a lógica de negócio da rota, coerente com a regra do CLAUDE.md de router
  "só roteia".
- `AppConfig` é carregado uma vez no import (`load_dotenv()` no nível do módulo) — a nova env var
  segue o mesmo carregamento, sem novo mecanismo.

### Integration Points
- O gate entra como uma dependência/checagem no início de `extension_webhook()`, antes de qualquer
  escrita no banco ou push para o pipeline.
- A extensão precisa ler o novo campo de `chrome.storage.local` e incluí-lo condicionalmente nos
  headers do `fetch` em `background.js` — mesmo ponto onde `Content-Type` já é setado.

</code_context>

<specifics>
## Specific Ideas

Nenhuma referência específica além do que já está no roadmap (nome da env var `EXTENSION_SHARED_KEY`
e do header `x-agente-key` já vêm fixados pelo texto do roadmap/success criteria — não são gray
area, são requisito literal).

</specifics>

<deferred>
## Deferred Ideas

- **Proteger `/webhook/recall` com o mesmo mecanismo** — considerado e explicitamente descartado
  para esta fase (D-01); se o time quiser revisitar, é uma fase/task separada.
- **Ativar a chave em produção (Railway) + distribuir para quem usa a extensão hoje** — decisão
  operacional adiada pelo time (D-03); não é código, é uma ação de configuração + coordenação a ser
  feita quando o time decidir.

### Reviewed Todos (not folded)
None — discussão não cruzou com nenhum todo pendente.

</deferred>

---

*Phase: 6-Opt-In Webhook Auth*
*Context gathered: 2026-09-24*
