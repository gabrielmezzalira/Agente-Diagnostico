---
phase: 08
review: 08-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: fixed
    title: "Uma fala para sessão inexistente trava a fila durável de envio para sempre (HTTP 500 + \"retirada-nunca\")"
  - id: CR-02
    severity: critical
    disposition: open
    title: "Reunião no endereço novo `/meet/abc-defg-hij` é encerrada no meio da call por qualquer mudança de URL, e a captura para em silêncio"
  - id: WR-01
    severity: warning
    disposition: open
    title: "As rotas novas da extensão ficam abertas a qualquer um quando `EXTENSION_SHARED_KEY` não está definida"
  - id: WR-02
    severity: warning
    disposition: open
    title: "Apagar a reunião do histórico (ou a evicção) deixa a sessão do Agente aberta para sempre, gastando Gemini"
  - id: WR-03
    severity: warning
    disposition: open
    title: "HTTP 401/403 descarta, uma a uma, todas as falas da fila durável, e corrigir a chave apaga o que sobrou"
  - id: WR-04
    severity: warning
    disposition: open
    title: "\"Continuar envio\" pode pular palavras do último segmento que estava sendo falado na hora do vínculo"
  - id: WR-05
    severity: warning
    disposition: open
    title: "Reinício do service worker durante o vínculo ao vivo corta o envio pelo resto da reunião, sem saída"
  - id: WR-06
    severity: warning
    disposition: open
    title: "Checagem de cliente duplicado no backend não é atômica e não bate com a regra da Taqciti"
  - id: WR-07
    severity: warning
    disposition: open
    title: "Edição de projeto não consegue limpar campos (DMS \"Limpar\", budget, vínculo DocuData), e a UI promete que consegue"
  - id: WR-08
    severity: warning
    disposition: open
    title: "`taq:history` continua com leitura-modifica-grava sem fila, agora com mais escritores concorrentes"
  - id: WR-09
    severity: warning
    disposition: open
    title: "Na tela \"Transcrição salva\" com o painel compacto (320 px), o seletor de cliente continua com a lista em 0 px"
  - id: IN-01
    severity: info
    disposition: open
    title: "Service lança `HTTPException` e o finish async chama o cliente Supabase síncrono no event loop"
  - id: IN-02
    severity: info
    disposition: open
    title: "Lock por sessão vaza quando a construção do pipeline falha; tasks do webhook sem referência"
  - id: IN-03
    severity: info
    disposition: open
    title: "`useMeetingAssociation` mostra por um instante a associação da reunião anterior"
  - id: IN-04
    severity: info
    disposition: open
    title: "`ProjectDetailPage` não zera nem cancela o readiness ao trocar de sessão"
  - id: IN-05
    severity: info
    disposition: open
    title: "\"Continuar envio\" e \"Descartar\" ignoram a falha do comando"
  - id: IN-06
    severity: info
    disposition: open
    title: "Definições de \"reunião ao vivo\" e listas de estados duplicadas em vários arquivos"
  - id: IN-07
    severity: info
    disposition: open
    title: "Código duplicado entre containers e raízes de composição"
  - id: IN-08
    severity: info
    disposition: open
    title: "`recall_webhook` acessa o banco direto no router e não recebeu o tratamento do CR-01"
  - id: IN-09
    severity: info
    disposition: open
    title: "A regra `data-picker-takeover` também esconde os toasts e o aviso de captura parada"
  - id: IN-10
    severity: info
    disposition: open
    title: "Testes que leem o código-fonte como texto são frágeis"
  - id: IN-11
    severity: info
    disposition: open
    title: "Comentário da política de reenvio ficou desatualizado com o CR-01"
  - id: IN-12
    severity: info
    disposition: open
    title: "O status de entrega é global, e um 404 de uma sessão antiga aparece na barra da reunião atual"
open: 22
total: 23
recorded: 2026-10-26T22:45:42.307Z
---

# Phase 08: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | fixed | commit 664c033 (sessão inexistente / id não-UUID devolve 404); reconferido na re-revisão de 2026-10-26, seção "Resolvidos" do 08-REVIEW.md |
| CR-02 | critical | open | - |
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| WR-04 | warning | open | - |
| WR-05 | warning | open | - |
| WR-06 | warning | open | - |
| WR-07 | warning | open | - |
| WR-08 | warning | open | - |
| WR-09 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |
| IN-06 | info | open | - |
| IN-07 | info | open | - |
| IN-08 | info | open | - |
| IN-09 | info | open | - |
| IN-10 | info | open | - |
| IN-11 | info | open | - |
| IN-12 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
