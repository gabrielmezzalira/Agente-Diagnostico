---
phase: 08-taqciti-session-association
plan: 21
subsystem: phase-gate
status: complete-awaiting-human-d20
tags: [taqciti, backend, validation, phase-gate, manual-d20, human-check]

requires:
  - phase: 08-taqciti-session-association
    provides: "Planos 08-01 a 08-27 (exceto o próprio 08-21) com SUMMARY; respostas B1, B2, B3-a, B4-b, B5, D-11, DA-1/2/3 e os padrões por falta de resposta (B3-b, B3-c)"
provides:
  - "Portão automático da fase verde: Taqciti 85 arquivos / 1294 testes, typecheck, lint e build; backend 73 passed / 4 skipped; web app build"
  - "08-VALIDATION.md com o mapa de verificação 100% verde, wave_0_complete: true, seção 'Pendências por decisão do time' e seção 'Roteiro manual D-20 (a)-(i)' sem resultado"
  - "Build da extensão em taqciti/dist pronto para a pessoa do time carregar no Chrome"
affects: [verify-work-fase-8, deploy-backend, merge-main-master]

actuals:
  tokens: 9000
  tasks: 2
  commits: 1

plan_head_before: 59a56587d1c8c1462bbb5acdef263232426cae32
plan_head_after: a820c033d00613b614cd98c031628037a79cbdb8

key-files:
  created: []
  modified:
    - .planning/phases/08-taqciti-session-association/08-VALIDATION.md

decisions:
  - "Nenhuma decisão nova: o plano só confere e registra o estado. Pendências do time (DA-4, DA-5, B3-b, B3-c, finishGaveUp, histórico cheio, remoção de código da Fase 7, T-08-10) ficam como PENDÊNCIA, nunca como aceitas"

metrics:
  completed: 2026-10-12
---

# Phase 8 Plan 21: Portão final da fase e roteiro manual D-20 Summary

**O portão automático da Fase 8 passou inteiro (Taqciti 85 arquivos / 1294 testes, typecheck, lint, build; backend 73 passed), o mapa de verificação está todo verde e o roteiro D-20 (a)-(i) está pronto com a coluna de resultado vazia. A fase NÃO está concluída: falta a pessoa do time rodar o D-20 no Chrome com Meet reais.**

## Status honesto do plano

- **Task 1 (portão automático): concluída.**
- **Task 2 (build + roteiro D-20): preparada. O `human-check` do D-20 NÃO foi executado e NÃO foi marcado como aprovado.** Quem executa: uma pessoa do time (quem conduz a fase), com Chrome ≥ 116 e o backend local e o web app que ela mesma sobe com o próprio `.env`. Quando: durante o `/gsd-verify-work` da Fase 8, depois deste plano. O executor não subiu backend, não leu `.env`, não deployou nada.
- TAQ-02 **não** foi marcado como concluído e a fase não foi dada como concluída (depende da aprovação humana do D-20).

## Lembretes obrigatórios (antes de qualquer deploy, merge ou junção com o AGM)

1. **TEM QUE CRIAR `GEMINI_API_KEY` NO RAILWAY** (B2 = `aprovar-sem-env`). Sem ela, projetos sem chave própria (os criados pela Taqciti) não rodam o pipeline de IA, e a importação de PDF (pdf-fallback = sim) também depende dela.
2. **Ordem de rollout:** migração `chunk_id` (JÁ aplicada em produção no Supabase em 2026-10-12) → deploy do backend (rota de finish do 08-15 e corrida do `stop_session`) → build da Taqciti.
3. **NÃO distribuir o build da Taqciti antes do teste manual D-20.**
4. O backend vai para a `master` por merge da `main`, e o deploy sai da `master` (informação do usuário).
5. **Revisar o risco T-08-10 antes do deploy** (rotas de escrita da extensão abertas enquanto `EXTENSION_SHARED_KEY` não estiver ativa no Railway; aceito pelo Time Antonio até o login do AGM, 08-07-SUMMARY, 2026-10-12).

