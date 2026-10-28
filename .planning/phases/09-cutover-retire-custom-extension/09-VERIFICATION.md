---
phase: 09-cutover-retire-custom-extension
verified: 2026-10-28T18:00:00Z
status: passed
score: 5/5 must-haves verified (SC1 emendado; ver "Resolução humana")
covered_files:
  - .planning/phases/09-cutover-retire-custom-extension/09-01-PLAN.md
  - .planning/phases/09-cutover-retire-custom-extension/09-01-SUMMARY.md
  - .planning/phases/09-cutover-retire-custom-extension/09-02-PLAN.md
  - .planning/phases/09-cutover-retire-custom-extension/09-02-SUMMARY.md
  - .planning/phases/09-cutover-retire-custom-extension/09-03-PLAN.md
  - .planning/phases/09-cutover-retire-custom-extension/09-03-SUMMARY.md
  - .planning/phases/09-cutover-retire-custom-extension/09-04-PLAN.md
  - .planning/phases/09-cutover-retire-custom-extension/09-04-SUMMARY.md
  - .planning/phases/09-cutover-retire-custom-extension/09-05-PLAN.md
  - .planning/phases/09-cutover-retire-custom-extension/09-05-SUMMARY.md
  - .planning/phases/09-cutover-retire-custom-extension/09-06-PLAN.md
  - .planning/phases/09-cutover-retire-custom-extension/09-06-SUMMARY.md
  - .planning/phases/09-cutover-retire-custom-extension/09-07-PLAN.md
  - .planning/phases/09-cutover-retire-custom-extension/09-07-SUMMARY.md
  - backend/app/routers/webhook.py
  - backend/tests/test_extension_chunk_extra_fields.py
  - frontend/src/lib/taqcitiInstall.ts
  - frontend/src/pages/ExtensionPage.tsx
covered_digest: "v4:sha256:f2f59901cf0a4f10ea4bd011851da1df8e5c6f817ae48a75d937455a3828c5e4"
behavior_unverified: 1
overrides_applied: 1
overrides:
  - must_have: "SC1 (parte do relatório final): a sessão de discovery completa gera o relatório final usando só a Taqciti"
    reason: "Mudança de produto: o time não gera mais PRD a partir de reuniões (virá um sistema de fluxos por sessão, depois). Teste 5 do 09-UAT.md foi dispensado por isso, não por falha."
    accepted_by: "usuário, confirmado ao fechar a fase (resposta 'Emendar o SC1 e fechar agora' em 2026-10-28; decisão também registrada em 09-UAT.md, teste 5)"
    accepted_at: "2026-10-28T15:00:00Z"
behavior_unverified_items:
  - truth: "SC1 (parte da cobertura e das perguntas): uma sessão alimentada só pela Taqciti produz coverage_snapshots e perguntas das lentes produto e dados"
    test: "Com uma chave Gemini com crédito, fazer uma reunião curta com a Taqciti (cliente ZZ-TESTE-...) e conferir no banco coverage_snapshots >= 1 e perguntas com lens='produto' e lens='dados' (SQL do teste 4 do 09-UAT.md)"
    expected: "snapshots >= 1; linhas para as duas lentes"
    why_human: "Nesta prova o Gemini devolveu 402 em todas as chamadas, então a sessão ficou com 0 snapshots/0 perguntas. O código de ingestão está ligado ao mesmo pipeline (webhook.py:59-62), mas nenhum teste nem execução observou cobertura/perguntas a partir de uma sessão da Taqciti."
human_verification:
  - test: "Repetir a conferência de cobertura e perguntas por lente (teste 4 do 09-UAT.md) com chave do Gemini com crédito"
    expected: "coverage_snapshots >= 1 e perguntas com lens='produto' e 'dados' na sessão da Taqciti"
    why_human: "Depende de reunião real no Meet, de crédito do Gemini e de pessoa; foi dispensada pelo time (402), nunca aprovada por evidência."
  - test: "Decidir se o texto literal do SC1 no ROADMAP.md (\"coverage updates, questions, and final report\") deve ser emendado para refletir a dispensa (PRD fora do produto; cobertura/perguntas validadas nas Fases 3-5 e 8) ou se a fase só fecha depois do teste 4 repetido"
    expected: "Decisão registrada (emendar SC1 / aceitar override / exigir repetição do teste 4)"
    why_human: "É decisão de escopo do time; o verificador não pode reescrever o contrato do roadmap nem aceitar sozinho a ausência de prova."
---

# Phase 9: Cutover + Retire Custom Extension — Relatório de Verificação

