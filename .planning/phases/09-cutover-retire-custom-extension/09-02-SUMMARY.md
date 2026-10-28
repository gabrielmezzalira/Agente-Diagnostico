---
phase: 09-cutover-retire-custom-extension
plan: 02
subsystem: testing
tags: [uat, taqciti, vite, chrome-extension, local-proof, sc1]

requires:
  - phase: 09-cutover-retire-custom-extension
    provides: "09-01: semente SC3 do contrato /webhook/extension"
  - phase: 08-taqciti-session-association
    provides: "seletor de cliente por reunião e envio da Taqciti ao backend"
provides:
  - "09-UAT.md com o roteiro da prova SC1 (7 testes, gate_d02 pendente, limpeza, decisões do time, seção Depois do deploy)"
  - "Ambiente local da prova registrado e aprovado: backend 127.0.0.1:8000, web app localhost:5173, Taqciti carregada de taqciti/dist"
affects: [09-03, 09-05, 09-07]

actuals:
  tokens: 6000
  tasks: 3
  commits: 4
plan_head_before: b4d021217f2cd74e0522c0a25ebec6d0311e99a5
plan_head_after: 194c29e4810927dc08278b559fdf1facca42dd1b
commits: 4

tech-stack:
  added: []
  patterns: ["prova de aceite registrada em 09-UAT.md com evidence por marcas verificáveis por grep"]

key-files:
  created:
    - .planning/phases/09-cutover-retire-custom-extension/09-UAT.md
  modified: []

key-decisions:
  - "Re-decisão do usuário (2026-10-27): a prova SC1 roda LOCAL; deploy e release com URL de produção saem da fase e ficam em '## Depois do deploy' do 09-UAT.md"
  - "O banco usado na prova é o de produção (Agente-Diagnostico, ref fzvwtkipzxdnubprvfct); os SQLs da prova e da limpeza rodam nele, com cliente de teste ZZ-TESTE-F09"
  - "DOCUDATA_URL ausente: sem exportação ao DocuData nesta prova; a ligação com o DocuData fica para a Fase 10 ou depois"

requirements-completed: [TAQ-04]

coverage:
  - id: D1
    description: "09-UAT.md com roteiro da prova SC1, SQLs somente leitura, gate_d02 pendente e pendências do time"
    requirement: "TAQ-04"
    verification:
      - kind: other
        ref: "grep -c '^### [1-7]\\. ' 09-UAT.md = 7; grep -c '^gate_d02: pendente' = 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "Ambiente local da prova (testes 1 e 2 do UAT) com result: pass"
    requirement: "TAQ-04"
    verification:
      - kind: manual_procedural
        ref: "09-UAT.md testes 1 e 2: result: pass com marcas de evidence"
        status: pass
    human_judgment: true
    rationale: "A carga da Taqciti no Chrome e a tela do Agente só um humano confere; o log do backend local (GET /webhook/extension/clients 200) confirma de forma independente"

duration: 1 dia (com pausas para ação do usuário)
completed: 2026-10-27
status: complete
---

# Phase 9 Plan 02: Roteiro e pré-requisitos locais da prova SC1 Summary

**Roteiro da prova SC1 em 09-UAT.md e ambiente local aprovado (backend 127.0.0.1:8000, web app local, Taqciti carregada de taqciti/dist com envio ligado), pronto para a reunião real do plano 09-03.**

## Performance

- **Duration:** 1 dia (com pausas para ação do usuário)
- **Completed:** 2026-10-27
- **Tasks:** 3 (a Task 3 teve parte automática e parte humana)
- **Files modified:** 1 (09-UAT.md, criado)

## Accomplishments

- Criado o `09-UAT.md` com o roteiro da reunião SC1 na ordem exigida pelo D-03 (Gerar PRD com a sessão ainda ativa, conferir `reports` antes de sair da sala), 4 SQLs somente leitura, `gate_d02: pendente`, ramo de falha `reuniao-falhou`, seção de limpeza e a lista de decisões do time.
- Registrada a re-decisão do usuário de 2026-10-27: prova local primeiro. Deploy, GEMINI_API_KEY no Railway, deploy da Vercel e a release da Taqciti com URL de produção ficaram em `## Depois do deploy (fora da Fase 9)`, com um teste rápido em produção.
- Teste 1 aprovado: backend local no commit 0a4b792 com `/webhook/extension/sessions` no openapi, web app falando com o backend local, banco identificado como produção, variáveis conferidas pelo usuário (só nomes).
- Teste 2 aprovado: build local da Taqciti no commit 82f7223 com `127.0.0.1:8000` no bundle (1 arquivo), carregada de `taqciti\dist` no Chrome e tela do Agente com a URL local e o envio ligado. A confirmação da tela veio do usuário; o log do backend local recebeu `GET /webhook/extension/clients 200`, chamada que só a Taqciti faz.

## Task Commits

1. **Task 1: criar 09-UAT.md, roteiro da prova SC1** - `67c798e` (docs)
2. **Ajuste: re-decisão do usuário, prova local** - `0a4b792` (docs)
3. **Task 2: teste 1, ambiente local registrado** - `82f7223` (docs)
4. **Task 3: teste 2, Taqciti local registrada** - `194c29e` (docs)

**Plan metadata:** commit separado de metadados (docs: conclui plano 09-02)

## Files Created/Modified

- `.planning/phases/09-cutover-retire-custom-extension/09-UAT.md` - roteiro, testes 1-7, limpeza, decisões pendentes e pendências pós-deploy

## Decisions Made

- Prova SC1 local, deploy depois (re-decisão do usuário, 2026-10-27).
- Banco da prova = produção (Agente-Diagnostico, ref `fzvwtkipzxdnubprvfct`); cliente de teste `ZZ-TESTE-F09`, apagado por id só depois de `gate_d02: aprovado`.
- DocuData ausente na prova (sem `DOCUDATA_URL`): a ligação fica para a Fase 10 ou depois.

## Deviations from Plan

Nenhum desvio de código: o plano só produz documentação. A única mudança de rumo foi a re-decisão do usuário (prova local), que o próprio plano já incorpora (commit 0a4b792). O `dist` da build é ignorado pelo git, então a build não gerou commit.

## Authentication Gates

Nenhum.

## Known Stubs

Nenhum (só documentação).

## Threat Flags

Nenhum: nenhuma superfície nova. Lembrete já registrado no UAT: com `EXTENSION_SHARED_KEY` vazia, `/webhook/extension*` aceita qualquer chamador (D-08, WR-01 / T-08-10 seguem abertos).

## Issues Encountered

Nenhum. Nenhum `.env` foi aberto; backend e Vite não foram reiniciados; `taqciti/.github/workflows/release.yml` sem diff em relação à `main`.

## Next Phase Readiness

Pronto para o plano 09-03: a reunião real da prova SC1 (testes 3 a 6) usando o roteiro. `gate_d02` continua `pendente`; só o 09-03 o altera.

## Self-Check: PASSED

- FOUND: 09-UAT.md
- FOUND: commits 67c798e, 0a4b792, 82f7223, 194c29e (ancestrais de HEAD)