## Resultado do portão automático (saída real, 2026-10-12)

| Verificação | Resultado |
|-------------|-----------|
| `cd taqciti && npm test` | `Test Files 85 passed (85)`, `Tests 1294 passed (1294)`, exit 0 (baseline de partida da fase: 42 / 619) |
| `npm run typecheck` (`tsc --noEmit`) | sem erros, exit 0 |
| `npm run lint` (`eslint src`) | sem erros, exit 0 |
| `npm run build` (taqciti) | `built in 3.02s`, exit 0; `taqciti/dist` ignorado pelo git; manifesto com `permissions: ['storage','sidePanel','scripting','identity','alarms']` |
| `npm --prefix frontend run build` | `built in 1.12s`, exit 0 |
| backend, lista de testes puros | `73 passed, 4 skipped in 2.44s` |
| diff dos manifestos de pacote (`main...HEAD`) | vazio (nenhum pacote novo na fase) |
| linhas `⬜ pending` no mapa | 0 |
| linhas `T-08-10:` no `08-VALIDATION.md` | 1 |

Lista do backend: `test_webhook_auth.py`, `test_pipeline_get_or_create_lock.py`, `test_extension_chunk_extra_fields.py`, `test_finish_stops_pipeline.py`, `test_projects.py`, `test_upload_pdf_mode.py`, `test_extension_clients.py` e `test_webhook_idempotency.py`. A lista bate com as decisões: B1 = `aprovar-recomendado` (08-07) com `test_extension_clients.py` presente; B3-a = `aprovar-chunk-id` (08-09) com `test_webhook_idempotency.py` presente.

Os 4 `skipped` são stubs antigos de `test_projects.py` ("implement in Plan 02"), anteriores à fase.

**Falha pré-existente, fora do portão:** `tests/test_schema.py::test_tables_exist` falha com `postgrest APIError` porque precisa de um Supabase real; já estava registrada no 08-09-SUMMARY ("Itens adiados") e não conta. (Foi rodada uma vez por engano de escopo, só para confirmar a mesma falha; não lê `.env` por conta do executor.)

Verificação cruzada: ROADMAP §Phase 8 (critérios 1-5) e REQUIREMENTS (TAQ-02) descrevem o seletor de cliente por reunião (D-01), sem divergência; nada foi editado nesses dois arquivos.

## Pendências do time (PENDÊNCIA, nunca "aceita pelo time")

O time **não respondeu** os itens abaixo. Registrados também no `08-VALIDATION.md`, seção "Pendências por decisão do time".

- **DA-4:** aba que NAVEGA para outro site no meio da call, sem fechar (sem `tabs.onRemoved` nem `meet/ended`): mesmo custo de IA ocioso; **nada implementado**. Opção recomendada: `navegar-encerra`.
- **DA-5:** depois de cerca de 16 h de falha de rede/5xx, ou de recusa 401/403/4xx, a Taqciti desiste de encerrar e nada mais encerra a sessão (nem a varredura do boot); só registra no log. Opção recomendada: `nova-rodada-no-boot`.
- **B3-b:** sem resposta → padrão `retirada-nunca`; valor aplicado `AGENTE_OUTBOX_SERVER_ERROR_MAX_AGE_MS = null` (08-23). Padrão por falta de resposta, não decisão do time.
- **B3-c:** sem resposta → `404-depois`. 404 webhook: pendência com dono quem conduz a fase, revisitar no cutover da Fase 9 (hoje `session_id` inexistente vira 500).
- **`finishGaveUp` não é limpo pela retomada do envio (08-20):** pedir confirmação do time.
- **Histórico cheio de reuniões não enviadas (Open Question 5, 08-13):** o histórico nunca remove reunião não enviada; o aviso na UI é decisão do time e não foi feito; a cota é medida no D-20.
- **Remoção de código da Fase 7** (`confirmNewMeeting`, `confirmedMeetingId`, `configDestination`, texto "confirme abaixo" em `agenteStatus.ts`): decisão de remoção registrada no 08-01, dependente do time.
- **T-08-10 (alto):** risco residual aceito por Time Antonio até o login do AGM; `EXTENSION_SHARED_KEY` não confirmada no Railway. Revisar antes do deploy.
- **B2 `aprovar-sem-env`:** `GEMINI_API_KEY` ainda não existe no Railway (lembrete 1).

