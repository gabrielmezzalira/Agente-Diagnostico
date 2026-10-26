---
phase: 08-taqciti-session-association
verified: 2026-10-26T23:30:00Z
status: gaps_found
score: 6/7 must-haves verified
covered_files:
  - ".planning/phases/08-taqciti-session-association/08-01-PLAN.md"
  - ".planning/phases/08-taqciti-session-association/08-01-SUMMARY.md"
  - ".planning/phases/08-taqciti-session-association/08-02-PLAN.md"
  - ".planning/phases/08-taqciti-session-association/08-02-SUMMARY.md"
  - ".planning/phases/08-taqciti-session-association/08-03-PLAN.md"
  - ".planning/phases/08-taqciti-session-association/08-03-SUMMARY.md"
  - ".planning/phases/08-taqciti-session-association/08-04-PLAN.md"
  - ".planning/phases/08-taqciti-session-association/08-04-SUMMARY.md"
  - ".planning/phases/08-taqciti-session-association/08-05-PLAN.md"
  - ".planning/phases/08-taqciti-session-association/08-05-SUMMARY.md"
  - ".planning/phases/08-taqciti-session-association/08-06-PLAN.md"
  - ".planning/phases/08-taqciti-session-association/08-06-SUMMARY.md"
  - ".planning/phases/08-taqciti-session-association/08-07-PLAN.md"
  - ".planning/phases/08-taqciti-session-association/08-07-SUMMARY.md"
  - ".planning/phases/08-taqciti-session-association/08-08-PLAN.md"
  - ".planning/phases/08-taqciti-session-association/08-08-SUMMARY.md"
  - ".planning/phases/08-taqciti-session-association/08-09-PLAN.md"
  - ".planning/phases/08-taqciti-session-association/08-09-SUMMARY.md"
  - ".planning/phases/08-taqciti-session-association/08-10-PLAN.md"
  - ".planning/phases/08-taqciti-session-association/08-10-SUMMARY.md"
  - ".planning/phases/08-taqciti-session-association/08-11-PLAN.md"
  - ".planning/phases/08-taqciti-session-association/08-11-SUMMARY.md"
  - ".planning/phases/08-taqciti-session-association/08-12-PLAN.md"
  - ".planning/phases/08-taqciti-session-association/08-12-SUMMARY.md"
  - ".planning/phases/08-taqciti-session-association/08-13-PLAN.md"
  - ".planning/phases/08-taqciti-session-association/08-13-SUMMARY.md"
  - ".planning/phases/08-taqciti-session-association/08-14-PLAN.md"
  - ".planning/phases/08-taqciti-session-association/08-14-SUMMARY.md"
  - ".planning/phases/08-taqciti-session-association/08-15-PLAN.md"
  - ".planning/phases/08-taqciti-session-association/08-15-SUMMARY.md"
  - ".planning/phases/08-taqciti-session-association/08-16-PLAN.md"
  - ".planning/phases/08-taqciti-session-association/08-16-SUMMARY.md"
  - ".planning/phases/08-taqciti-session-association/08-17-PLAN.md"
  - ".planning/phases/08-taqciti-session-association/08-17-SUMMARY.md"
  - ".planning/phases/08-taqciti-session-association/08-18-PLAN.md"
  - ".planning/phases/08-taqciti-session-association/08-18-SUMMARY.md"
  - ".planning/phases/08-taqciti-session-association/08-19-PLAN.md"
  - ".planning/phases/08-taqciti-session-association/08-19-SUMMARY.md"
  - ".planning/phases/08-taqciti-session-association/08-20-PLAN.md"
  - ".planning/phases/08-taqciti-session-association/08-20-SUMMARY.md"
  - ".planning/phases/08-taqciti-session-association/08-21-PLAN.md"
  - ".planning/phases/08-taqciti-session-association/08-21-SUMMARY.md"
  - ".planning/phases/08-taqciti-session-association/08-22-PLAN.md"
  - ".planning/phases/08-taqciti-session-association/08-22-SUMMARY.md"
  - ".planning/phases/08-taqciti-session-association/08-23-PLAN.md"
  - ".planning/phases/08-taqciti-session-association/08-23-SUMMARY.md"
  - ".planning/phases/08-taqciti-session-association/08-24-PLAN.md"
  - ".planning/phases/08-taqciti-session-association/08-24-SUMMARY.md"
  - ".planning/phases/08-taqciti-session-association/08-25-PLAN.md"
  - ".planning/phases/08-taqciti-session-association/08-25-SUMMARY.md"
  - ".planning/phases/08-taqciti-session-association/08-26-PLAN.md"
  - ".planning/phases/08-taqciti-session-association/08-26-SUMMARY.md"
  - ".planning/phases/08-taqciti-session-association/08-27-PLAN.md"
  - ".planning/phases/08-taqciti-session-association/08-27-SUMMARY.md"
  - "backend/app/models/projects.py"
  - "backend/app/repositories/transcript_chunks_repository.py"
  - "backend/app/routers/extension_clients.py"
  - "backend/app/routers/webhook.py"
  - "backend/app/services/extension_session_service.py"
  - "supabase/migrations/20261011000000_add_chunk_id_to_transcript_chunks.sql"
  - "taqciti/src/background/agenteAssociationService.ts"
  - "taqciti/src/background/agenteSessionFinisherInstance.ts"
  - "taqciti/src/background/agenteStreamDestination.ts"
  - "taqciti/src/background/agenteStreamer.ts"
  - "taqciti/src/background/agenteStreamerInstance.ts"
  - "taqciti/src/background/meetingTabNavigated.ts"
  - "taqciti/src/features/agente/association.ts"
  - "taqciti/src/features/agente/finishPolicy.ts"
  - "taqciti/src/features/agente/sendRetryPolicy.ts"
  - "taqciti/src/sidepanel/screens/AgenteConfigScreen.tsx"
