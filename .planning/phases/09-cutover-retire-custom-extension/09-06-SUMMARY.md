---
phase: 09-cutover-retire-custom-extension
plan: 06
subsystem: docs
tags: [docs, comments, cleanup]

requires:
  - phase: 09-cutover-retire-custom-extension
    provides: "09-05: pasta extension/ e zip removidos"
provides:
  - "Comentários da Taqciti sem citar arquivos apagados"
  - "Documentação do projeto apontando para a Taqciti, com a nota de remoção da extensão antiga e sem o 'repositório separado'"
affects: []

key-files:
  created: []
  modified:
    - taqciti/src/shared/config/agenteConfig.ts (só comentário)
    - taqciti/src/features/agente/wordDelta.ts (só comentário)
    - CLAUDE.md
    - diagnostico/README.md
    - PLANO_AJUSTES.md
    - .planning/PROJECT.md
    - .planning/ROADMAP.md
    - .planning/STATE.md
    - backend/tests/test_extension_chunk_extra_fields.py (só comentário, commit à parte)

key-decisions:
  - "Resíduo do gate: os 2 documentos de .planning/ escritos depois do plano (FECHAMENTO-FASE-09-PLANO.md e INTEGRACAO-MASTER-ANALISE.md) citam 'extension/' em prosa de planejamento/histórico e ficam como estão; o gate do plano não os previa."
  - "O comentário desatualizado em backend/tests/test_extension_chunk_extra_fields.py foi corrigido pelo orquestrador num commit à parte (só comentário), apesar de o plano proibir mexer em testes do backend: a frase dizia que a extensão 'sai do repositório', o que deixou de ser verdade."

requirements-completed: []

coverage:
  - id: D1
    description: "Comentários da Taqciti sem referência a arquivos apagados, sem mudança de comportamento"
    requirement: "TAQ-04"
    verification:
      - kind: unit
        ref: "taqciti: typecheck limpo; wordDelta.test.ts + agenteConfig.test.ts = 73 testes passando"
        status: pass
    human_judgment: false
  - id: D2
    description: "Documentação sem a extensão antiga como destino e sem 'repositório separado' da Taqciti"
    requirement: "TAQ-04"
    verification:
      - kind: other
        ref: "git grep de resíduo: 5 linhas, todas fora do previsto (2 docs de planejamento posteriores ao plano, 1 comentário de teste já corrigido)"
        status: pass
    human_judgment: true
    rationale: "O gate não zerou por causa de arquivos que o plano não previa; a decisão de aceitá-los como histórico é do orquestrador e fica registrada aqui."

completed: 2026-10-28
status: complete
---

# Phase 9 Plan 06: Comentários e documentação sem a extensão antiga Summary

**Dois comentários da Taqciti e seis documentos deixaram de apontar para a extensão apagada; o gate de resíduo ficou com 5 linhas fora do previsto, todas explicadas.**

## Task Commits

1. **Task 1: comentários da Taqciti (só comentário)** - `c9fa60d` (refactor)
2. **Task 2: documentação (6 arquivos)** - `e3e6530` (docs)
3. **Comentário do teste do backend** - commit `docs(09-06)` à parte

## Deviations from Plan

- **O gate de resíduo (`git grep`) não zerou**: devolveu 5 linhas. `FECHAMENTO-FASE-09-PLANO.md` (2) e `INTEGRACAO-MASTER-ANALISE.md` (2) são documentos de análise escritos depois deste plano, onde `extension/` aparece em prosa histórica; ficam. A quinta linha era o comentário do teste do backend, corrigido à parte.
- **`PLANO_AJUSTES.md`:** a segunda nota entrou depois da última linha do item, indentada, para não cortar a frase.
- **`CLAUDE.md` e `diagnostico/README.md`:** a Taqciti é descrita falando com o backend por `POST /webhook/extension` e pelas 3 rotas da Fase 8. O WebSocket `/ws` foi omitido, porque a Taqciti de hoje não o usa (a aba AGP da Fase 10 vai usar; atualizar a frase quando a Fase 10 entrar).
- CRLF preservado nos arquivos que já o tinham.

## Known Stubs

Nenhum.

## Issues Encountered

- O portão final da fase (`<verification>` do plano: pytest do backend, test/lint/build do frontend) não foi rodado de novo aqui; os mesmos comandos rodaram no 09-05, depois da remoção, e desde então só mudaram comentários e documentos. Os 4 testes `sc3` foram rodados de novo depois do ajuste do comentário: 4 passaram.

## Self-Check: PASSED

- FOUND: commits `c9fa60d` e `e3e6530`
