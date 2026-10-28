---
phase: 09-cutover-retire-custom-extension
reviewed: 2026-10-28T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - frontend/src/pages/ExtensionPage.tsx
  - frontend/src/lib/taqcitiInstall.ts
  - frontend/src/lib/taqcitiInstall.test.ts
  - frontend/src/components/extension/StepList.tsx
  - frontend/src/lib/labels.ts
  - backend/tests/test_extension_chunk_extra_fields.py
  - taqciti/src/features/agente/wordDelta.ts
  - taqciti/src/shared/config/agenteConfig.ts
  - backend/app/routers/webhook.py
  - backend/app/routers/extension_clients.py
  - diagnostico/README.md
  - CLAUDE.md
findings:
  critical: 0
  warning: 2
  info: 6
  total: 8
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-10-28
**Depth:** standard (com busca de consumidores órfãos entre arquivos)
**Files Reviewed:** 12 (mais a remoção de `extension/` com 12 arquivos e do zip, conferida pelo diff e por grep)
**Status:** issues_found

## Summary

Não encontrei nenhum problema grave (nenhum BLOCKER). A fase faz o que promete: a página `/extension`
passou a instalar a Taqciti, a extensão antiga e o zip foram removidos, e o contrato que a Taqciti usa
(`POST /webhook/extension`, `ExtensionChunk`, `source='extension'`) continua de pé.

O que conferi com evidência:

- **Execução focada:** `pytest backend/tests/test_extension_chunk_extra_fields.py` deu 7 passed.
  `vitest run src/lib/taqcitiInstall.test.ts` deu 7 passed. `eslint` nos 4 arquivos novos/alterados do
  frontend saiu limpo. `tsc -p tsconfig.app.json --noEmit` saiu sem erros.
- **(a) Página:** o link nulo é tratado (ramo `=== null` mostra o aviso e não renderiza `<a>`). O link,
  quando existir, tem `target="_blank"` com `rel="noopener noreferrer"`. Não há `dangerouslySetInnerHTML`
  nem interpolação de dado externo: todo texto vem de constantes. As strings da página não citam
  chave, `x-agente-key` nem localhost. Os passos de instalação batem com o `taqciti/INSTALL.md`
  (`.exe`/`.pkg`/`.run`, SmartScreen, Gatekeeper, `chmod +x`). Os termos "Selecionar cliente" e bolha "!"
  existem em `taqciti/src/sidepanel/components`. O passo "ao sair da sala a sessão é encerrada sozinha"
  é coerente com o CR-02 da Fase 8, já corrigido (08-28).
- **(c) Remoção:** não achei consumidor órfão. `git grep` por `extension/`, `extension-v1`, `EXTENSION_URL`,
  `gabrielmezzalira`, `configFieldGuard`, `content_meet`, `content_app` fora de `.planning/` só retorna
  comentários e o teste que monta o nome do zip por partes. `Dockerfile` só copia `backend/`.
  `.dockerignore`, `railway.toml` e `vercel.json` não citam a pasta nem o zip. Não existe `.github/`
  na raiz (o CI do `taqciti/` é do subtree e não toca `extension/`). A constante `EXTENSION_URL` foi
  removida de `labels.ts` e não tem mais nenhum import.
- **(d) Contrato do backend:** `webhook.py` e `extension_clients.py` estão íntegros. `ExtensionChunk` tem
  `session_id, text, speaker, chunk_id`. `TranscriptSource = Literal["extension", "recall"]` e o default
  de `ProjectCreate.source` é `"extension"`. O 404 para sessão inexistente e o 202 para repetição por
  `chunk_id` seguem como estavam.

## Warnings

### WR-01: A página `/extension` virou um beco sem saída para quem clica em "Instalar extensão"

**File:** `frontend/src/lib/taqcitiInstall.ts:10`, `frontend/src/pages/HomePage.tsx:14-17`, `frontend/src/components/layout/navItems.ts:15`
**Issue:** Com `TAQCITI_RELEASES_URL = null`, a página não tem nenhum botão de download, só o aviso "peça o
instalador ao time". Ao mesmo tempo, a Home continua com o banner "Extensão Chrome disponível" e o botão
"Instalar extensão", e o menu lateral continua "Extensão Chrome", enquanto o título da página agora é
"Taqciti". Quem segue o convite da Home chega numa página que descreve os passos de um instalador que
ele não consegue baixar. O `.zip` antigo, que funcionava, foi removido no mesmo corte. A decisão de deixar
o link nulo foi tomada em 2026-10-28 (registrada no comentário do arquivo), então isto não é um erro de
implementação. O que falta é coerência do texto ao redor: o banner promete "disponível" e o rótulo do
menu não bate com o título. Além disso, o aviso diz "após o deploy", sem dizer deploy de quê nem quando,
e não indica a quem pedir.
**Fix:** Enquanto a URL for nula, trocar o banner da Home por algo como "Taqciti: peça o instalador ao
time" (ou esconder o banner), e alinhar o rótulo do menu e o texto do botão ("Taqciti" ou
"Extensão Taqciti"). No aviso, nomear o canal/pessoa responsável pelo instalador. Se o time preferir
manter o texto atual, registrar isso como decisão consciente no `09-VERIFICATION.md`.