covered_digest: "v4:sha256:cb595cf765644a570630a1f8a56aab91d48efc337194a3a5d083fac924fc4321"
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "SC5 — um encontro ao vivo nunca é encerrado (e a captura de uma reunião ao vivo não para sozinha)"
    status: failed
    reason: "Desde o commit 861db11 o Meet reescreve todo link para meet.google.com/meet/<código>, e o content script já reconhece esse formato. Mas o service worker decide 'a aba ainda está na sala?' com outra regra (isStillInMeetingRoom), que só olha o PRIMEIRO trecho do caminho. No formato novo esse trecho é 'meet', então a função devolve false para a própria sala. Qualquer mudança de URL na aba durante a call (?authuser, #hash, reescrita do endereço) dispara MEETING_FINISHED com a reunião ao vivo: a reunião passa a 'ended', o agendador de encerramento enxerga a reunião como não ao vivo e pode fechar a sessão do Agente no meio da call, e como o content script continua com inMeeting=true ele não anuncia a reunião de novo, então a captura e o envio param em silêncio até a pessoa sair e entrar. Reproduzido com a função real (cópia byte a byte): /abc-defg-hij => true; /meet/abc-defg-hij => false; /meet/abc-defg-hij?authuser=1 => false; /meet/abc-defg-hij#x => false. É o CR-02 (crítico, 'open') do 08-REVIEW.md. Os testes de meetingTabNavigated só cobrem o formato antigo."
    artifacts:
      - path: "taqciti/src/background/meetingTabNavigated.ts"
        issue: "linhas 36-37: compara o primeiro segmento do caminho com o código da sala; no formato /meet/<código> o primeiro segmento é 'meet'"
      - path: "taqciti/src/content/providers/googleMeet/selectors.ts"
        issue: "MEETING_CODE_PATTERN (formato novo) e isStillInMeetingRoom (formato antigo) são duas regras para o mesmo conceito e divergiram"
    missing:
      - "Uma função pura única (ex.: meetingCodeFromPath) usada pelo content script e pelo service worker, aceitando o prefixo opcional meet/"
      - "Casos novos em meetingTabNavigated.test.ts: /meet/<código>, /meet/<código>?authuser=1 e a troca /<código> -> /meet/<código>, todos esperando 'nada acontece'"
---

# Fase 8: Associação de sessão na Taqciti — Relatório de Verificação

