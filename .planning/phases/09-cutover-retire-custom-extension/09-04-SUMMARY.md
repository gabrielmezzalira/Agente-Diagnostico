---
phase: 09-cutover-retire-custom-extension
plan: 04
subsystem: ui
tags: [frontend, react, taqciti, extension-page]

requires:
  - phase: 09-cutover-retire-custom-extension
    provides: "09-03: gate D-02 aprovado"
provides:
  - "Página /extension reescrita para a Taqciti (instalação por sistema, vínculo da reunião a um cliente, aviso da extensão antiga)"
  - "Dados puros da página em frontend/src/lib/taqcitiInstall.ts, com teste"
affects: [09-05, 09-06]

key-files:
  created:
    - frontend/src/lib/taqcitiInstall.ts
    - frontend/src/lib/taqcitiInstall.test.ts
    - frontend/src/components/extension/StepList.tsx
  modified:
    - frontend/src/pages/ExtensionPage.tsx
    - frontend/src/lib/labels.ts

key-decisions:
  - "Task 1 resolvida como 'sem-link' pelo usuário em 2026-10-28: TAQCITI_RELEASES_URL = null e a página mostra 'O link de download será publicado após o deploy' no lugar do botão. A forma de distribuir a Taqciti fica para depois do deploy."
  - "O teste só exige https + host/caminho quando a URL deixar de ser null; EXPECTED_HOST e EXPECTED_PATH_PREFIX estão null de propósito, então publicar a URL sem ajustar o teste faz ele falhar (guarda contra link inventado)."

requirements-completed: []

coverage:
  - id: D1
    description: "Página /extension ensina a instalar a Taqciti e a vincular a reunião a um cliente, sem citar o zip antigo, chave nem URL de backend"
    requirement: "TAQ-04"
    verification:
      - kind: unit
        ref: "frontend/src/lib/taqcitiInstall.test.ts (7 testes); npm --prefix frontend test = 4 arquivos, 24 testes passando (rodado de novo pelo orquestrador)"
        status: pass
      - kind: manual_procedural
        ref: "Task 3: usuário abriu http://localhost:5173/extension e respondeu 'ok' em 2026-10-28"
        status: pass
    human_judgment: true
    rationale: "O visual só um humano confere; nenhum teste automático olha a página renderizada"

completed: 2026-10-28
status: complete
---

# Phase 9 Plan 04: Página /extension para a Taqciti Summary

**A página "Instalar extensão" passou a ensinar a instalar a Taqciti (Windows, macOS, Linux), a vincular a reunião a um cliente e a remover a extensão antiga; sem botão de download até o time definir a distribuição.**

## Accomplishments

- Dados puros em `taqcitiInstall.ts` (passos por sistema, passos do vínculo, aviso D-11, aviso de link pendente) com 7 testes, escritos em RED antes do código.
- `StepList.tsx` (lista numerada reutilizável) e `ExtensionPage.tsx` reescrita só compondo (72 linhas; limite 120).
- Constante antiga do zip removida de `labels.ts`; o grep do resíduo no `frontend/src` caiu de 4 para 0.

## Task Commits

1. **Revisão do plano (sem link por enquanto)** - `946a361` (docs)
2. **Task 2: página /extension para a Taqciti** - `9875677` (feat)

Task 1 foi decisão do usuário (resolvida "sem-link"); Task 3 foi a conferência humana (resposta "ok").

## Deviations from Plan

- **Task 1 não gerou URL**: o plano previa uma URL de release; o usuário decidiu publicar sem link (ver REVISÃO 2026-10-28 no próprio plano). Reversível com um commit trocando o `null` e os valores esperados no teste.
- O executor extraiu um componente local `AmberNotice` dentro da página para não repetir o markup do bloco âmbar, e acrescentou 2 testes além do previsto (passos não citam release; ramo `null` do link).

## Known Stubs

- `TAQCITI_RELEASES_URL = null`: o botão de download não existe até a distribuição ser definida. É intencional e está dito na tela; não é um stub escondido.

## Issues Encountered

- **O lint do frontend já falhava antes desta mudança** (7 problemas, 6 erros e 1 aviso, idênticos antes e depois): `usePricing.ts`, `usePricingFeatures.ts`, `PricingEditorPage.tsx`, `ProjectDetailPage.tsx:68`, `SessionActivePage.tsx:163`. Nada nos arquivos deste plano. Não corrigido (fora do escopo); registrado para o relatório de segurança e qualidade do fechamento.
- O `tsc` reclamou de um cast no teste na primeira tentativa; corrigido com `null as string | null`.

## Self-Check: PASSED

- FOUND: commit `9875677` com exatamente os 5 arquivos do plano
- FOUND: `npm --prefix frontend test` com 24 testes passando; build `tsc -b && vite build` com saída 0
