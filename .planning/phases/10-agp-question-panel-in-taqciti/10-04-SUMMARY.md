---
phase: 10-agp-question-panel-in-taqciti
plan: 04
subsystem: taqciti-manifest
tags: [chrome-extension, manifest-v3, permissions, tabs, da-4, vitest]

requires:
  - phase: 10-agp-question-panel-in-taqciti
    provides: "DA-4 ('navegar para fora da sala encerra a reunião') já implementada em meetingTabNavigated.ts, que já trata chrome://newtab/ como 'saiu da sala'"
provides:
  - "Permissão 'tabs' no manifesto da Taqciti, com comentário do porquê e do custo (D-04 / WR-06)"
  - "taqciti/src/manifest.test.ts: teste do manifesto (permissões, host_permissions, MV3, Chrome mínimo 116)"
affects: [10-10, 10-11, UAT teste 10, distribuicao-da-extensao]

actuals:
  tokens: 700
  tasks: 1
  commits: 1
commits: 1
plan_head_before: 81f5a8edced050c3b00b394d4ae050a61a268a32
plan_head_after: 3d56661dece5a3305c5daadeebf00220c944f3ae

tech-stack:
  added: []
  patterns:
    - "Teste de manifesto em ambiente node (// @vitest-environment node), estreitando o export de defineManifest com checagem de objeto"

key-files:
  created:
    - taqciti/src/manifest.test.ts
  modified:
    - taqciti/manifest.config.ts

key-decisions:
  - "D-04 (já tomada pelo time, reversibilidade costly): 'tabs' em permissions, não em optional_permissions"
  - "Commit isolado (só manifest.config.ts + manifest.test.ts) para reverter a permissão sozinha com um git revert"

patterns-established:
  - "Build de conferência do manifesto sempre com --outDir numa pasta temporária fora do repositório (nunca em taqciti/dist)"

requirements-completed: [TAQ-05]

coverage:
  - id: D1
    description: "Manifesto declara permissions = ['storage','sidePanel','scripting','identity','alarms','tabs'] e host_permissions = ['<all_urls>']; o manifest.json construído contém \"tabs\""
    requirement: "TAQ-05"
    verification:
      - kind: unit
        ref: "taqciti/src/manifest.test.ts#manifest.config.ts pede as seis permissões, com \"tabs\" por último"
        status: pass
      - kind: other
        ref: "cd taqciti && npx vite build --outDir <pasta temporária> && grep -c '\"tabs\"' manifest.json (resultado 1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Com 'tabs', ir para chrome://newtab/ encerra a reunião (A1) e o aviso de instalação não muda por causa de <all_urls> (A2)"
    requirement: "TAQ-05"
    verification: []
    human_judgment: true
    rationale: "Só o Chrome real prova A1/A2: medição com chrome.management.getPermissionWarningsByManifest no teste 10 do 10-UAT.md (planos 10-10/10-11); nenhum teste automatizado enxerga o comportamento do navegador."

duration: 2min
completed: 2026-10-30
status: complete
---

# Phase 10 Plan 04: permissão 'tabs' (D-04 / WR-06) Summary

**Permissão `tabs` acrescentada ao manifesto MV3 da Taqciti, num commit isolado e revertível sozinho, para a DA-4 enxergar a aba da reunião indo para `chrome://newtab/`, `about:`, `data:` ou `file://`.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-10-30T04:04:01Z
- **Completed:** 2026-10-30T04:05:15Z
- **Tasks:** 1
- **Files modified:** 2 (1 modificado, 1 criado)

## Accomplishments

- `taqciti/manifest.config.ts`: `permissions` agora é `['storage', 'sidePanel', 'scripting', 'identity', 'alarms', 'tabs']`, com um parágrafo de comentário (em português, no estilo dos vizinhos) explicando o porquê (DA-4/WR-06), o custo (aviso medido no UAT, não assumido) e que a extensão nunca loga nem grava URL de aba. `host_permissions` segue exatamente `['<all_urls>']`; nenhuma outra linha do manifesto mudou.
- `taqciti/src/manifest.test.ts`: três casos (seis permissões na ordem, `host_permissions` intacta, MV3 + Chrome mínimo 116), em ambiente `node`.
- Build de conferência numa pasta temporária fora do repositório gerou um `manifest.json` com `"tabs"`; a pasta foi apagada e `taqciti/dist` não foi tocado.

## Task Commits

1. **Task 1 (tracer): permissão 'tabs' no manifesto** - `3d56661` (feat) — contém só `taqciti/manifest.config.ts` e `taqciti/src/manifest.test.ts`

**Plan metadata:** commit `docs(10-04)` seguinte (SUMMARY + STATE + ROADMAP).

## Files Created/Modified

- `taqciti/manifest.config.ts` - 'tabs' ao fim de `permissions` + comentário do D-04
- `taqciti/src/manifest.test.ts` - teste do manifesto

## Verificação executada

| Portão | Resultado |
|--------|-----------|
| `npx vitest run src/manifest.test.ts` | 3 passed |
| `vite build --outDir <tmp>` + `grep -c '"tabs"' manifest.json` | build OK, contagem 1 |
| `git show --name-only HEAD` só com os dois arquivos declarados | OK (isolado) |
| `npx tsc --noEmit` | exit 0 |
| Tracer verificado de ponta a ponta (config -> manifest.json construído) | OK — expansão liberada |

## Decisions Made

Nenhuma nova: D-04 já estava decidida pelo time (rótulo `costly` mantido). Nenhuma DECISÃO EM ABERTO.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Aviso inofensivo do git sobre LF/CRLF no arquivo de teste novo (padrão do Windows neste repositório).

## Backstop (não provado por automação)

- **A1** (com `tabs`, a Nova Guia dispara a DA-4) e **A2** (o aviso de instalação não muda porque `<all_urls>` já é pedido) continuam suposições. Só o teste 10 do `10-UAT.md` no Chrome real, com `chrome.management.getPermissionWarningsByManifest` com e sem `tabs`, prova ambas (planos 10-10/10-11).
- Rollback: `git revert 3d56661`, refazer o build e dar a recarga em `chrome://extensions`. Para quem já tiver instalado com `tabs`, remover a permissão numa atualização não gera aviso nem desativa.

## Known Stubs

None.

## Threat Flags

None - nenhuma superfície nova além da já registrada em T-10-09 (mitigada: nenhum código novo lê URL) e T-10-10 (aceita: decisão D-04).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Pronto para os próximos planos da fase. O `taqciti/dist` oficial só é refeito no plano 10-10 (com as variáveis do UAT); quem já carrega a extensão precisará dar ↻ em `chrome://extensions` depois desse build, e o Chrome pode pedir reaceite (A2 a medir).

## Self-Check: PASSED

- FOUND: `taqciti/manifest.config.ts`, `taqciti/src/manifest.test.ts`
- FOUND: commit `3d56661` (ancestral de HEAD)

---
*Phase: 10-agp-question-panel-in-taqciti*
*Completed: 2026-10-30*