**Objetivo da fase:** Uma reunião da Taqciti se vincula a uma sessão de discovery do backend por meio de uma escolha explícita de cliente por reunião (substitui o auto-detect por localStorage, decidido no D-01 do `08-CONTEXT.md`); trechos nunca são atribuídos sem um vínculo explícito.
**Verificado em:** 2026-10-26
**Status:** gaps_found
**Re-verificação:** Não — verificação inicial (não havia VERIFICATION.md anterior)

## Alcance do objetivo

### Verdades observáveis

As 5 verdades do contrato do ROADMAP (critérios de sucesso 1 a 5) foram verificadas sempre, mais duas verdades de contrato vindas dos checkpoints de decisão do time (B1/B2/B3).

| # | Verdade | Status | Evidência |
|---|---------|--------|-----------|
| 1 | Ao detectar a reunião, a Taqciti pede para escolher cliente (lista pesquisável ou criar novo) ou adiar; escolher cria uma sessão nova no backend e a fala da reunião segue para ela | ✓ VERIFIED | `agenteAssociationLifecycle.ts:89` cria a associação `pending` ao detectar. `PanelApp.tsx:366,427` monta `AgenteNudgeAnchor` (bolha "!"); `PanelApp.tsx:482` monta `AgenteLiveSlot`; `RecordDetail.tsx:80` e `PanelApp.tsx:681` montam `AgenteEndSlot`. `agenteBindTarget.ts` resolve `client`/`new-client`/`manual`. `extension_clients.py:37-60` expõe `GET/POST /clients` e `POST /sessions` (cria sessão `active`, `source='extension'`, 404 se o projeto não existe). `agenteStreamer.ts:75` usa `createAssociationDestination` em produção. UAT 6, 10 e D-20 confirmaram no Meet real (sessão criada, falas 202, finish 200). |
| 2 | Reunião adiada fica só na Taqciti e não envia nada até haver cliente (fim da reunião ou painel); "Descartar" pede confirmação e remove só do histórico local | ✓ VERIFIED | `agenteStreamDestination.ts:76-91`: só `linked` com `sessionId` válido vira `send`; `pending`/`deferred`/sem associação viram `idle`; `linking` vira `hold`. `agenteAssociationService.ts` `discard`: só vale em `ended-unsent` e fora do ar (regra no service worker, não na UI), chama `deleteRecord` + `removeAssociation`, sem chamada ao backend. `AgenteEndSlot.tsx:160-164` usa `ConfirmModal` ("Descartar esta reunião?"). Testes: `agenteStreamerAssociation.test.ts` ("reunião sem associação: o ID salvo na config não envia nada") e `agenteAssociationService.test.ts` passam (execução própria, 147/147 nos 7 arquivos-chave). |
| 3 | O campo de ID manual da Fase 7 fica escondido, só aparece quando a lista de clientes não carrega; trecho só é atribuído a sessão com vínculo explícito, nunca por palpite ou padrão silencioso | ✓ VERIFIED | `AgenteConfigScreen.tsx:108-129`: o campo `agente-session-id` só renderiza com `directory.status === 'error'`. B5: salvar o ID só chama `bindLiveMeeting` (vínculo explícito da reunião ao vivo sem cliente). `grep` por `agenteSessionId` em `background/` mostra que o ID da config só entra no `configDestination` (Fase 7), que não está ligado em produção (`agenteStreamer.ts:136` só o usa se `destination` ausente, e `agenteStreamer.ts:75` injeta a política de associação). `backend`: `webhook.py:43-53` devolve 404 para sessão inexistente (CR-01 corrigido em `664c033`). |
| 4 | Com o Agente fora do ar durante a reunião, as falas não enviadas ficam guardadas e são reenviadas na volta, e a pessoa é avisada na tela | ✓ VERIFIED | `outbox.ts:35` `AGENTE_OUTBOX_RESEND_ENABLED = true`; `sendRetryPolicy.ts` classifica 5xx/429/rede como `retryable` e `classifyExhausted` mantém o item no topo (`hold`) com `AGENTE_OUTBOX_SERVER_ERROR_MAX_AGE_MS = null` (B3-b "retirada-nunca"). `bindingView.ts:27` mostra o estado `offline` e `bindingView.ts:118` a recuperação ("Agente de volta"). Idempotência: `transcript_chunks_repository.py` trata `23505` como duplicata (202 sem reprocessar) e a migração `20261011000000` foi conferida em produção no UAT 9 (coluna e índice únicos). `sendRetryPolicy.test.ts` e `test_webhook_idempotency.py` passam. UAT 11 (queda, reinício do service worker e reenvio) passou. |
| 5 | Sessões criadas pela Taqciti são encerradas automaticamente (fim da reunião, inclusive fechar a aba, com a fila vazia; 5 min com envio parado); reunião ao vivo nunca é encerrada; voltar à mesma sala depois do encerramento = reunião nova | ✗ FAILED (parcial) | O agendador está correto e testado: `finishPolicy.ts:15` `AGENTE_STALLED_SEND_CLOSE_MS = 5*60_000`; `agenteSessionFinisherInstance.ts:57,101` confere `isMeetingLive` antes de chamar o backend; `manifest.config.ts:155` tem a permissão `alarms`; `index.ts:58,125` religa no boot e nos alarmes; `extension_session_service.py:117-154` `finish_session` idempotente, só `source='extension'`. **Porém**, `meetingTabNavigated.ts:36-37` (DA-4) quebra a garantia "reunião ao vivo nunca é encerrada" no formato de endereço que o Meet usa hoje (`/meet/<código>`): ver Lacunas. Reproduzido executando a função real. |
| 6 | Contratos de API aprovados pelo time existem e funcionam: rotas da extensão (B1), chave Gemini opcional na criação de projeto (B2), `chunk_id` idempotente no webhook (B3) | ✓ VERIFIED | `extension_clients.py` montado em `main.py:81`; gate `verify_extension_key` em todas as rotas; `create_client` devolve 409 por nome duplicado sem acento/caixa e cria com `mode='discovery'`, sem chave Gemini. `models/projects.py:38,65`: `gemini_api_key: Optional[str] = None`; `routers/projects.py:61` só grava no Vault se vier chave. `webhook.py:20` `chunk_id` com `max_length=200`. Execução própria: `pytest test_webhook_idempotency / test_extension_clients / test_webhook_auth / test_extension_chunk_extra_fields / test_projects` = 66 passed, 4 skipped. |
| 7 | O requisito TAQ-02 está coberto por todos os planos que o declaram | ✓ VERIFIED | Os 27 planos declaram `requirements: [TAQ-02]`; nenhum ID é órfão (ver Cobertura de requisitos). |