**Objetivo da fase:** Taqciti é a única fonte de transcrição em produção; a extensão customizada é removida enquanto o contrato do backend que ela usava permanece intacto para dados históricos.
**Verificado em:** 2026-10-28 (branch `feat/fase-09-cutover-retire-custom-extension`, tip `f9107fa`)
**Status:** passed (era `human_needed` na verificação automática; ver "Resolução humana" logo abaixo)
**Re-verificação:** Não — verificação inicial

## Resolução humana (2026-10-28)

A verificação automática devolveu `human_needed` por causa do SC1. O usuário decidiu, ao ser perguntado, **emendar o SC1 e fechar a fase agora** (opção "Emendar o SC1 e fechar agora"). Consequências registradas:

- O SC1 do `ROADMAP.md` perdeu "final report" (o produto não gera mais PRD a partir de reuniões). O override do relatório fica confirmado pelo usuário.
- **Continua sem prova, e não deve ser lido como aprovado:** cobertura (`coverage_snapshots`) e perguntas das lentes produto e dados a partir de uma sessão da Taqciti. O Gemini devolveu 402 na prova. É a ressalva `behavior_unverified` acima, tratada como **conferência manual pendente** (item M1 de `.planning/TESTES-MANUAIS-POS-FASE-10.md`, a fazer com chave do Gemini com crédito). O status `passed` desta fase não a cobre.
- Bookkeeping fechado junto: planos 09-03 a 09-07 marcados no ROADMAP, fase 9 `7/7 Complete`, TAQ-04 `Complete` no REQUIREMENTS.md.
- A revisão de código (`09-REVIEW.md`) ficou com 0 bloqueantes e 2 avisos (WR-01, WR-02), tratados como follow-up fora da fase.

Postura adversarial: partimos de "tarefas feitas, objetivo não atingido". SC2 e SC3 caíram por evidência direta no código e no git. SC1 só caiu em parte; o resto fica como item humano, não como aprovado.

## Atingimento do objetivo

### Verdades observáveis

O SC1 do ROADMAP foi dividido em três verdades porque as partes têm evidências muito diferentes.

| # | Verdade | Status | Evidência |
|---|---------|--------|-----------|
| 1a | SC1 (transcrição + fim da sessão): uma reunião real só com a Taqciti entrega a transcrição ao backend e encerra a sessão | VERIFICADO | 09-UAT.md teste 3 (sessão `5e67b872-b5c1-4751-91bf-7d7157b15b9c`): `source='extension'`, `mode='discovery'`, 13 falas, `com_chunk_id=13` (a extensão antiga nunca mandava `chunk_id`, então só a Taqciti transmitiu), backend local com 13x `POST /webhook/extension 202`. Teste 6: `status='finished'` via `POST /webhook/extension/sessions/<id>/finish 200`. Código que sustenta: `backend/app/routers/webhook.py:33-64` (grava chunk com `chunk_id`, idempotente, empurra para `pipeline_manager`). Ressalva: `finished_at` ficou 6min41s após a última fala (o banco não separa "pessoa parada" de "atraso"). A evidência é registro do UAT (SQL somente leitura rodado pelo orquestrador); o verificador não reexecutou a consulta. |
| 1b | SC1 (cobertura e perguntas): a mesma sessão produz atualizações de cobertura e perguntas (lentes produto e dados) | PRESENT_BEHAVIOR_UNVERIFIED | Teste 4 do UAT: `snapshots=0, red_flags=0, perguntas=0` na sessão da prova. Causa registrada: Gemini `402 RESOURCE_EXHAUSTED` em 28 chamadas (14 em `generate_questions`), externa à Taqciti. Dispensado pelo time em 2026-10-28, NÃO aprovado por evidência. O ramo de código está ligado (`webhook.py:59-62` chama `pipeline_manager.push_chunk`, o mesmo caminho da extensão antiga), mas isso é presença e fiação, não comportamento observado. Nada em 09-03 comprova o resultado. |
| 1c | SC1 (relatório final): a sessão completa gera o relatório final | APROVADO (override) | Teste 5 dispensado por mudança de produto (o time não gera mais PRD; `reports=0` na sessão). Override registrado no frontmatter com base na decisão do usuário no UAT. Veja a ressalva em "Lacunas e riscos": o texto do ROADMAP continua pedindo "final report". |
| 2 | SC2: `extension/` e o zip empacotado saem do repositório | VERIFICADO | `git ls-files extension` = 0 linhas; `ls extension` = inexistente; nenhum `.zip` rastreado na raiz (`git ls-files \| grep -i '\.zip$'` vazio). Commit `818832d` (remove `agente-diagnostico-extension-v1.0.0.zip`, 1 arquivo) e `2821e7b` (12 arquivos, 1518 deleções em `extension/`). Varredura de resíduos fora de `.planning`: só um comentário em `backend/tests/test_extension_chunk_extra_fields.py:113` dizendo que a pasta foi removida e um import legítimo `components/extension/StepList` do frontend. Os `.zip` que sobram em `taqciti/` são da própria Taqciti (`taqciti-vX.X.X.zip`), outro produto. |
| 3 | SC3: `/webhook/extension`, `ExtensionChunk` e o valor `extension` do enum `source` continuam no backend | VERIFICADO | `backend/app/routers/webhook.py:16-20` (`class ExtensionChunk`), `:33` (`@router.post("/extension", status_code=202)`) com `verify_extension_key`; `backend/app/main.py:80` (`include_router(webhook_router)`); `backend/app/models/projects.py:9` (`TranscriptSource = Literal["extension", "recall"]`, default `"extension"`). Teste executado por este verificador: `cd backend && python -m pytest tests/test_extension_chunk_extra_fields.py -q -k sc3` = `4 passed, 3 deselected in 1.17s` (rota registrada com 202 e gate; OpenAPI com `ExtensionChunk` e `chunk_id`; enum aceita `extension`; sessão histórica `source="extension"` resolve em `SessionResponse`). |

