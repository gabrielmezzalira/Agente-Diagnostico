---
phase: 09-cutover-retire-custom-extension
plan: 05
subsystem: infra
tags: [cleanup, removal, extension, taqciti]

requires:
  - phase: 09-cutover-retire-custom-extension
    provides: "09-03: gate D-02 aprovado; 09-04: página /extension já não aponta para o zip antigo"
provides:
  - "Zip e pasta extension/ da extensão antiga removidos do repositório (continuam no histórico do git)"
  - "Prova de que nenhuma suíte mudou de resultado depois da remoção"
affects: [09-06]

key-files:
  created: []
  modified:
    - agente-diagnostico-extension-v1.0.0.zip (removido)
    - extension/ (12 arquivos removidos)

key-decisions:
  - "Remoção em dois commits atômicos (zip, depois pasta), cada um reversível sozinho (D-09)."
  - "Nada em backend/app foi tocado: /webhook/extension, ExtensionChunk e source='extension' continuam (SC3)."

requirements-completed: [TAQ-04]

coverage:
  - id: D1
    description: "Zip e pasta extension/ fora do repositório"
    requirement: "TAQ-04"
    verification:
      - kind: other
        ref: "git ls-files extension e do zip = vazio; test ! -e extension; commit 818832d (1 arquivo) e 2821e7b (12 remoções)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Nada dependia da extensão antiga: suítes iguais antes e depois"
    requirement: "TAQ-04"
    verification:
      - kind: unit
        ref: "backend 279 passed/4 skipped; frontend 24 passed; taqciti 1434 passed (typecheck, lint e build ok); idênticos antes e depois"
        status: pass
    human_judgment: false
  - id: D3
    description: "Contrato /webhook/extension, ExtensionChunk e source=extension continuam no backend (SC3)"
    requirement: "TAQ-04"
    verification:
      - kind: unit
        ref: "backend/tests/test_extension_chunk_extra_fields.py -k sc3: 4 passed (rodado pelo executor)"
        status: pass
    human_judgment: false

completed: 2026-10-28
status: complete
---

# Phase 9 Plan 05: Remoção da extensão antiga Summary

**O zip e a pasta `extension/` saíram do repositório em dois commits reversíveis, sem nenhuma suíte mudar de resultado e sem tocar no contrato `/webhook/extension` do backend.**

## Accomplishments

- Grep global por consumidores: só comentários e documentação (CLAUDE.md, PLANO_AJUSTES.md, diagnostico/README.md, 2 comentários em `taqciti/src`, 1 em um teste do backend); nenhum código, Dockerfile, `vercel.json` ou `railway.toml` dependia da pasta.
- Suítes rodadas uma de cada vez, antes e depois da remoção, com o mesmo resultado.

## Task Commits

1. **Task 1: zip** - `818832d` (chore)
2. **Task 2: pasta extension/** - `2821e7b` (chore)

Rollback de cada passo: `git revert 818832d` ou `git revert 2821e7b`.

## Deviations from Plan

Nenhum desvio de comportamento. Duas observações de medição:

- **Um teste ficou de fora das duas medições do backend:** `tests/test_schema.py::test_tables_exist`, que consulta o Supabase real pela fixture `supabase_client` (teste de integração com o banco de produção, não de código). Como foi excluído antes e depois, a comparação é justa; mas ele não prova nada sobre o estado do código. Fica anotado para a revisão de qualidade (testes que dependem do banco de produção).
- O `git rm -r` deixou as pastas vazias `extension/lib` e `extension/tests` no disco; foram removidas com `rmdir` depois de conferir que estavam vazias.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum. Nada de segredo foi aberto; `dist/` gerado pelos builds é ignorado pelo git.

## Issues Encountered

- **Baseline de lint do frontend inalterado:** 7 problemas (6 erros, 1 aviso) em `usePricing.ts`, `usePricingFeatures.ts`, `PricingEditorPage.tsx`, `ProjectDetailPage.tsx:68`, `SessionActivePage.tsx:163`. Idênticos antes e depois; não corrigidos (fora do escopo).

## Pendências do time (fora do repo, ninguém agiu)

- Apagar ou manter a release v1.0.0 no GitHub (`gabrielmezzalira/Agente-Diagnostico`) e a pasta antiga do Drive. O zip antigo continua baixável enquanto a release existir. Está em "Decisões pendentes do time" no `09-UAT.md`.

## Self-Check: PASSED

- FOUND: commits `818832d` (1 arquivo) e `2821e7b` (12 remoções); `extension/` e o zip ausentes do disco