**Pontuação:** 6/7 verdades verificadas (0 presentes mas sem prova de comportamento).

### Itens adiados

Nenhum. O CR-02 não é coberto por nenhuma fase posterior (a Fase 9 é cutover e a Fase 10 é a aba AGP).

### Artefatos obrigatórios

| Artefato | Esperado | Status | Detalhes |
|----------|----------|--------|----------|
| `backend/app/routers/extension_clients.py` | Rotas de listar/criar cliente, criar/encerrar sessão | ✓ VERIFIED | Só roteia; chama o service; montado em `main.py:81` |
| `backend/app/services/extension_session_service.py` | Regras de negócio das rotas da extensão | ✓ VERIFIED | Substantivo (409/404/idempotência); fala só com o repositório e portas injetadas |
| `backend/app/repositories/transcript_chunks_repository.py` | Insert com dedup e tradução de FK/UUID inválido | ✓ VERIFIED | `23505` -> `False`; `23503`/`22P02` -> `SessionNotFoundError` |
| `supabase/migrations/20261011000000_add_chunk_id_to_transcript_chunks.sql` | Coluna `chunk_id` + índice único | ✓ VERIFIED | Aditiva e idempotente; aplicada em produção e conferida no UAT 9 |
| `taqciti/src/features/agente/association.ts` | Reducer puro da associação | ✓ VERIFIED | 9 estados, transição inválida devolve a mesma referência; 68 testes passam |
| `taqciti/src/background/agenteStreamDestination.ts` | Política "para onde vai a fala" | ✓ VERIFIED | Ligada em `agenteStreamer.ts:75` |
| `taqciti/src/background/agenteSessionFinisherInstance.ts` | Agendador do encerramento | ✓ VERIFIED | Ligado em `index.ts:58,125` |
| `taqciti/src/sidepanel/screens/AgenteConfigScreen.tsx` | ID manual só no plano B | ✓ VERIFIED | Condicionado a `directory.status === 'error'` |
| `taqciti/src/background/meetingTabNavigated.ts` | Regra "a aba ainda está na sala" | ✗ DEFECT | Não reconhece `/meet/<código>` (CR-02) |

