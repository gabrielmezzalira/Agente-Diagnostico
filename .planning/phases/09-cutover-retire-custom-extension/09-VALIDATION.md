---
phase: "09"
slug: "cutover-retire-custom-extension"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-26"
---

# Phase 09 — Validation Strategy

> Contrato de validação da fase, para amostrar feedback durante a execução.
> Fonte: `09-RESEARCH.md` § "Arquitetura de validação". Comandos e números de base foram rodados pelo pesquisador em 2026-10-26.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Backend: pytest 9.1.1 (`asyncio_mode=auto`) · Frontend: vitest 4.1.7 (ambiente `node`, só `src/**/*.test.ts`) · Taqciti: vitest (só se a fase tocar `taqciti/`) |
| **Config file** | `backend/pytest.ini` · `frontend/vite.config.ts` · `taqciti/vitest.config.ts` |
| **Quick run command** | Backend: `cd backend && python -m pytest -q tests/test_extension_clients.py tests/test_webhook_auth.py tests/test_webhook_idempotency.py tests/test_extension_chunk_extra_fields.py` (61 passam hoje) · Frontend: `npm --prefix frontend test` (3 arquivos / 17 testes hoje) |
| **Full suite command** | `cd backend && python -m pytest -q` (275 passam, 4 skip, 1 falha preexistente: `test_schema.py::test_tables_exist`, teste ao vivo no Supabase) · `npm --prefix frontend test && npm --prefix frontend run lint && npm --prefix frontend run build` · `cd taqciti && npx vitest run` (89 arquivos / 1393 testes, ~84 s) |
| **Estimated runtime** | ~30 s (rápido do backend) · ~10 s (frontend test) · ~84 s (Taqciti completa) |

---

## Sampling Rate

- **Depois de cada commit de task:** o comando rápido da área tocada (backend ou frontend; Taqciti só se a task mexer em `taqciti/`).
- **Depois de cada onda:** backend completo + frontend `test` + `lint` + `build`.
- **Antes do `/gsd-verify-work`:** tudo verde (a falha preexistente `test_schema.py::test_tables_exist` fica documentada, não conta como regressão) e `09-UAT.md` aprovado.
- **Latência máxima de feedback:** 90 segundos.

---

## Per-Task Verification Map

