---
phase: 08-taqciti-session-association
plan: 05
subsystem: taqciti-agente
tags: [taqciti, chrome-extension, bulk-upload, pacing, retry, tdd, vitest, pure-functions, dependency-injection]

requires:
  - phase: 08-taqciti-session-association
    provides: "sendRetryPolicy (classifySendAttempt, retryDelayMs, AGENTE_SEND_MAX_RETRIES) e wordDelta (segmentKey, splitWords) das fases 7 e 8"
provides:
  - "planMeetingUpload / UploadPart: reunião guardada vira partes na ordem falada (uma por segmento com texto), com chunkId determinístico bulk:{meetingId}:{index}"
  - "seedFromParts: palavras cobertas por chave de segmento, a semente que o streamer adota (D-12)"
  - "AGENTE_UPLOAD_BLOCK_SIZE = 20 e AGENTE_UPLOAD_PAUSE_MS = 1000 (suposição A3, a validar no D-20(a))"
  - "runMeetingUpload / UploadOutcome: executor serial com pausa entre blocos, novas tentativas, progresso por índice, parada no primeiro problema, startAt e isCancelled"
affects: [08-10, 08-19, 08-20]

actuals:
  tokens: 4300
  tasks: 2
  commits: 4

plan_head_before: 96f88d1222f9e2c418e141e6ba839e8ab0e46a35
plan_head_after: 21e09251eb89d7e9b9a5a40400130580c19a798d

tech-stack:
  added: []
  patterns:
    - "Motor sem ambiente: send e sleep injetados (DIP); nenhum chrome, fetch, setTimeout nem Promise.all nos dois módulos (conferido por awk)"
    - "Plano puro separado do executor (SRP): meetingUploader.ts decide O QUE enviar, meetingUploadRunner.ts decide COMO (ordem, pausa, retentativas)"
    - "done = posição da próxima parte a enviar, então devolvê-lo como startAt retoma do ponto exato"

key-files:
  created:
    - taqciti/src/features/agente/meetingUploader.ts
    - taqciti/src/features/agente/meetingUploader.test.ts
    - taqciti/src/features/agente/meetingUploadRunner.ts
    - taqciti/src/features/agente/meetingUploadRunner.test.ts
  modified: []

key-decisions:
  - "A pausa entre blocos conta as partes entregues NESTA execução (não a posição absoluta), para que uma retomada com startAt também respeite o ritmo de 20 em 20 para o backend"
  - "done em falha/cancelamento é a posição da parte que não chegou; em sucesso de uma parte é posição + 1 (o mesmo número que o onProgress informa)"
  - "O isCancelled é conferido antes de cada parte (não dentro das esperas de nova tentativa): uma parte em retentativa termina sua política antes de o cancelamento valer"

patterns-established:
  - "Retentativa do envio em partes reaproveita a política do envio ao vivo (mesma classifySendAttempt e retryDelayMs), então os dois caminhos nunca divergem em quais erros valem nova tentativa"

requirements-completed: [TAQ-02]

coverage:
  - id: D1
    description: "A reunião guardada vira um plano de partes ordenado, uma por segmento com texto, com índice (sem renumerar segmentos vazios), chave igual à do cursor do streamer, chunkId determinístico bulk:{meetingId}:{index} e contagem de palavras"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/features/agente/meetingUploader.test.ts#planMeetingUpload / bulkChunkId"
        status: pass
    human_judgment: false
  - id: D2
    description: "seedFromParts devolve, por chave de segmento, as palavras cobertas pelo envio — a semente para o streamer não perder nem repetir palavras"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/features/agente/meetingUploader.test.ts#seedFromParts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Envio serial (máximo de requisições em voo = 1), em blocos de 20 com pausa de 1000 ms (2 pausas em 45 partes, nenhuma depois da última) e progresso 1..45"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/features/agente/meetingUploadRunner.test.ts#envia 45 partes / nunca tem mais de uma requisição em voo"
        status: pass
      - kind: command
        ref: "awk de Promise.all|fetch(|chrome.|setTimeout fora de comentários nos dois módulos = 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "Falha retryable esgotadas as novas tentativas (1 + 3, espera 1000/2000/4000) ou recusa 4xx para o envio e devolve quantas partes chegaram; nada é pulado; send que lança vira erro de rede"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/features/agente/meetingUploadRunner.test.ts#erro de rede constante / 401 / send que lança"
        status: pass
    human_judgment: false
  - id: D5
    description: "Retomar com startAt envia só as partes da posição >= startAt (progresso começa em startAt + 1); isCancelled para antes da próxima parte com done correto"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/features/agente/meetingUploadRunner.test.ts#startAt 10 / isCancelled"
        status: pass
    human_judgment: false
  - id: D6
    description: "Bloco de 20 e pausa de 1 s aguentam uma reunião real sem derrubar o backend (suposição A3)"
    requirement: TAQ-02
    verification: []
    human_judgment: true
    rationale: "O backend nunca recebeu rajada e o motor ainda não está ligado a nenhuma tela (fiação no plano 08-10); a carga real só é validada no teste manual D-20(a)."

duration: ~4min
completed: 2026-10-12
status: complete
---

# Phase 8 Plan 05: Motor do envio em partes (reunião guardada e "tudo o que já foi falado") Summary