### WR-02: O teste de `taqcitiInstall` só valida as constantes do módulo, não o que a página realmente exibe

**File:** `frontend/src/lib/taqcitiInstall.test.ts:22-31, 60-67`; `frontend/src/pages/ExtensionPage.tsx:34-35, 42, 53, 66`
**Issue:** `allPageTexts()` junta só as constantes de `taqcitiInstall.ts`. O texto escrito direto no JSX
da página (subtítulo, "Instalação", "Baixar a Taqciti", "Vincular a reunião a um cliente", eyebrow, título)
não passa pelos filtros de "chave / x-agente-key / localhost / .zip / v1.0.0". Se alguém colocar uma
dessas palavras no JSX, os testes continuam verdes. Também não existe teste de renderização: nada
prova que, com a URL nula, a página não renderiza `<a>`, nem que, com URL, o link sai com
`target="_blank"` + `rel="noopener noreferrer"`. O teste do link (primeiro `it`) fica dormente enquanto a
URL for nula: no ramo nulo ele só confere um trecho do texto do aviso, o que é quase tautológico. A
armadilha dos `EXPECTED_HOST`/`EXPECTED_PATH_PREFIX` nulos está bem tratada (se a URL for preenchida e os
dois esperados continuarem nulos, o teste falha de propósito), o que é correto.
**Fix:** Adicionar um teste de componente (a pilha já tem `@testing-library/react`) que renderiza
`<ExtensionPage />` dentro de `MemoryRouter`, roda o mesmo filtro de palavras proibidas sobre o
`textContent` e confere: sem `a[href]` externo quando a URL é nula; com URL, `rel` contendo `noopener` e
`target="_blank"`. Isso cobre também o texto escrito no JSX.

## Info

### IN-01: Verificação do host/caminho do link ainda fraca para quando a URL for publicada

**File:** `frontend/src/lib/taqcitiInstall.test.ts:41-44`
**Issue:** `url.pathname.startsWith(EXPECTED_PATH_PREFIX)` sem barra final aceita `/org/repo-malicioso`
quando o prefixo é `/org/repo`. Além disso, quem publicar a URL vai preencher `EXPECTED_*` copiando o mesmo
valor, então a conferência é "auto-confirmada": ela pega erro de digitação, não troca de repositório
combinada nos dois lugares. Hoje não há risco, pois a URL é nula.
**Fix:** Exigir `startsWith(prefix + '/')` ou igualdade de segmentos, e manter o aviso no comentário de que os dois valores
devem vir de fonte independente (a decisão T-09-08 do time).

### IN-02: O teste "sessão histórica de extensão ainda resolve" é tautológico para `source`

**File:** `backend/tests/test_extension_chunk_extra_fields.py:150-163`
**Issue:** `SessionResponse.source` é `str` (`backend/app/models/sessions.py:42`), então qualquer valor
passa em `model_validate`. A asserção `session.source == "extension"` só devolve o que foi posto. O teste
só quebraria se alguém tornasse `source` um `Literal` sem `"extension"`, o que é um risco real mas
indireto. Os outros testes SC3 (rota com 202 + gate, schema OpenAPI, `TranscriptSource`) são
verdadeiros guardas. Observação extra: o teste do schema compara `set(properties)` com igualdade exata,
então acrescentar um campo opcional legítimo a `ExtensionChunk` quebra o teste. Parece intencional
(guarda de contrato), mas vale deixar isso no comentário.
**Fix:** Se a intenção é proteger o enum, assertar `"extension" in typing.get_args(...)` para o tipo que
realmente restringe o valor, ou apenas remover o teste redundante.

### IN-03: Hierarquia de títulos pula de h1 para h3 na página

**File:** `frontend/src/pages/ExtensionPage.tsx:59`; `frontend/src/components/ui/Typography.tsx:4-6`
**Issue:** `PageHeader` gera `<h1>`, `SectionLabel` é um `<span>` e os sistemas operacionais usam `<h3>`.
Não há `<h2>`, então leitores de tela veem h1 e depois h3.
**Fix:** Usar `<h2>` nos nomes dos sistemas (ou criar o título de seção como `<h2>`).