**Pontuação:** 4/5 verdades verificadas (1 presente e ligada, comportamento não exercitado). Contagem: 1a, 1c (override), 2 e 3.

### Artefatos obrigatórios

| Artefato | Esperado | Status | Detalhes |
|----------|----------|--------|----------|
| `backend/app/routers/webhook.py` | Rota `/webhook/extension` e `ExtensionChunk` | VERIFICADO | Existe, substantivo, registrado em `main.py:80`, dados fluem para `transcript_chunks` e `pipeline_manager`. |
| `backend/tests/test_extension_chunk_extra_fields.py` | 4 testes `test_sc3_*` | VERIFICADO | 4 passam. |
| `frontend/src/pages/ExtensionPage.tsx` + `lib/taqcitiInstall.ts` + `StepList.tsx` | Página `/extension` que instala a Taqciti | VERIFICADO | Reescrita (72 linhas); teste `taqcitiInstall.test.ts` garante que não cita zip antigo/`.zip`/`v1.0.0`. Sem link de download por decisão do usuário (`TAQCITI_RELEASES_URL = null`, mostrado na tela). Não é falha. |
| `09-UAT.md` | Evidência SC1 + `gate_d02` | VERIFICADO | `gate_d02: aprovado`, `status: complete`. A aprovação foi dada com a resposta "task 1 OK" (o plano pedia a palavra "aprovado"), registrado no 09-03-SUMMARY. |
| `extension/` e zip | Ausentes | AUSENTES, como esperado | Ver verdade 2. |

### Verificação de ligações-chave

| De | Para | Via | Status | Detalhes |
|----|------|-----|--------|----------|
| `09-UAT.md` (`gate_d02: aprovado`) | 09-05 (remoção) | Gate D-02 | LIGADO | Commits do gate `f2beb99` antecedem `818832d`/`2821e7b` na história. |
| `webhook.py` | `pipeline_manager.push_chunk` | `asyncio.create_task` | LIGADO | `webhook.py:59-62`. |
| `webhook.py` | `TranscriptChunksRepository.insert_chunk` | `chunk_id` idempotente | LIGADO | `webhook.py:44-56`. |
| `main.py` | `webhook_router` | `include_router` | LIGADO | `main.py:80`. |

### Cobertura de requisitos

| Requisito | Plano de origem | Descrição | Status | Evidência |
|-----------|-----------------|-----------|--------|-----------|
| TAQ-04 | 09-01..09-07 | A extensão customizada antiga é retirada depois que a Taqciti é validada (cutover) | PARCIAL (aguarda decisão humana) | Retirada: verificada (SC2, SC3). "Taqciti validada": transcrição e encerramento provados em reunião real; cobertura/perguntas não observadas (402). REQUIREMENTS.md ainda marca `[ ]` / `Pending`: o orquestrador atualiza depois da decisão. |

Requisitos órfãos: nenhum (TAQ-04 é o único mapeado para a Fase 9).

### Anti-padrões

| Arquivo | Linha | Padrão | Severidade | Impacto |
|---------|-------|--------|------------|---------|
| arquivos de código tocados pela fase (webhook.py, testes, ExtensionPage, taqcitiInstall, StepList, labels.ts, wordDelta.ts, agenteConfig.ts) | — | `TBD`/`FIXME`/`XXX` | nenhum | Varredura sem marcadores de dívida (as únicas ocorrências de "XXX" estão em `CLAUDE.md` como máscara de preço `$X.XXX`). |
| `.planning/ROADMAP.md` | 330-355 | Bookkeeping desatualizado ("2/7 plans executed"; 09-03..09-07 sem `[x]`) | Aviso | Não afeta o código; deve ser acertado pelo orquestrador ao fechar a fase. |