Respostas do time já aplicadas (não são pendência): B1 `aprovar-recomendado`, B2 `aprovar-sem-env` + pdf-fallback sim, B3-a `aprovar-chunk-id` (migração aplicada em 2026-10-12), B4-b `sw-com-alarms` ajustada, B5 `vincular-ao-vivo`, D-11 `confirmar-d11`, DA-1 `reuniao-nova-de-verdade`, DA-2 `continuar-com-aviso`, DA-3 `fechar-aba-encerra`.

## Roteiro D-20 (resumo; o completo está no `08-VALIDATION.md`)

Pré: backend local `:8000`, web app `:5173`, `GEMINI_API_KEY` no `.env` local da pessoa, extensão carregada de `taqciti/dist`, Chrome ≥ 116.
(a) envio em blocos no fim · (b) queda do Agente + reenvio sem duplicatas · (c) descarte com confirmação · (d) vínculo no meio da reunião · (e) encerramento automático (na hora; ~5 min com envio parado; plano B nunca encerra) · (f) reentrada na mesma sala (depois do encerramento = reunião nova; antes = mesma sessão) · (g) permissão `alarms` sem aviso · (h) nada é encerrado com a reunião ao vivo · (i) aba fechada encerra a reunião e a sessão. Mais os 4 backstops visuais (320 px e 564 px) e a medição `getBytesInUse` (pedir `unlimitedStorage` só acima de ~5 MB).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Bloqueio] Frase "Roteiro manual D-20" já aparecia duas vezes no `08-VALIDATION.md`**
- **Found during:** Task 2
- **Issue:** o gate `grep -c "Roteiro manual D-20"` exige exatamente 1, mas as duas referências antigas (seção Manual-Only) já contavam 2 antes de a seção nova existir.
- **Fix:** as duas referências antigas passaram a dizer "Roteiro D-20 (a)-(i)" / "seção seguinte deste arquivo"; só o título da seção nova mantém "Roteiro manual D-20". Gate: 1; "Quem executa: uma pessoa do time": 2.
- **Files modified:** `.planning/phases/08-taqciti-session-association/08-VALIDATION.md`
- **Commit:** `a820c03`

**2. [Observação] As duas tasks foram commitadas juntas**
- As duas tasks alteram só o `08-VALIDATION.md` e foram feitas na mesma passada, num único commit `a820c03` (em vez de um por task). Reversível com um `git revert`.

**3. [Observação] Consulta SQL do roteiro (b)**
- O plano propõe checar duplicatas agrupando por `text`, o que pode listar uma fala repetida de verdade ("sim"). O roteiro usa o agrupamento por `chunk_id` (garantido pelo índice único) e mantém o por `text` só como conferência.

## Known Stubs

Nenhum introduzido neste plano (só documentação). Stubs herdados: nenhum registrado nos SUMMARYs da fase além dos 4 `skip` antigos de `test_projects.py`.

## Threat Flags

Nenhum: plano só de documentação e verificação. T-08-40 (nunca ler `.env`) e T-08-SC (diff vazio nos manifestos) mitigados.

## Task Commits

1. **Tasks 1 e 2 (documentação):** `a820c03` docs(08-21): portão automático da fase e roteiro manual D-20

## Rollback

`git revert a820c03` volta o `08-VALIDATION.md` ao estado anterior (mapa com `⬜ pending`, sem pendências e sem roteiro).

## Self-Check: PASSED

- `08-VALIDATION.md` com a seção do roteiro e a seção de pendências: encontrado.
- Commit `a820c03` é ancestral de HEAD: encontrado.
- Nenhuma linha `⬜ pending` no mapa; `T-08-10:` registrado; gates de grep passam.
