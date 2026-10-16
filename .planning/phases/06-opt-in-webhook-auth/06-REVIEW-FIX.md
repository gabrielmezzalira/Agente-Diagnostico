---
phase: 06-opt-in-webhook-auth
fixed_at: 2026-09-25T14:05:00Z
review_path: .planning/phases/06-opt-in-webhook-auth/06-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 6: Code Review Fix Report

**Fixed at:** 2026-09-25T14:05:00Z
**Source review:** .planning/phases/06-opt-in-webhook-auth/06-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6
- Fixed: 6
- Skipped: 0

**Onde as verificações rodaram:** isolado, em worktree git dedicado
(`.claude/worktrees/rf-06-1985-1790343696`, branch temporária
`gsd-reviewfix/06-1985`), depois fast-forward para
`feat/fase-06-opt-in-webhook-auth`. Todas as 24 suítes `node --test` (incluindo
os 2 novos cenários do IN-02) e o `npm test` do IN-04 rodaram nesse worktree e
passaram; os números são reproduzíveis a partir do estado atual da branch
(nada ficou preso só no worktree, que já foi removido).

## Fixed Issues

### WR-01: "Salvo!" em save não confirmado — e agora o campo trava no valor não gravado

**Files modified:** `extension/popup.js`
**Commit:** `76ab555`
**Applied fix:** os handlers de clique de `saveUrlBtn` e `saveKeyBtn` agora calculam
`confirmed = isConfigSaveConfirmed(response, chrome.runtime.lastError)` e usam esse
booleano tanto para o texto do botão (`'Salvo!'` vs `'Erro — tente de novo'`) quanto
para decidir a releitura pós-save (`resyncConfigInputAfterSave`), em vez de mostrar
"Salvo!" incondicionalmente. Aplicado exatamente conforme a sugestão do review.

### WR-02: Apagar a URL e clicar em Salvar é ignorado em silêncio, e o campo fica vazio enquanto a URL antiga continua em uso

**Files modified:** `extension/popup.js`, `extension/tests/popupBackendUrlField.test.js`
**Commit:** `2107c11`
**Applied fix:** decisão de produto já tomada — no early return de URL vazia,
`configInputEdits.backendUrl` é resetado para `createConfigFieldState()` (edição
zerada, campo liberado para o polling de novo) e um `GET_STATE` é disparado
imediatamente para repovoar o campo com a URL efetiva em uso (`freshState.backendUrl`),
em vez de deixar o campo vazio. Não foi implementada a alternativa de "URL
obrigatória" (mensagem de erro), por instrução explícita. O teste
`'URL vazia continua sem ser salva...'` foi reescrito para refletir o novo
comportamento: o campo é restaurado com a URL efetiva (`https://agente.example.app`,
não vazio) logo após o clique, e um tick de polling subsequente confirma que o campo
voltou a ser atualizável normalmente.

### IN-01: `render(state)` não protege `state` indefinido, ao contrário de `resyncConfigInputAfterSave`

**Files modified:** `extension/popup.js`
**Commit:** `e322459`
**Applied fix:** adicionado guard `if (chrome.runtime.lastError || !state) return` no
início de `render(state)`, igualando o comportamento já existente em
`resyncConfigInputAfterSave` (que já checava `freshState &&`). Aplicado exatamente
conforme a sugestão do review.

### IN-02: Nenhum teste de integração cobre o ramo "save não confirmado"

**Files modified:** `extension/tests/extensionHarness.js`, `extension/tests/popupExtensionKeyField.test.js`, `extension/tests/popupBackendUrlField.test.js`
**Commit:** `e31cbc3`
**Applied fix:** adicionada `failNext(type, { lastError, response })` ao harness — a
próxima resposta pendente daquele tipo de mensagem é entregue ao callback do popup
com `chrome.runtime.lastError` definido (e restaurado ao valor anterior logo depois),
simulando porta fechada / service worker reiniciando. Adicionado um cenário de
integração por campo (`extension/tests/popupExtensionKeyField.test.js` e
`extension/tests/popupBackendUrlField.test.js`) exercitando o ramo
`isConfigSaveConfirmed === false` ponta a ponta: confirma o texto "Erro — tente de
novo" no botão e que o campo não é resincronizado (mantém o valor digitado).

Nota de ajuste: a asserção inicial do review sobre o storage permanecer com o valor
antigo não se sustenta neste harness — `background.js` grava no `chrome.storage.local`
e chama `sendResponse({ ok: true })` antes de o `failNext` interceptar a entrega ao
popup (o override simula falha na confirmação recebida pelo cliente, não uma falha
real de gravação no background). A asserção sobre `stored.*` foi removida dos dois
cenários novos para não afirmar algo que o próprio harness não modela; as asserções
de comportamento visível do popup (texto do botão e valor do campo) permanecem, que
são o que o WR-01/IN-02 realmente cobrem.

### IN-03: Asserções incompletas em dois cenários

**Files modified:** `extension/tests/popupExtensionKeyField.test.js`
**Commit:** `44bf74b`
**Applied fix:** no cenário (iii), adicionadas as asserções de
`ext.el('extension-key').value === 'chave-nova'` e
`ext.el('save-key-btn').textContent === 'Salvo!'` (paridade com o cenário (ii)). No
cenário "redigitar durante o save", adicionada a asserção
`ext.stored.extensionKey === 'abc'` (o valor lido no clique), que pegaria uma
regressão em que o save lesse o campo tarde demais.

### IN-04: Suítes da extensão não estão ligadas a nenhum runner/CI

**Files modified:** `extension/package.json` (novo)
**Commit:** `7fc9012`
**Applied fix:** adicionado `extension/package.json` mínimo, zero dependências, com
`"scripts": { "test": "node --test \"tests/*.test.js\"" }`. Verificado rodando
`npm test` dentro de `extension/` — as 24 suítes passam. Por decisão de produto,
**não** foi adicionado workflow de CI (`.github/workflows`) — isso continua fora de
escopo desta correção, para decisão à parte do time.

## Skipped Issues

Nenhum — todos os 6 findings em escopo foram corrigidos.

---

_Fixed: 2026-09-25T14:05:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
