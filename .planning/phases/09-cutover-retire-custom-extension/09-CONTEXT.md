# Phase 9: Cutover + Retire Custom Extension - Context

**Gathered:** 2026-10-26
**Status:** Ready for planning

<domain>
## Phase Boundary

A Taqciti passa a ser a **única** fonte de transcrição em produção. A extensão customizada antiga
(`extension/` + `agente-diagnostico-extension-v1.0.0.zip`) sai do repositório, a página "Instalar
extensão" do web app passa a apontar para a Taqciti, e o **contrato do backend** que a extensão antiga
usava (`POST /webhook/extension`, `ExtensionChunk`, `source=extension`) fica intacto — inclusive porque
a própria Taqciti usa essa mesma rota desde a Fase 7.

Requisito: **TAQ-04**. Critérios de sucesso (ROADMAP): SC1 sessão discovery ponta a ponta só com a
Taqciti; SC2 `extension/` e o zip removidos; SC3 rota/modelo/enum preservados.

Fora do escopo: painel AGP na Taqciti (Fase 10), triagem dos WR da Fase 8, renomear "extension" no backend.

</domain>

<decisions>
## Implementation Decisions

### Já decidido antes desta discussão (não reabrir)
- **D-00a:** O rótulo `extension` no backend fica como está — nome da rota `/webhook/extension`,
  `ExtensionChunk`, valor `extension` do enum `source`, e as rotas da Fase 8
  (`/webhook/extension/clients`, `/sessions`, `/sessions/{id}/finish`). Sessões da Taqciti gravam
  `source=extension`. "extension" no backend passa a significar "a extensão que manda transcrição".

### Validação da Taqciti (gate do cutover)
- **D-01:** Taqciti conta como validada = **UAT da Fase 8 (135/135) + 1 reunião real de ponta a ponta**
  só com a Taqciti, até o relatório final. Sem período de espera de N reuniões/dias.
- **D-02:** A prova SC1 acontece **ANTES** de qualquer remoção. A remoção de `extension/`/zip fica
  bloqueada até a prova passar (registrar evidência em `09-UAT.md`).
- **D-03:** A prova precisa comprovar no banco, todos os quatro:
  1. transcrição chegando pela Taqciti com a sessão em `source=extension`;
  2. `coverage_snapshots` gerados + perguntas das lentes produto **e** dados na fila;
  3. relatório de discovery gerado e salvo em `reports` (com a seção de precificação);
  4. sair da sala encerra a sessão (DA-4) → sessão `finished`.
- **D-04:** A prova roda em **produção** (Railway + Vercel) com cliente/projeto `ZZ-TESTE…`, apagado
  no fim (sessões primeiro, depois o projeto). Nunca apagar o cliente real `visus`.
  — **Re-decisão do usuário (2026-10-27): prova LOCAL.** A reunião real no Meet continua igual, mas o
  backend e o web app rodam no computador de quem conduz a prova, e a Taqciti é a build local
  (`taqciti/dist`) apontando para `http://localhost:8000`. O banco é o Supabase que o backend local usa
  (informado pelo usuário no checkpoint do 09-02); o cliente `ZZ-TESTE…` e a limpeza por id continuam
  valendo. Motivo: terminar a fase sem esperar o deploy. O que só produção prova (deploy, release com a
  URL de produção) vira a seção `## Depois do deploy` do `09-UAT.md`, fora da fase.

### Instalação da Taqciti / página do web app
- **D-05:** Distribuição = **instaladores da release** (`taqciti/installer/{windows,macos,linux}`,
  runbook `taqciti/docs/publicar-release.md`), publicados pelo **repositório original da Taqciti**
  (onde o `release.yml` roda — o `taqciti/.github/workflows/release.yml` do subtree NÃO roda neste repo).
  A página linka a release de lá.
- **D-06:** `ExtensionPage` é **reescrita para a Taqciti**: mesma rota `/extension` e mesmo item de
  menu; texto, passos e link novos; nenhuma menção à extensão antiga exceto o aviso de D-11.
  O `EXTENSION_URL` de `frontend/src/lib/labels.ts` (hoje aponta para a release v1.0.0 do zip antigo)
  é substituído. — **Reversibility:** reversible — `git revert` do commit.
- **D-07:** A URL do backend de produção do Agente **vem no build** da release (`VITE_AGENTE_*`). A
  página só ensina a instalar e a vincular a reunião a um cliente (fluxo da Fase 8); não ensina a
  configurar URL.
