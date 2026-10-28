---
phase: 09-cutover-retire-custom-extension
plan: 07
subsystem: testing
tags: [cleanup, supabase, uat, test-data]

requires:
  - phase: 09-cutover-retire-custom-extension
    provides: "09-03: gate D-02 aprovado (condição para qualquer limpeza)"
provides:
  - "Projeto 'visus' e suas 10 sessões apagados do banco de produção, com autorização explícita do usuário"
  - "Teste 7 do 09-UAT.md registrado (skipped = limpeza parcial adiada por decisão do time) e UAT fechado (status: complete)"
affects: []

key-files:
  created:
    - .planning/phases/09-cutover-retire-custom-extension/09-07-SUMMARY.md
  modified:
    - .planning/phases/09-cutover-retire-custom-extension/09-UAT.md
    - .planning/TESTES-MANUAIS-POS-FASE-10.md

key-decisions:
  - "O usuário informou que o projeto 'visus' e as sessões dele foram criados por ele para teste e autorizou apagar tudo (2026-10-28). O plano tratava o 'visus' como cliente real e mandava preservá-lo; a instrução do dono dos dados prevaleceu, mas o impacto foi medido antes de apagar."
  - "O projeto ZZ-TESTE-D20 e a sessão da prova SC1 ficam até o fim da Fase 10 (decisão do usuário, 2026-10-28)."

requirements-completed: []

coverage:
  - id: D1
    description: "Dados de teste do 'visus' apagados por id, sessões antes do projeto, sem tocar nos outros projetos"
    requirement: "TAQ-04"
    verification:
      - kind: other
        ref: "retorno de 10 ids no delete das sessões e de 1 linha no delete do projeto; select final lista os 9 projetos restantes sem o visus"
        status: pass
    human_judgment: false
  - id: D2
    description: "Limpeza do ZZ-TESTE-D20 e da sessão da prova SC1"
    requirement: "TAQ-04"
    verification:
      - kind: manual_procedural
        ref: "09-UAT.md teste 7: skipped; item M9 de TESTES-MANUAIS-POS-FASE-10.md"
        status: waived
    human_judgment: true
    rationale: "Adiado de propósito até o fim da Fase 10; os ids ficam registrados para a limpeza"

completed: 2026-10-28
status: complete
---

# Phase 9 Plan 07: Limpeza dos dados de teste Summary

**Apagados o projeto `visus` e as 10 sessões dele (51 falas, 125 prompts, sem relatório/pergunta/alerta/precificação); `ZZ-TESTE-D20` e a sessão da prova ficam até o fim da Fase 10.**

## Accomplishments

- Antes de apagar, mediu-se o impacto: o `visus` tinha **10 sessões** (e não as 2 do plano), todas de 26/09 a 27/10, e nenhuma precificação. As chaves estrangeiras foram conferidas (cascata nas sessões e dependentes).
- Apagou-se por id, sessões primeiro e depois o projeto com a trava `client = 'visus' and not exists (sessões)`; conferido depois com `select`.

## Task Commits

1. **Teste 7 registrado e UAT fechado** - commit `docs(09-07)` (este plano)

## Deviations from Plan

- **O plano previa apagar `ZZ-TESTE…` e as 2 sessões da Fase 8, preservando o `visus`.** O usuário disse que o `visus` era dado de teste dele e autorizou apagá-lo por inteiro; o `ZZ-TESTE-D20` ficou. Por isso o critério "0 linhas para `ZZ-TESTE%` e `visus` presente" não foi usado; o teste 7 ficou `skipped` com o motivo.
- O `delete` foi executado pelo orquestrador via conector do Supabase (equivalente ao sinal `autorizo-executor`), e não pelo usuário no SQL Editor. A primeira tentativa do conector falhou com "Invalid or expired requestState" e a segunda funcionou.
- O DocuData não foi tocado (nada foi exportado nesta prova, `DOCUDATA_URL` ausente).

## Known Stubs

Nenhum.

## Threat Flags

Nenhum novo. O `delete` em produção só rodou depois de listagem, medição de impacto e autorização explícita; rollback, se algo errado tivesse saído, seria o backup point-in-time do Supabase (ação do time). Nada de segredo foi registrado.

## Issues Encountered

- O plano e o HANDOFF diziam que só sobravam 2 sessões; o banco tinha 8 a mais, do mesmo projeto. Ficou registrado no teste 7 e acima.

## Self-Check: PASSED

- FOUND: `09-UAT.md` com teste 7 `result: skipped` e `status: complete`