**Dois módulos puros e testados — `meetingUploader.ts` (plano de partes por segmento com `chunkId` determinístico `bulk:{meetingId}:{index}` e semente por chave do cursor) e `meetingUploadRunner.ts` (executor serial com blocos de 20, pausa de 1 s, novas tentativas da `sendRetryPolicy`, progresso por índice, parada no primeiro problema e retomada por `startAt`) — sem nenhuma dependência de chrome ou fetch.**

## Performance

- **Duration:** ~4 min (03:24:07Z a 03:28Z)
- **Tasks:** 2 (cada uma com commit RED e commit GREEN)
- **Files:** 4 criados, 0 alterados; `package.json` e `package-lock.json` sem diff

## Accomplishments

- **Plano de partes (Task 1):** `meetingUploader.ts` (77 linhas) exporta `AGENTE_UPLOAD_BLOCK_SIZE`, `AGENTE_UPLOAD_PAUSE_MS`, `UploadPart`, `bulkChunkId`, `planMeetingUpload` e `seedFromParts`. Segmento sem palavras é pulado sem renumerar o índice; a chave vem de `segmentKey` de `wordDelta`, a mesma que o cursor do streamer usa, então a semente casa sem reenviar palavras.
- **Executor serial (Task 2):** `meetingUploadRunner.ts` (96 linhas) exporta `runMeetingUpload` e `UploadOutcome`. Laço `for` com `await` por parte (um em voo), `deliverPart` com a política `classifySendAttempt`/`retryDelayMs`/`AGENTE_SEND_MAX_RETRIES`, pausa depois de cada bloco entregue (nunca depois da última parte) e `send` que lança tratado como erro de rede (IN-10).
- **Testes:** 8 casos em `meetingUploader.test.ts` e 11 em `meetingUploadRunner.test.ts` (o plano pedia 5 e 6; os extras cobrem recuperação por nova tentativa, `send` que lança, `blockSize`/`pauseMs` customizados, bloco que fecha na última parte e plano vazio).
- **Portão do plano:** `cd taqciti && npm test && npm run typecheck && npm run lint` verdes (55 arquivos, 790 testes).

## Task Commits

1. **Task 1 — RED:** `340facd` — **GREEN:** `2debf0d`
2. **Task 2 — RED:** `c7b7caa` — **GREEN:** `21e0925`

**Plan metadata:** commit de docs ao final (SUMMARY + STATE + ROADMAP + REQUIREMENTS).

## Evidência TDD (RED -> GREEN)

- **Task 1 — RED (`340facd`):** o teste falhou porque `./meetingUploader` ainda não existia (`Failed to resolve import`), nenhum teste executou. `semanticAssessment`: o módulo alvo ausente é o estado correto de RED para um arquivo novo, sem sintaxe quebrada no teste. **GREEN (`2debf0d`):** 8/8, typecheck e eslint em 0.
- **Task 2 — RED (`c7b7caa`):** mesma forma (`Failed to resolve import "./meetingUploadRunner"`). **GREEN (`21e0925`):** 11/11, typecheck e eslint em 0, `awk` de paralelismo/ambiente = 0.

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0. **Impact:** nenhum critério de aceite alterado.

## Issues Encountered

- Aviso do git sobre LF/CRLF nos arquivos novos (config do Windows); sem efeito no conteúdo.
- `.planning/config.json` tinha uma alteração anterior sem relação com o plano; foi deixado intacto e nunca incluído em nenhum commit.

## Known Stubs

Nenhum. O motor não é importado por nenhuma tela ainda — a fiação é escopo declarado do plano 08-10, não stub.

## Threat Flags

Nenhum novo. T-08-08 (rajada no backend) mitigado: serial com um em voo (teste de concorrência máxima = 1), blocos de 20 com pausa de 1 s, novas tentativas com espera crescente. T-08-SC: nenhum pacote novo (`package.json`/`package-lock.json` sem diff).

## Decisões em aberto herdadas

- **A3 (suposição, não bloqueia):** tamanho do bloco (20) e pausa (1000 ms) são Claude's Discretion do CONTEXT (D-10), registrados nas constantes com comentário e validados no teste manual D-20(a).
- **B3 (fora deste plano):** enviar o `chunk_id` no corpo da requisição é escopo do plano 08-19; aqui o id só existe no plano de partes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Pronto: o plano 08-10 pode ligar `planMeetingUpload` + `runMeetingUpload` ao envio real (passando `send` e `sleep`) e entregar `seedFromParts` ao streamer.

## Self-Check: PASSED

- Arquivos criados presentes: os 4 de `key-files.created`.
- Commits presentes no histórico: `340facd`, `2debf0d`, `c7b7caa`, `21e0925`; `git rev-list --count` desde o início do plano = 4.
- Acceptance: exports de `meetingUploader.ts` (`AGENTE_UPLOAD_BLOCK_SIZE`, `AGENTE_UPLOAD_PAUSE_MS`, `UploadPart`, `bulkChunkId`, `planMeetingUpload`, `seedFromParts`) importando `segmentKey`/`splitWords` de `./wordDelta`; `meetingUploadRunner.ts` exporta `runMeetingUpload` e `UploadOutcome` e usa `classifySendAttempt` e `retryDelayMs`; `awk` de paralelismo/ambiente = 0; arquivos de produção com 77 e 96 linhas (<= 200).
- Verificação do plano: `cd taqciti && npm test && npm run typecheck && npm run lint` verdes (55 arquivos, 790 testes).

---
*Phase: 08-taqciti-session-association*
*Completed: 2026-10-12*