### Verificações comportamentais

| Comportamento | Comando | Resultado | Status |
|---------------|---------|-----------|--------|
| Contrato SC3 do webhook/enum/sessão histórica | `cd backend && python -m pytest tests/test_extension_chunk_extra_fields.py -q -k sc3` | `4 passed, 3 deselected in 1.17s` | PASSA |
| `extension/` ausente do índice do git | `git ls-files extension \| wc -l` | `0` | PASSA |
| Nenhum zip rastreado | `git ls-files \| grep -i '\.zip$'` | vazio | PASSA |
| Resíduos de `extension/` e do zip fora de `.planning` | `git grep -E "extension/\|agente-diagnostico-extension"` filtrando `webhook/extension` | 2 linhas inofensivas (comentário e import do `StepList`) | PASSA |
| Suítes completas (backend/frontend/taqciti) | não reexecutadas | máquina com pouca memória; números vêm do 09-05-SUMMARY (backend 279 passed/4 skipped; frontend 24; taqciti 1434) | NÃO VERIFICADO por este verificador |

### Execução de probes

Nenhum probe declarado nos planos (`probe-*.sh`). Etapa não aplicável.

### Verificação humana necessária

#### 1. Cobertura e perguntas por lente a partir de uma sessão da Taqciti

**Teste:** Com uma chave Gemini com crédito, fazer uma reunião curta com a Taqciti (cliente `ZZ-TESTE-...`), puxando assuntos de Produto e de Dados, e rodar o SQL do teste 4 do `09-UAT.md`.
**Esperado:** `snapshots >= 1` e perguntas com `lens='produto'` e `lens='dados'`.
**Por que humano:** Depende de reunião real, de crédito do Gemini e de pessoa. Foi dispensado pelo time (402), nunca aprovado por evidência.

#### 2. Decisão do time sobre o texto do SC1

**Teste:** Escolher entre (a) emendar o SC1 do ROADMAP para tirar "final report" e aceitar a dispensa do teste 4 com o backstop das Fases 3-5 e 8, ou (b) manter o SC1 e só fechar a fase depois do teste 4 repetido.
**Esperado:** Decisão registrada; se (a), o ROADMAP é emendado e esta verificação passa para `passed` (override formal); se (b), repetir o teste 4.
**Por que humano:** Mexe no contrato do roadmap e em aceitar ausência de prova; não é do verificador.

### Resumo das lacunas e riscos

Não há lacuna de implementação: SC2 e SC3 estão provados no repositório. O que impede `passed` é o SC1, cujo texto literal exige "coverage updates, questions, and final report" e não foi observado de ponta a ponta só com a Taqciti:

- Cobertura e perguntas: 0 snapshots/0 perguntas na sessão da prova (Gemini 402, causa externa). Dispensado pelo time, o próprio UAT deixa a repetição como pendência. A dispensa registra uma decisão, não uma prova. Por isso o status é `human_needed` e não `passed`. Não é `gaps_found` porque nada observável contradiz o objetivo: o caminho de ingestão e o pipeline são os mesmos, e o bloqueio foi externo. O ponto é que o código está ligado, mas o comportamento nunca foi visto.
- Relatório: fora do produto por decisão do time (override registrado). O ROADMAP não foi atualizado e continua prometendo "final report".
- Aprovação do `gate_d02` foi dada por "task 1 OK" em vez da palavra "aprovado"; o 09-03-SUMMARY registra isso. O truth `backstop` do plano 09-03 (TAQ-04 só vale com aprovação explícita do time) tem a aprovação, mas ela cobre uma prova com 4 e 5 dispensados; isso é o que os itens humanos acima fecham.
- Rota `/webhook/extension*` sem chave quando `EXTENSION_SHARED_KEY` vazia (WR-01 / T-09-02): risco aceito por D-08, aberto, não é da fase.

Itens fora do repositório e fora da fase, ainda pendentes: deploy, `GEMINI_API_KEY` no Railway, release da Taqciti, apagar a release v1.0.0 no GitHub e limpeza do `ZZ-TESTE-D20` (ver "Depois do deploy" do UAT). Lint do frontend com 7 problemas é pré-existente (idêntico antes e depois, 09-04/09-05 SUMMARY), não é regressão. A página `/extension` sem link de download é decisão do usuário.

Sugestão de overrides já aplicada no frontmatter só para a parte do relatório; a parte de cobertura/perguntas não recebe override porque a própria equipe a deixou como pendência a repetir.

---

_Verificado: 2026-10-28_
_Verificador: Claude (gsd-verifier)_
