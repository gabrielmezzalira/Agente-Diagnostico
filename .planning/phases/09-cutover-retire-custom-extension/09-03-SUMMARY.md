---
phase: 09-cutover-retire-custom-extension
plan: 03
subsystem: testing
tags: [uat, taqciti, cutover, sc1, gate-d02]

requires:
  - phase: 09-cutover-retire-custom-extension
    provides: "09-02: roteiro da prova SC1 e ambiente local (testes 1 e 2 do UAT)"
provides:
  - "Evidência da prova SC1 em 09-UAT.md (testes 3 e 6 = pass; 4 e 5 = dispensado, com motivo)"
  - "gate_d02 = aprovado: a remoção da extensão antiga (09-05) está liberada"
affects: [09-04, 09-05, 09-07]

key-files:
  created:
    - .planning/phases/09-cutover-retire-custom-extension/09-03-SUMMARY.md
  modified:
    - .planning/phases/09-cutover-retire-custom-extension/09-UAT.md

key-decisions:
  - "Teste 4 (cobertura e perguntas das duas lentes) DISPENSADO pelo time em 2026-10-28, e não aprovado por evidência: a chave do Gemini estava sem crédito (402 RESOURCE_EXHAUSTED), então a sessão ficou com 0 snapshots, 0 perguntas e 0 alertas. A conferência precisa ser repetida quando a chave tiver crédito."
  - "Teste 5 (PRD) DISPENSADO por mudança de produto: o time não gera mais PRD a partir de reuniões; o substituto será um sistema de fluxos, um por sessão, deixado para depois. A retirada do botão Gerar PRD e das rotas de relatório/prontidão é trabalho separado, fora da Fase 9."
  - "Aprovação do gate D-02 registrada a partir da resposta do usuário 'task 1 OK' ao checkpoint da Task 3 (o plano pedia a palavra 'aprovado'); reversível com git revert do commit do gate."

requirements-completed: []

coverage:
  - id: D1
    description: "Transcrição só pela Taqciti: sessão source=extension, mode=discovery, toda fala com chunk_id"
    requirement: "TAQ-04"
    verification:
      - kind: manual_procedural
        ref: "09-UAT.md teste 3: falas=13, com_chunk_id=13 (sessão 5e67b872-b5c1-4751-91bf-7d7157b15b9c)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Sair da sala encerra a sessão pelo caminho da Taqciti (/finish)"
    requirement: "TAQ-04"
    verification:
      - kind: manual_procedural
        ref: "09-UAT.md teste 6: status=finished; log POST /webhook/extension/sessions/<id>/finish 200"
        status: pass
    human_judgment: true
    rationale: "finished_at ficou 6min41s depois da última fala; o banco não separa 'pessoa parada' de 'atraso do encerramento'"
  - id: D3
    description: "Cobertura e perguntas das duas lentes na sessão da prova"
    requirement: "TAQ-04"
    verification:
      - kind: manual_procedural
        ref: "09-UAT.md teste 4: dispensado; 0 snapshots/perguntas por 402 do Gemini"
        status: waived
    human_judgment: true
    rationale: "Dispensa decidida pelo time; backstop = UAT 135/135 da Fase 8 e testes das Fases 3-5. Repetir com chave com crédito."

completed: 2026-10-28
status: complete
---

# Phase 9 Plan 03: Prova SC1 do cutover Summary

**Uma reunião real só com a Taqciti provou transcrição (13 falas, todas com chunk_id) e encerramento da sessão; cobertura/perguntas e PRD ficaram dispensados por decisão do time, e o gate D-02 foi aprovado.**

## Accomplishments

- Reunião real de 2026-10-28 (sessão `5e67b872-b5c1-4751-91bf-7d7157b15b9c`, cliente `ZZ-TESTE-D20…`): `source='extension'`, `mode='discovery'`, 13 falas e 13 com `chunk_id`, sessão `finished` pela chamada `/finish` da Taqciti.
- Evidência colhida só com `select` (nada escrito no banco) e registrada nos testes 3 a 6 do `09-UAT.md`.
- `gate_d02` aprovado em commit separado do commit de evidência.

## Task Commits

1. **Task 2: evidência da prova SC1** - `4e8abfa` (docs)
2. **Task 3: gate D-02 aprovado** - `f2beb99` (docs)

A Task 1 foi humana (a reunião no Meet); não gera commit.

## Deviations from Plan

- **Teste 4 não passou e foi dispensado em vez de reprovar o gate.** O plano manda marcar `gate_d02: reprovado` e parar quando um teste falha. O usuário escolheu, entre as opções oferecidas (dispensar / repetir com chave com crédito / reprovar), dispensar o teste 4. O motivo é externo à Taqciti (crédito do Gemini).
- **Teste 5 dispensado por mudança de produto**, e não por falha.
- **Cliente da prova** foi o `ZZ-TESTE-D20…` (sobra da Fase 8), e não o `ZZ-TESTE-F09` do roteiro; o critério do teste só exige o prefixo `ZZ-TESTE`.

## Known Stubs

Nenhum (plano só de verificação; nenhum código mudou).

## Threat Flags

Nenhum novo. T-09-06: só `select` foi rodado. T-09-07: a evidência traz contagens e o id da sessão de teste, sem transcrição nem dado de cliente real. T-09-02 (rotas `/webhook/extension*` sem chave, D-08) continua aberto.

## Issues Encountered

- **Gemini sem crédito (402)** em todas as chamadas de IA durante a reunião. O pipeline engole a falha (a interface não mostrou erro nenhum); só o log do backend revelou. Registrado como achado de qualidade para o plano de fechamento.
- O backend local, subido em segundo plano, foi encerrado pelo sistema por pouca memória; não afeta o que falta.

## Pendências levadas adiante

- Repetir a conferência de cobertura e perguntas por lente quando a chave do Gemini tiver crédito (teste manual, fora do código).
- Limpeza do 09-07: as 2 sessões da Fase 8 (`ce75b9af-…`, `6cd362ad-…`) ainda existem e pertencem ao cliente **real** `visus`; o projeto `ZZ-TESTE-D20…` também existe. Decisão do usuário.

## Self-Check: PASSED

- FOUND: `09-UAT.md` com `gate_d02: aprovado`
- FOUND: commits `4e8abfa`, `f2beb99`