> Os IDs de task são definidos pelo planner. Esta tabela mapeia cada critério para o tipo de prova; o planner/checker ligam cada linha à task correspondente.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01 T2 (tracer); reexecutado em 09-05 T2 | 09-01 | 1 | TAQ-04 / SC3 | — | `ExtensionChunk` continua validando entrada; rota `/webhook/extension` continua registrada e respondendo 202 | unit / contrato | `cd backend && python -m pytest -q tests/test_extension_chunk_extra_fields.py -k sc3` (semente) e `cd backend && python -m pytest -q tests/test_extension_clients.py tests/test_webhook_auth.py tests/test_webhook_idempotency.py tests/test_extension_chunk_extra_fields.py` | ❌ W0 (criado no 09-01 T2) | ⬜ pending |
| 09-01 T2 (subconjunto do contrato) | 09-01 | 1 | TAQ-04 / D-14 | — | chunk sem `chunk_id` (extensão antiga) continua aceito | unit | já coberto por `test_webhook_idempotency.py::test_webhook_without_chunk_id_keeps_current_behavior` (roda no subconjunto do 09-01 T2) | ✅ | ⬜ pending |
| 09-04 T2 (tracer); conferência visual no 09-04 T3 | 09-04 | 4 | TAQ-04 / D-06, D-07, D-08, D-11 | link de download | link novo é `https` e aponta para o host/repo confirmado pelo time; nenhum vestígio do zip antigo; sem chave nem URL de backend na página; aviso de remover a extensão antiga presente | unit (dados puros) | `npm --prefix frontend test` | ❌ W0 (`frontend/src/lib/taqcitiInstall.test.ts`, criado no 09-04 T2) | ⬜ pending |
| 09-05 T1 (zip) + 09-05 T2 (`extension/`) | 09-05 | 5 | TAQ-04 / SC2 | — | N/A | shell | `test ! -e extension && test ! -e agente-diagnostico-extension-v1.0.0.zip && git ls-files extension '*.zip' \| wc -l` (esperado: 0) | ✅ comando | ⬜ pending |
| 09-06 T2 (docs; frontend já limpo no 09-04 T2) | 09-06 | 6 | TAQ-04 / SC2 (sem resíduo) | — | N/A | shell | `grep -rIn "extension/\|agente-diagnostico-extension" --exclude-dir=node_modules --exclude-dir=worktrees --exclude-dir=.next --exclude-dir=dist --exclude-dir=.git --exclude-dir=phases --exclude-dir=debug .` (só podem sobrar `09-*`, `HANDOFF-FASE-09-10.md` e rotas `/webhook/extension/*`) | ✅ comando | ⬜ pending |
| 09-06 T1 | 09-06 | 6 | TAQ-04 / D-10 | — | N/A (só comentário) | diff + suíte | `git diff` com apenas linhas de comentário; `cd taqciti && npx vitest run` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/` — testes de contrato do SC3: rota `POST /webhook/extension` registrada (via `webhook_router.routes` e `app.openapi()`, não `app.routes`), `TranscriptSource` contém `extension`, `SessionResponse` lê `source="extension"` (sessão histórica). Preferir estender arquivo existente (`test_extension_clients.py` ou vizinho).
- [ ] `frontend/src/lib/taqcitiInstall.ts` + `frontend/src/lib/taqcitiInstall.test.ts` — dados puros da página nova (o vitest do frontend não tem DOM, então a página `.tsx` não é coletada).
- [ ] `.planning/phases/09-cutover-retire-custom-extension/09-UAT.md` — roteiro da prova SC1 + espaço para a evidência (SQL read-only).
- Nenhuma instalação de framework é necessária.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sessão de discovery completa só com a Taqciti (transcrição, cobertura, perguntas das lentes produto e dados, relatório, sair da sala encerra) | TAQ-04 / SC1 (D-01..D-04) | Reunião real em produção: depende de pessoa, Google Meet, deploy no Railway e release da Taqciti | 09-03 T1-T3 (roteiro escrito no 09-02 T1; limpeza no 09-07). Roteiro e SQL read-only em `09-RESEARCH.md` § "Prova SC1 no banco"; o relatório de discovery sai do botão **"Gerar PRD"** da página do projeto, clicado **com a sessão ainda ativa** quando a prontidão chega a 65% (o botão "Relatório" da tela ao vivo fica oculto em discovery; o encerramento não gera relatório) — conferir a linha em `reports` **antes** de sair da sala; se a prontidão não chegar a 65%, a rodada é `reuniao-falhou` (decisão A do usuário, 2026-10-27); cliente/projeto `ZZ-TESTE…`; registrar evidência em `09-UAT.md`; limpar por id no fim (nunca apagar `visus`) |
| Página `/extension` reescrita renderiza e o link abre a release certa | TAQ-04 / D-06 | Vitest do frontend roda sem DOM | 09-04 T3. `npm --prefix frontend run dev`, abrir `http://127.0.0.1:5173/extension`, conferir texto, aviso de D-11 e clicar no link |
| Release da Taqciti aponta para o backend de produção com streaming ligado | TAQ-04 / D-07 | Ação no repositório original da Taqciti, fora deste repo | 09-02 T3 (checkpoint humano). Pré-condição: o repo de origem tem o código das Fases 7-8 (blobs iguais à `main`; sincronização = DECISÃO EM ABERTO do time — decisão B, 2026-10-27). Prova positiva + perfil limpo (re-decisão de 2026-10-26): o host de produção do Agente aparece nos `assets/*.js` da pasta real da instalação nova (resolvida pela Área de Trabalho do Windows), o trecho de argumento vazio `("")\|\|"http://localhost:8000"` não aparece (`grep` status 1; status 2 = pasta ausente, inválido), e a tela do Agente num perfil limpo do Chrome mostra a URL de produção e o streaming ligado. O literal de fallback `localhost:8000` sozinho continua no bundle por desenho e é ignorado |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
