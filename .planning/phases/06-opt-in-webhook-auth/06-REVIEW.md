---
phase: 06-opt-in-webhook-auth
reviewed: 2026-09-24T14:22:32Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - backend/app/routers/webhook.py
  - backend/tests/test_webhook_auth.py
  - extension/background.js
  - extension/popup.html
  - extension/popup.js
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-09-24T14:22:32Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Revisei o gate opt-in por shared-secret (`verify_extension_key`, header `x-agente-key` vs
`EXTENSION_SHARED_KEY`, `secrets.compare_digest`) e o campo correspondente na extensão Chrome
(`popup.html`/`popup.js`/`background.js`, persistido via `chrome.storage.local`).

O núcleo de segurança está correto: a comparação é feita com `secrets.compare_digest` (resistente a
timing attack), o valor esperado é lido do ambiente a cada chamada (nunca em nível de módulo, então
não fica "congelado" no import), a rota `/webhook/recall` de fato não recebe a dependência (escopo
correto, conforme intencional), e o texto do erro 401 não vaza o valor esperado. Os testes em
`test_webhook_auth.py` cobrem os três cenários relevantes (SC1/SC2/SC3) e seguem o padrão já
estabelecido no projeto (`test_readiness_route.py`) de testar a dependência isoladamente.

Não encontrei nenhum bloqueador. Encontrei, porém, um bug real de UX no popup da extensão (o campo
da chave é sobrescrito a cada 3s por um polling que não respeita foco — pode apagar o que o usuário
está digitando antes de salvar) e uma lacuna de reforço de transporte (o segredo pode trafegar em
texto puro se o usuário configurar a URL do backend com `http://` em vez de `https://`). Os demais
itens são observações informativas, a maioria pré-existente e não introduzida por esta fase.

## Warnings

### WR-01: Campo da chave é sobrescrito enquanto o usuário digita (perda de input)

**File:** `extension/popup.js:75-77` e `extension/popup.js:97-100`

**Issue:** `render()` é chamado a cada 3 segundos por um `setInterval` (linha 98) enquanto o popup
está aberto, e a cada chamada ele reatribui incondicionalmente
`extensionKeyInput.value = state.extensionKey || ''` (linha 77) — sem checar se o campo está com foco
ou se o usuário está no meio da digitação. Como o valor de `state.extensionKey` só muda depois que o
usuário clica em "Salvar" (`saveKeyBtn` dispara `SET_EXTENSION_KEY`), qualquer chave digitada que
leve mais de 3 segundos para ser inserida (comum para um segredo colado ou digitado manualmente) corre
o risco de ser apagada no meio da digitação pelo próximo tick do polling, que reescreve o campo com o
valor antigo (vazio ou a chave anterior) vindo do `background.js`.

Esse mesmo padrão já existia para `backendUrlInput` antes desta fase, mas a linha nova
(`extensionKeyInput.value = ...`) estende o mesmo defeito ao campo recém-criado — e aqui o dado
sensível é justamente o segredo de autenticação, tornando a frustração de "perdi o que digitei"
mais provável de acontecer com um valor difícil de redigitar corretamente (chave gerada, não uma URL
memorável).

**Fix:** Não sobrescrever o campo se ele estiver com foco (o padrão comum é comparar
`document.activeElement`):
```javascript
function render(state) {
  backendUrlInput.value = state.backendUrl || ''
  if (document.activeElement !== extensionKeyInput) {
    extensionKeyInput.value = state.extensionKey || ''
  }
  ...
}
```
(O mesmo tratamento vale para `backendUrlInput`, mas isso é pré-existente e fora do escopo desta
fase — mencionado aqui só para contexto.)

---

### WR-02: Segredo pode trafegar em texto puro se a URL do backend não usar TLS

**File:** `extension/background.js:13-19` (`normalizeUrl`) e `extension/background.js:112-132`
(`TRANSCRIPT_CHUNK` handler, header setado na linha 119)

**Issue:** `normalizeUrl()` só força `https://` quando a URL não tem protocolo algum
(`if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url`). Se o usuário digitar explicitamente
uma URL com `http://` no campo "URL do backend" (ex. para testar contra um backend local), a extensão
aceita sem aviso e passa a enviar `x-agente-key` nesse canal sem TLS a cada chunk de transcrição
(`fetch(url, { headers, ... })`, linha 119-128). Como o propósito inteiro do header é autenticar a
extensão perante o backend, transmiti-lo em texto puro anula a proteção que a Fase 6 está introduzindo
— qualquer um na mesma rede pode capturar o segredo.

