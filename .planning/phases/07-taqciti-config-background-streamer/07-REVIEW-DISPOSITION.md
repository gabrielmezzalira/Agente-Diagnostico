---
phase: 07
review: 07-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: fixed
    title: "Reunião nova com o mesmo session_id trava o streaming em silêncio, enquanto a UI diz \"Ligado\""
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "O cursor avança antes do envio ser confirmado: falha de rede perde palavras de vez (agora até 5 s de fala), e a ordem de chegada não é garantida"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "Depois de reiniciar o service worker ou religar o toggle, palavras são descartadas (agora também tudo o que estava pendente na janela)"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "A fila de patches fica envenenada para sempre depois de uma única falha de escrita"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "Erros de gravação não são tratados na tela: rejeição sem tratamento e nenhum retorno para a pessoa"
  - id: WR-05
    severity: warning
    disposition: fixed
    title: "`save()` manda o objeto inteiro, contrariando o contrato do store, grava o padrão da build no storage e descarta o que foi digitado durante o salvamento"
  - id: WR-06
    severity: warning
    disposition: fixed
    title: "A chave `x-agente-key` pode ir em texto puro por `http://` para qualquer host, e digitar \"localhost:8000\" vira https e quebra o dev local"
  - id: WR-07
    severity: warning
    disposition: fixed
    title: "O status \"Ligado — está sendo enviada\" não reflete a entrega real (401, 404 e erros de rede ficam invisíveis)"
  - id: WR-08
    severity: warning
    disposition: fixed
    title: "Se a primeira leitura falhar, `createAgenteConfigReader` guarda a promessa rejeitada e o streamer para até a config mudar"
  - id: WR-10
    severity: warning
    disposition: fixed
    title: "Testes da janela por fala que passam por construção: o \"drain\" é um passo real com efeito colateral"
  - id: WR-11
    severity: warning
    disposition: fixed
    title: "Desligar e religar o toggle dentro da janela envia a fala pendente (D-09 não é reativo)"
  - id: WR-12
    severity: warning
    disposition: fixed
    title: "Se o `loadConfig` falhar no tick, a fala pendente fica sem timer e só sai quando alguém voltar a falar"
  - id: WR-13
    severity: warning
    disposition: fixed
    title: "`dispose()` não é terminal: um passo já enfileirado na instância antiga rearma timer e envia com as deps antigas"
  - id: IN-01
    severity: info
    disposition: fixed
    title: "`.catch` redundante em `flushState`"
  - id: IN-02
    severity: info
    disposition: fixed
    title: "Corrida entre a leitura inicial e o `onChanged` em `subscribeAgenteConfig`"
  - id: IN-03
    severity: info
    disposition: fixed
    title: "URLs com query, fragmento ou esquema estranho passam na validação"
  - id: IN-04
    severity: info
    disposition: fixed
    title: "\"← Voltar\" usa `href=\"?\"` e perde a view de origem"
  - id: IN-05
    severity: info
    disposition: fixed
    title: "A chave salva volta em texto claro para o `value` do input"
  - id: IN-06
    severity: info
    disposition: fixed
    title: "O runbook não diz que o check da release não valida `VITE_AGENTE_BACKEND_URL`"
  - id: IN-07
    severity: info
    disposition: deferred
    title: "`agenteStreamer.test.ts` tem 941 linhas, com o mesmo bloco de preparação copiado 19 vezes"
  - id: IN-08
    severity: info
    disposition: deferred
    title: "`agenteStreamer.ts` está com 190 linhas e acumula quatro responsabilidades"
  - id: IN-09
    severity: info
    disposition: deferred
    title: "A janela usa relógio de parede (`Date.now`), sensível a ajuste de hora do sistema"
  - id: IN-10
    severity: info
    disposition: fixed
    title: "Um `send` que lança de forma síncrona perde as falas restantes da mesma rodada e não rearma o timer"
  - id: IN-11
    severity: info
    disposition: fixed
    title: "A fala pendente de uma sessão antiga sai com a URL e a chave atuais, não as do momento em que foi acumulada"
open: 0
total: 24
recorded: 2026-09-27T15:39:56.559Z
---

# Phase 07: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | fixed | 07-REVIEW-FIX.md |
| WR-01 | warning | fixed | 07-REVIEW-FIX.md |
| WR-02 | warning | fixed | 07-REVIEW-FIX.md |
| WR-03 | warning | fixed | 07-REVIEW-FIX.md |
| WR-04 | warning | fixed | 07-REVIEW-FIX.md |
| WR-05 | warning | fixed | 07-REVIEW-FIX.md |
| WR-06 | warning | fixed | 07-REVIEW-FIX.md |
| WR-07 | warning | fixed | 07-REVIEW-FIX.md |
| WR-08 | warning | fixed | 07-REVIEW-FIX.md |
| WR-10 | warning | fixed | 07-REVIEW-FIX.md |
| WR-11 | warning | fixed | 07-REVIEW-FIX.md |
| WR-12 | warning | fixed | 07-REVIEW-FIX.md |
| WR-13 | warning | fixed | 07-REVIEW-FIX.md |
| IN-01 | info | fixed | 16b4bab |
| IN-02 | info | fixed | fe14f8c |
| IN-03 | info | fixed | 8e1885c |
| IN-04 | info | fixed | 5267a37 |
| IN-05 | info | fixed | 812214d |
| IN-06 | info | fixed | 7ba1507 |
| IN-07 | info | deferred | Adiado (D3): refatoração própria dos testes do streamer (941 linhas); não muda comportamento. |
| IN-08 | info | deferred | Adiado (D3): separar as responsabilidades do streamer é tarefa de refatoração própria, fora do fechamento da fase. |
| IN-09 | info | deferred | Adiado (D2): as falas pendentes agora sobrevivem ao reinício do service worker e performance.now() zera a cada reinício; a troca criaria um problema mais frequente do que o ajuste de relógio que resolve. |
| IN-10 | info | fixed | Resolvido pela refatoração do agenteSender: send síncrono que lança vira falha tratada (await dentro do try) e submit só enfileira. |
| IN-11 | info | fixed | 6676027 + 62812b9 (fala de outro backend é descartada, para a chave nova não ir ao backend antigo) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
