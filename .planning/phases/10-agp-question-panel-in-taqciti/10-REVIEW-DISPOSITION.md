---
phase: 10
review: 10-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "com a mesma call aberta em duas abas, a fala entra duas vezes na transcrição (`meet/chunk` de aba não dona não é filtrado)"
  - id: WR-02
    severity: warning
    disposition: open
    title: "o manifesto diz que a extensão não tem integração com nenhum backend, e o cabeçalho do `index.ts` repete isso"
  - id: IN-01
    severity: info
    disposition: open
    title: "janela estreita entre a checagem de `isClosing` e o `send-resumed` no \"Continuar envio\""
  - id: IN-02
    severity: info
    disposition: open
    title: "falha ao abrir o WebSocket aparece como \"sessão não ativa\" e nunca tenta de novo"
  - id: IN-03
    severity: info
    disposition: open
    title: "comentários ainda apontam para o `index.ts` depois da divisão (D-05)"
  - id: IN-04
    severity: info
    disposition: open
    title: "as notas da aba AGP aparecem numeradas como se fossem passos"
  - id: IN-05
    severity: info
    disposition: open
    title: "o `CLAUDE.md` diz que a Taqciti \"fala apenas com o backend v2\""
  - id: IN-06
    severity: info
    disposition: open
    title: "`agp-fake-backend.py` cita o nome errado do arquivo e sobe o servidor ao ser importado"
  - id: IN-07
    severity: info
    disposition: open
    title: "no teste de fumaça, `stopServer` pode travar se o processo já tiver saído"
  - id: IN-08
    severity: info
    disposition: open
    title: "a versão do manifesto continua 2.1.2 mesmo com permissão e recurso novos"
open: 10
total: 10
recorded: 2026-10-30T15:09:31.825Z
---

# Phase 10: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |
| IN-06 | info | open | - |
| IN-07 | info | open | - |
| IN-08 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