### IN-04: `StepList` perde a semântica de lista numerada em alguns leitores de tela

**File:** `frontend/src/components/extension/StepList.tsx:8-17`
**Issue:** O `<ol>` usa `list-none` (o Tailwind remove a semântica de lista em Safari/VoiceOver) e o número
visual está em `aria-hidden`, então a ordem dos passos não é anunciada nesses leitores. Com isso um
usuário de VoiceOver ouve os passos sem numeração. A chave `key={i}` é aceitável porque a lista é estática.
**Fix:** Acrescentar `role="list"` ao `<ol>` (restaura a semântica no Safari) ou deixar o número acessível
em vez de `aria-hidden`.

### IN-05: Link externo abre em nova aba sem avisar

**File:** `frontend/src/pages/ExtensionPage.tsx:47-54`
**Issue:** `target="_blank"` está com `rel="noopener noreferrer"` (correto, sem risco de tabnabbing), mas o
rótulo "Baixar a Taqciti" não indica a nova aba nem que é um download externo. Só importa quando a URL
for publicada.
**Fix:** Acrescentar texto visualmente oculto ("abre em nova aba") ou um ícone com `aria-label`.

### IN-06: Comentários desatualizados ou truncados que sobraram do corte

**File:** `backend/app/routers/sessions.py:206`; `taqciti/src/features/agente/wordDelta.ts:2-6`
**Issue:** (1) `sessions.py:206` ainda diz "extensão Chrome faz POST direto para localhost", o que não vale
mais para a Taqciti, que fala com o backend no Railway. (2) O novo comentário de `wordDelta.ts` cita a
extensão antiga duas vezes e a segunda frase ("a extensão antiga tinha só uma fala de cada vez")
repete a primeira; sobrou texto sem sentido no fim de cada frase. Nenhum dos dois afeta o
comportamento.
**Fix:** Atualizar o comentário de `sessions.py` para "a Taqciti envia direto para o backend; sem tunnel
necessário" e enxugar o de `wordDelta.ts` para uma só menção.

---

## Informativos (não contam como achado desta fase)

- **Risco aceito T-08-10 / D-08:** as rotas `POST /webhook/extension`, `GET|POST /webhook/extension/clients`,
  `POST /webhook/extension/sessions` e `POST /webhook/extension/sessions/{id}/finish` aceitam qualquer
  chamador quando `EXTENSION_SHARED_KEY` não está definida (`verify_extension_key` devolve sem checar).
  Registrado como informativo, conforme combinado. Nada além disso foi introduzido pela fase. Duas
  observações do mesmo risco, para o time ter em mente: `ExtensionChunk.text` não tem `max_length` (só
  `chunk_id` tem) e `allow_origins=["*"]` em `main.py:49`; ambos são anteriores à fase.
- **Lint do frontend pré-existente:** os 7 problemas já conhecidos (`usePricing.ts`,
  `usePricingFeatures.ts`, `PricingEditorPage.tsx`, `ProjectDetailPage.tsx:68`,
  `SessionActivePage.tsx:163`) não foram revisados nem contados. Os arquivos novos da fase passam no ESLint.

## O que NÃO verifiquei

- Não rodei a suíte completa do backend nem do frontend, nem o `npm run build`/`vite build`; só os dois
  testes focados e `tsc`/`eslint` nos arquivos da fase.
- Não abri nenhum `.env` nem conferi se `EXTENSION_SHARED_KEY` está definida em produção (Railway), então
  não sei se o gate está ligado de fato.
- Não testei o instalador da Taqciti nem os passos descritos na página em máquina real (Windows, macOS ou
  Linux); só comparei o texto com `taqciti/INSTALL.md`.
- Não renderizei a página no navegador (aparência, contraste do aviso âmbar, foco por teclado).
- Não conferi o conteúdo dos arquivos removidos além do diff (`git diff --name-status`): confio nele para
  afirmar que a pasta e o zip sumiram, e em `ls extension` (inexistente) como confirmação.
- Não revisei `.planning/` nem os documentos longos (`CLAUDE.md`, `PLANO_AJUSTES.md`) além das linhas
  alteradas pela fase, que estão coerentes com a remoção.
- Não verifiquei se existe CI fora do repositório (por exemplo, configuração do Vercel no painel) que
  referencie o zip ou `extension/`.

---

_Reviewed: 2026-10-28_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