### Verificação de ligações (key links)

| De | Para | Via | Status | Detalhes |
|----|------|-----|--------|----------|
| `agenteStreamer.ts` | `createAssociationDestination` | `destination:` na raiz de composição | ✓ WIRED | Linha 75; `configDestination` só como fallback de teste |
| `background/index.ts` | `agenteAssociation` | `ui/agente/*` | ✓ WIRED | Linhas 245-256 (list, open, defer, bind, discard, resume-send) |
| `background/index.ts` | `agenteSessionFinisher` | `alarms.onAlarm` + boot | ✓ WIRED | Linhas 58 e 125-126, listener síncrono |
| `PanelApp.tsx` / `RecordDetail.tsx` | Slots Agente (bolha, vivo, fim) | JSX | ✓ WIRED | Linhas 366, 427, 482, 681 e `RecordDetail.tsx:80` |
| `webhook.py` | `TranscriptChunksRepository` | `insert_chunk` | ✓ WIRED | Linhas 44-53; 404 antes do `create_task` |
| `index.ts:118-122` | `onMeetingTabNavigated` | `chrome.tabs.onUpdated` | ⚠️ PARTIAL | Ligado, mas a regra interna diverge do content script (CR-02) |

### Rastreio de fluxo de dados (nível 4)

| Artefato | Variável | Fonte | Dados reais | Status |
|----------|----------|-------|-------------|--------|
| `AgenteConfigScreen` | `directory.status` | `useClientDirectory` -> `ui/agente/clients/list` -> `GET /webhook/extension/clients` -> `projects` | Sim | ✓ FLOWING |
| `ClientPicker` | lista de clientes | mesma cadeia, ordenada por `sortClients` | Sim (UAT 6: lista com clientes reais) | ✓ FLOWING |
| Streamer ao vivo | `target.config.agenteSessionId` | `association.sessionId` gravada por `session-created` após `POST /sessions` | Sim | ✓ FLOWING |

### Verificações de comportamento (spot-checks)

| Comportamento | Comando | Resultado | Status |
|---------------|---------|-----------|--------|
| Sem associação `linked`, nada sai | `npx vitest run` nos 7 arquivos-chave da Taqciti | 147 passed | ✓ PASS |
| Backend: idempotência, 404, gate, rotas da extensão, projetos | `pytest` nos 5 arquivos | 66 passed, 4 skipped | ✓ PASS |
| Typecheck da Taqciti | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| `/meet/<código>` conta como "ainda na sala" | `isStillInMeetingRoom` (cópia byte a byte, `node --experimental-strip-types`) | `/meet/abc-defg-hij => false` (esperado `true`) | ✗ FAIL |

### Execução de probes

Etapa 7c: a fase não declara probes (`probe-*.sh`). Não se aplica.

### Cobertura de requisitos

| Requisito | Plano de origem | Descrição | Status | Evidência |
|-----------|-----------------|-----------|--------|-----------|
| TAQ-02 | 08-01 a 08-27 (os 27 declaram) | Reunião vinculada à sessão correta por escolha explícita de cliente; campo de ID manual fica como plano B escondido | ⚠️ SATISFEITO COM RESSALVA | Verdades 1, 2, 3, 4 e 6 comprovadas no código. A garantia de encerramento só de reunião fora do ar (SC5) tem o defeito CR-02. Sem requisitos órfãos: `REQUIREMENTS.md` mapeia só TAQ-02 à Fase 8. |

Observação de documentação: `REQUIREMENTS.md` ainda mostra TAQ-02 como `[ ]` e "Pending". Isso deve ser virado para concluído só quando a fase fechar (depois do CR-02).

### Anti-padrões encontrados