- **D-08:** **Sem chave por enquanto:** `EXTENSION_SHARED_KEY` continua **sem valor** no Railway até o
  login do AGM, então ninguém precisa colar `agenteApiKey`. Consciente de que isso mantém o WR-01 da
  Fase 8 aberto (rotas da extensão abertas sem chave; risco T-08-10 aceito até o login do AGM). A
  chave NUNCA vai embutida no bundle (D-10 da Fase 7). A página não menciona chave.

### Remoção da extensão antiga
- **D-09:** **Remover de vez** `extension/` e `agente-diagnostico-extension-v1.0.0.zip` via `git rm`,
  em commits atômicos, depois da prova SC1. Recuperável por `git revert` (continua no histórico).
  — **Reversibility:** reversible — está no histórico do git; não há cópia fora do repo a perder.
- **D-10:** **Limpar referências mortas** fora de `extension/`: links/rótulos de UI que apontam para a
  extensão antiga e comentários que citam caminhos apagados (ex.: "mesmo padrão de
  `extension/background.js::normalizeUrl`" em `taqciti/src/shared/config/agenteConfig.ts`).
  **NÃO** tocar no contrato do backend (rota, `ExtensionChunk`, enum) nem nos testes que o protegem.
  Refator de comentário ≠ mudança de comportamento: commits separados.
- **D-12:** Documentação que cita `extension/` (`CLAUDE.md` seção 10, `diagnostico/README.md`,
  `PLANO_AJUSTES.md`, `.planning/PROJECT.md`, `.planning/ROADMAP.md`) entra na fase, num **commit só de
  docs**. Corrigir também o ROADMAP que ainda diz que a Taqciti "vive em repo separado".

### Ordem e janela do cutover
- **D-13:** **Deploy primeiro, depois a prova:** o backend com o código das Fases 7–8 + `GEMINI_API_KEY`
  sobe no Railway antes da reunião SC1 (a `EXTENSION_SHARED_KEY` fica vazia, D-08). O deploy em si é
  ação do usuário/time (fora do repo) — o plano deve ter um checkpoint humano para isso.
  — **Re-decisão do usuário (2026-10-27): prova primeiro, deploy depois.** O checkpoint do 09-02 passa a
  ser "ambiente local pronto" (backend + web app locais, build local da Taqciti). Deploy no Railway/Vercel,
  `GEMINI_API_KEY` no Railway e a release da Taqciti com a URL de produção (D-07) saem da fase e ficam
  registrados em `## Depois do deploy` do `09-UAT.md`, com um teste rápido em produção.
- **D-11:** A `ExtensionPage` nova traz um aviso: "se você tem a extensão antiga instalada, remova
  antes de instalar a Taqciti". Comunicação ao time no canal fica fora do código.
- **D-14:** Instalações antigas que continuarem em uso **seguem funcionando**: o backend não bloqueia
  chunks da extensão antiga (consequência direta do SC3). Remover = tirar do repo, não quebrar quem tem.

### Ordem sugerida de commits (do HANDOFF §3.2, ajustada pelas decisões)
1. Checkpoint humano: ambiente local pronto (D-13, re-decisão de 2026-10-27; o deploy fica para depois da fase).
2. Prova SC1 local → `09-UAT.md` (D-01..D-04) — só verificação.
3. Reescrever `ExtensionPage` + `EXTENSION_URL` (D-05..D-07, D-11).
4. `git rm extension/` + zip (D-09).
5. Limpeza de referências mortas em código/comentários (D-10).
6. Docs (D-12).
7. Teste de regressão do contrato (semente real): estender `backend/tests/test_extension_clients.py`
   / testes de webhook garantindo `/webhook/extension` + `ExtensionChunk` + `source=extension` (SC3).

### Claude's Discretion
- Texto exato e layout da `ExtensionPage` reescrita (seguir o kit de UI/tema existente).
- Quais testes existentes estender para o SC3 (preferir estender a criar do zero, regra do CLAUDE.md).
- Granularidade dos commits de limpeza (D-10), desde que cada um seja reversível sozinho.

</decisions>

<open_decisions>
## DECISÃO EM ABERTO / informação que falta (o planner deve PARAR aqui e pedir ao time)

- **URL do repositório original da Taqciti e da release** que a `ExtensionPage` vai linkar (D-05).
  Não está em nenhum arquivo deste repo. Perguntar ao usuário; não inventar.
- **Se já existe uma release da Taqciti buildada com a URL de produção do Agente** (`VITE_AGENTE_*`)
  — se não existir, cortar essa release é ação no repo da Taqciti (fora deste repo), checkpoint humano.
- **Quem faz o deploy no Railway e quando** (D-13) — ação do time, checkpoint humano.

</open_decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Escopo e plano de alto nível
- `.planning/ROADMAP.md` — Phase 9 (goal, SC1–SC3, TAQ-04)
- `.planning/REQUIREMENTS.md` — TAQ-04
- `.planning/HANDOFF-FASE-09-10.md` §3 — mapa do que existe, plano de alto nível com riscos/rollback,
  decisões 9-A..9-E (todas resolvidas neste CONTEXT)
- `CLAUDE.md` — plano de task com 7 seções obrigatórias, commits atômicos, branch por fase, nunca ler `.env`
  (inclui `taqciti/server/.env.local`, que tem chave real)

### Contrato do backend que fica (SC3)
- `backend/app/routers/webhook.py` — `POST /webhook/extension` (usado pela Taqciti; gate `x-agente-key` opt-in)
- `backend/app/routers/extension_clients.py` — rotas da Fase 8 (ficam)
- `backend/tests/test_extension_clients.py`, `backend/tests/test_webhook_auth.py`,
  `backend/tests/test_webhook_idempotency.py`, `backend/tests/test_extension_chunk_extra_fields.py` — base para o teste de regressão

### Distribuição da Taqciti
- `taqciti/docs/publicar-release.md` — runbook de release; variáveis de build compiladas no bundle
- `taqciti/installer/` — instaladores windows/macos/linux + `guide/index.html`
- `taqciti/src/shared/config/agenteConfig.ts` — URL do Agente por build, chave só em runtime (D-10 Fase 7)

### Fase 8 (vínculo e encerramento usados na prova)
- `.planning/phases/08-taqciti-session-association/08-UAT.md` — roteiro do Meet real (testes 133–135)
- `.planning/phases/08-taqciti-session-association/08-DECISOES-PENDENTES.md` — DA-4/DA-5
- `.planning/phases/08-taqciti-session-association/08-REVIEW.md` — WR-01 (rotas abertas sem chave)

</canonical_refs>

<code_context>
## Existing Code Insights

### O que sai
- `extension/` (`background.js`, `content_app.js`, `content_meet.js`, `popup.*`, `manifest.json`, `lib/`, `tests/`, `package.json`)
- `agente-diagnostico-extension-v1.0.0.zip` (raiz)

### O que muda no frontend
- `frontend/src/pages/ExtensionPage.tsx` — hoje: passos de "baixe o .zip" + botão "Baixar extensão v1.0.0"
- `frontend/src/lib/labels.ts:18` — `EXTENSION_URL` aponta para a release v1.0.0 do zip antigo
- `frontend/src/App.tsx:23` — rota `/extension` (mantida); também mencionam extensão: `navItems.ts`,
  `HomePage.tsx`, `lib/api.ts`, `ProjectFormPage.tsx`, `SessionActivePage.tsx`, `SessionSetupPage.tsx`
  (conferir caso a caso: rótulo de UI morto sai; referência ao `source=extension` fica)

### Integration Points
- A Taqciti já envia para `/webhook/extension` (Fase 7) e vincula sessão (Fase 8) — nenhum código novo de integração é esperado.
- Grep de referências deve excluir `.claude/worktrees/rf-07-*` (lixo da Fase 7) e `taqciti/server/.next`.

</code_context>

<specifics>
## Specific Ideas

- Aviso na página: "se você tem a extensão antiga instalada, remova antes de instalar a Taqciti".
- Dados de teste: usar prefixo `ZZ-TESTE`; limpar as sessões `ce75b9af-…` e `6cd362ad-…` que sobraram da Fase 8 junto da limpeza pós-prova.

</specifics>

<deferred>
## Deferred Ideas

- Renomear "extension" no backend (rota/enum/labels) com migração — futuro, fora do SC3.
- Bloquear a extensão antiga no backend — rejeitado (D-14).
- Configurar `EXTENSION_SHARED_KEY` e ensinar a colar a chave — adiado até o login do AGM (D-08).
- Workflow de release da Taqciti neste repo — rejeitado em favor do repo original (D-05).

</deferred>

---

*Phase: 09-cutover-retire-custom-extension*