Isso é uma configuração incomum (o padrão é `https://agente-diagnostico-production.up.railway.app`),
mas nada no código impede ou avisa o usuário sobre o downgrade, o que é relevante justamente para um
segredo que a própria fase está introduzindo.

**Fix:** Avisar (ou bloquear) quando `extensionKey` está preenchida e a URL normalizada não começa com
`https://`, por exemplo emitindo um aviso visível no popup, ou recusando enviar o header em URLs
`http://` não-loopback.

## Info

### IN-01: Resposta 401 sem `WWW-Authenticate`

**File:** `backend/app/routers/webhook.py:27`

**Issue:** `raise HTTPException(status_code=401, detail=...)` não inclui o header `WWW-Authenticate`,
que a RFC 7235 recomenda em respostas 401. Não afeta o comportamento funcional da extensão (que já
sabe o que enviar), é só uma questão de aderência ao padrão HTTP para clientes genéricos.

**Fix:** Opcional — `raise HTTPException(status_code=401, detail=..., headers={"WWW-Authenticate": "Header x-agente-key"})`.

---

### IN-02: Nenhum teste automatizado do lado da extensão para o novo caminho de auth

**File:** `extension/background.js:105-132`

**Issue:** O backend ganhou `test_webhook_auth.py` cobrindo os três cenários do gate, mas a lógica
correspondente no cliente (`SET_EXTENSION_KEY` grava `state.extensionKey`; `TRANSCRIPT_CHUNK` só
adiciona o header `x-agente-key` quando `state.extensionKey` é truthy) não tem nenhuma cobertura —
não há harness de teste JS no projeto (`extension/` não tem `*.test.js`). Um erro futuro (ex.: nome do
header errado, `trim()` removido, condição invertida) quebraria a autenticação silenciosamente, sem
nenhum teste para pegar.

Isso não é uma regressão desta fase especificamente (o projeto já não tinha testes JS para a
extensão antes), mas vale registrar como lacuna de cobertura já que é justamente o código
complementar da funcionalidade de segurança testada no backend.

**Fix:** Se/quando o projeto adotar um test runner para `extension/` (ex. Vitest + mocks de
`chrome.*`), adicionar um teste unitário para o handler `TRANSCRIPT_CHUNK` confirmando que o header só
é enviado quando há chave configurada e que o nome do header é exatamente `x-agente-key`.

---

### IN-03: Router acessa o Supabase diretamente (pré-existente)

**File:** `backend/app/routers/webhook.py:40-44`, `56-99`

**Issue:** O `CLAUDE.md` deste projeto exige "sem queries SQL/Supabase em services" e "sem lógica de
negócio em routers" (routers só roteiam, chamam services). `webhook.py` chama
`db.table("transcript_chunks").insert(...).execute()` e importa `pipeline_manager` diretamente dentro
do router, tanto em `extension_webhook` quanto em `recall_webhook`. Essa violação já existia antes da
Fase 6 (não foi introduzida por este diff — a Fase 6 só adicionou a dependência de auth em cima do
código existente) e outros routers do projeto (`sessions.py`) têm o mesmo padrão, então não é uma
regressão isolada desta fase. Registro aqui apenas para visibilidade, já que o arquivo foi tocado
novamente nesta fase sem mover essa lógica para uma camada de serviço/repositório.

**Fix:** Fora do escopo desta fase — se o time decidir endereçar, mover a inserção em
`transcript_chunks` e a resolução de `session_id` para um `WebhookService`/`TranscriptRepository`
dedicado, mantendo o router só com validação de entrada + chamada ao service.

---

### IN-04: XSS pré-existente via `innerHTML` com texto de pergunta não escapado

**File:** `extension/popup.js:36-52` (função `renderQuestions`, linhas 42 e 44 especificamente)

**Issue:** `renderQuestions` monta HTML via template literal interpolando `q.block` e `q.text`
diretamente em `questionsList.innerHTML` sem escapar. Se o texto de uma pergunta gerada pelo
`QuestionPlanner` (ou qualquer dado no payload de `question_new`/`initial_state` vindo do WebSocket)
contiver caracteres HTML, isso executa como markup dentro do popup da extensão. Essa função não foi
alterada por este diff (só o restante do arquivo foi tocado para adicionar o campo de chave), então
não é uma regressão da Fase 6 — mas como o arquivo inteiro foi lido para esta revisão, registro para
visibilidade já que é uma superfície de risco real (mesmo que a fonte do texto seja hoje confiável —
o próprio backend/LLM do projeto).

**Fix:** Fora do escopo desta fase — se endereçado, trocar a interpolação direta por
`textContent`/escaping (ex. função `escapeHtml()`) para `q.block` e `q.text`.

---

_Reviewed: 2026-09-24T14:22:32Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