| Arquivo | Linha | Padrão | Severidade | Impacto |
|---------|-------|--------|------------|---------|
| `taqciti/src/background/meetingTabNavigated.ts` | 36-37 | Duas regras para o mesmo conceito ("qual é a sala") divergiram | 🛑 Bloqueador | CR-02: encerra reunião ao vivo no formato `/meet/<código>` |
| `taqciti/src/features/agente/sendRetryPolicy.ts` | 13, 29-31 | Comentário desatualizado (diz que o reenvio fica desligado e que todo erro de banco é 500) | ℹ️ Info | IN-11; o flag está `true` e FK/UUID inválido já viram 404 |

Marcadores `TBD`/`FIXME`/`XXX`: nenhum encontrado nos 149 arquivos de código não-teste alterados na fase (varredura própria).

### Avisos que não bloqueiam (do 08-REVIEW.md, todos `open`, reconferidos no código quando tocam um critério)

| ID | Resumo | Relação com os critérios |
|----|--------|--------------------------|
| WR-01 | Rotas novas da extensão ficam abertas se `EXTENSION_SHARED_KEY` não estiver definida (`webhook.py:26-28`) | Risco T-08-10 aceito pelo time na B1 ("até o login do AGM"); exige conferir a variável antes do deploy |
| WR-02 | Apagar a reunião pelo histórico (`ui/history/delete`, `index.ts:228-235`) remove a associação sem pedir o encerramento | Toca o SC5 só no caso de a fila não estar vazia ou o envio ter falhado; no caminho normal a sessão já foi fechada no fim da reunião |
| WR-04, WR-05 | "Continuar envio" pode pular palavras do último segmento; reinício do service worker com vínculo ao vivo já com sessão deixa o envio parado sem saída | Casos de borda do envio; WR-05 não foi exercitado no UAT 19 (que segurou a criação da sessão, não o upload) |
| WR-03, WR-06, WR-07, WR-08, WR-09 | 401/403 descartam a fila; duplicado não atômico; edição não limpa campos; `taq:history` sem fila de escrita; seletor compacto em "Transcrição salva" | Qualidade/robustez; nenhum contradiz um critério do ROADMAP |

### Itens que dependem de decisão ou ação do time (fora do código)

1. **Deploy:** `GEMINI_API_KEY` ainda não existe no Railway (registrado como obrigatório em `08-DECISOES-PENDENTES.md`, B2). `EXTENSION_SHARED_KEY` também precisa estar ativa antes de expor as rotas (WR-01/T-08-10).
2. **DA-4 e DA-5** seguem como decisões do time registradas como abertas. O DA-4 é justamente o comportamento de `meetingTabNavigated.ts` que contém o CR-02: a decisão "navegar encerra" está no código como recomendada, "a confirmar com o time".

### Resumo das lacunas

A fase entrega o que prometia no fluxo principal. O vínculo é explícito e por reunião: nenhuma fala sai sem uma associação `linked` com sessão válida; o ID manual só aparece quando a lista falha; o descarte pede confirmação e não toca o backend; a fila durável reenvia com `chunk_id` idempotente e avisa na tela; o backend devolve 404 para sessão inexistente; os contratos B1/B2/B3 existem e os testes que rodei passam (147 no Taqciti, 66 no backend, typecheck limpo).

O que impede dar a fase como cumprida é o **CR-02**, um único defeito, reproduzido por mim com a função real: o endereço novo do Meet (`/meet/<código>`), que o próprio UAT mostrou ser o formato atual de todos os links, faz o service worker achar que a aba saiu da sala em qualquer mudança de URL, encerrando a reunião ao vivo e parando a captura sem aviso. Isso contradiz diretamente "uma reunião ao vivo nunca é encerrada" (SC5) e a promessa de enviar a fala da reunião (SC1). O UAT de 132 testes passou provavelmente porque a reescrita do endereço acontece na tela de pré-entrada, antes de a reunião ser detectada, e nenhum teste mudou a URL depois. A correção é pequena e já está descrita no review: uma função pura única `meetingCodeFromPath` usada pelo content script e pelo service worker, mais três casos de teste.

Depois do CR-02, rodar de novo a verificação para fechar a fase; os demais itens são warnings e decisões de deploy, não bloqueiam o objetivo.

---

_Verificado: 2026-10-26T23:30:00Z_
_Verificador: Claude (gsd-verifier)_
