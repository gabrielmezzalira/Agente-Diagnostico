# Fase 7 — Plano das 5 decisões em aberto do code review

**Data:** 2026-09-27 · **Branch:** `feat/fase-07-taqciti-config-background-streamer`
**Origem:** `07-REVIEW.md` (CR-01, WR-01, WR-02, WR-07, WR-11), pulados no `07-REVIEW-FIX.md` por serem decisão do time.

## Decisões tomadas (usuário, 2026-09-27)

| Achado | Decisão |
|--------|---------|
| CR-01 | **Esperar e avisar.** Reunião nova com o mesmo session_id: nada é enviado até a pessoa confirmar na tela ("Continuar enviando para esta sessão"). Trocar o session_id libera sozinho (hoje à mão; na Fase 8, pelo auto-detect). |
| WR-01 | **Fila ordenada + até 3 novas tentativas** (1 s, 2 s, 4 s) em erro de rede, 5xx e 429. 4xx não tenta de novo. Risco de duplicata aceito e registrado (backend sem idempotência). |
| WR-02 + WR-11 | **Reativo + persistir.** Toggle desligado descarta na hora (inclusive o que está na fila de reenvio); religado começa a contar a partir daquele instante. Cursor e falas pendentes ficam em `chrome.storage.session` e sobrevivem ao reinício do service worker. |
| WR-07 | **Status real de envio.** O service worker grava o resultado do último envio; a tela mostra "pronto para enviar", "último envio às …" ou o erro (ex.: 401 chave recusada). |

Detalhe escolhido pelo executor dentro da opção aprovada (reversível, sinalizado ao usuário): ao **confirmar** a reunião
nova no CR-01, o texto dessa reunião é enviado **desde o início dela**, não só a partir do clique — a pessoa confirmou que
a reunião pertence à sessão, então nada falado nela se perde.

---

## 1. O que muda (em linguagem comum)

Hoje o Taqciti manda a transcrição para o Agente como quem joga cartas numa caixa de correio sem olhar: se a caixa
estiver fechada (rede caiu, chave errada), a carta some e ninguém fica sabendo. E a tela continua dizendo "está sendo
enviada".

Depois desta mudança:

- **As cartas saem em fila, na ordem certa, e são reenviadas até 3 vezes** se a rede falhar (WR-01).
- **A tela passa a mostrar a verdade:** "último envio às 14:03:12" ou "último envio recusado: chave inválida (401)" (WR-07).
- **Desligar o botão para tudo na hora**, inclusive o que estava esperando para sair; **religar começa dali**, sem
  perder a primeira frase dita depois de religar (WR-11 / WR-02).
- **Se o Chrome reiniciar o "motor" da extensão no meio da reunião** (acontece sozinho no MV3), o Taqciti lembra onde
  parou e não perde a fala que estava esperando (WR-02).
- **Reunião nova com a mesma sessão do Agente:** em vez de travar em silêncio, a tela avisa "Reunião nova detectada" e
  oferece "Continuar enviando para esta sessão". Nada vai para a sessão errada sem a pessoa confirmar (CR-01).

## 2. Como vai ser alterado

Tudo dentro de `taqciti/src/`. Nenhum arquivo do backend muda (contrato `ExtensionChunk` intacto). Commits atômicos,
nesta ordem:

| # | Commit | Tipo | Arquivos |
|---|--------|------|----------|
| 0 | `docs(07)`: este plano | doc | `07-DECISOES-REVIEW.md` |
| 1 | `refactor(07)`: separa `createAgenteStreamer` da raiz de composição | **mecânico** (recortar/colar, sem mudança de comportamento) | `background/agenteStreamer.ts` → novo `background/agenteStreamerInstance.ts` |
| 2 | `fix(07): WR-01` fila ordenada + retry | comportamento | novo `features/agente/sendRetryPolicy.ts` (+test, puro), novo `background/agenteSender.ts` (+test), `agenteStreamerInstance.ts` |
| 3 | `fix(07): WR-11` toggle reativo | comportamento | `shared/config/agenteConfigStore.ts` (`onAgenteConfigChange`), `agenteStreamerInstance.ts` (dep opcional `onConfigChange`, tick e step alinhados), testes |
| 4 | `fix(07): WR-02` persistência + religar sem perder o 1º trecho | comportamento | novo `background/agenteStreamerSnapshot.ts`, `constants.ts` (chave `taq:agenteStreamer`), `agenteStreamerInstance.ts`, testes que fixavam a perda (`agenteStreamer.test.ts` "desligar…" e "reinício…") passam a exigir o envio |
| 5 | `fix(07): WR-07` status real de envio | comportamento + UI | novo `shared/config/agenteStatus.ts` (tipos + `describeAgenteStreaming` puro, +test), novo `shared/config/agenteStatusStore.ts`, novo `shared/hooks/useAgenteStreamingStatus.ts`, `constants.ts` (`taq:agenteStatus`), `agenteSender.ts` reporta, `AgenteConfigScreen.tsx` (+test) |
| 6 | `fix(07): CR-01` esperar e avisar | comportamento + UI | `features/agente/wordDelta.ts` (`waitingForNewMeeting`, `confirmedMeetingId`), `agenteConfig.ts` (campo `confirmedMeetingId`), `agenteStreamerInstance.ts` (reporta espera), `AgenteConfigScreen.tsx` (aviso + botão), testes |
| 7 | `docs(07)`: atualiza REVIEW-FIX + disposição | doc | `07-REVIEW-FIX.md`, `07-REVIEW-DISPOSITION.md` |

**Execução (2026-09-27):** feito na ordem acima. Para manter `agenteStreamerInstance.ts` perto de ~200 linhas,
entraram três refactors mecânicos extras, cada um em commit próprio e sem mudar teste nenhum: `51a6902` (timer
da janela), `6139853` (deps em arquivo próprio, `buildPhraseRequests`, `restoreOnce`) e `2ef854b`
(`agenteStatusReporter`). Commits de correção: WR-01 `1a5c10a`, WR-11 `6814865`, WR-02 `634f541`,
WR-07 `a73349d`, CR-01 `c17cefb`. Resultado: 517/517 testes (eram 480), typecheck e build ok.
Arquivo final: `agenteStreamerInstance.ts` com 216 linhas.

## 3. Riscos de cada ação

| # | Risco concreto |
|---|----------------|
| 1 | Um import quebrado ou um export esquecido faz o `sessionController` ou os testes não acharem `onSessionFlushed`/`configureAgenteStreamer`. |
| 2 | (a) Retry depois de timeout em que o backend já gravou → **trecho duplicado** na transcrição. (b) Backend fora por muito tempo → fila cresce sem limite na memória do service worker. (c) Reenviar depois de desligar o toggle violaria D-09. |
| 3 | Listener de `onChanged` registrado duas vezes ou não removido no `dispose` → descarte/prime duplicado; registrar no import criaria efeito colateral de import (hoje proibido pelo comentário do módulo). |
| 4 | (a) Snapshot antigo restaurado depois de um período desligado → reenviar palavras faladas com o toggle desligado. (b) Gravar em `chrome.storage.session` a cada flush dobra as escritas. (c) Os testes antigos que fixavam a perda precisam mudar — risco de afrouxar uma asserção sem querer. |
| 5 | (a) Status desatualizado (erro 401 continua na tela depois de corrigir a chave). (b) Dois escritores (sender e streamer) no mesmo registro → um apaga o campo do outro. (c) Texto da tela muda — pode confundir quem já usou. |
| 6 | (a) Confirmar a reunião errada manda a reunião inteira para a sessão errada. (b) Campo novo na config pode quebrar a normalização de configs antigas salvas. (c) Rajada grande se a pessoa confirmar muito tempo depois. |

## 4. Como prevenir

| # | Prevenção |
|---|-----------|
| 1 | `tsc --noEmit` + suíte completa **antes e depois**; mesmo número de testes, todos verdes, nenhum teste alterado neste commit. |
| 2 | (a) Retry só em erro de rede, 5xx e 429; risco registrado em memória do projeto para diagnóstico futuro. (b) Teto de 50 envios na fila; acima disso descarta o mais antigo e registra `failed`. (c) `cancelAll()` chamado no descarte (toggle desligado/`dispose`): toda tentativa checa a "geração" antes de enviar. Teste dedicado. |
| 3 | Assinatura preguiçosa (só no primeiro passo), guardada em flag, removida no `dispose`. Teste de toggle via storage real (mock com `onChanged` de verdade). |
| 4 | (a) No primeiro passo do service worker o snapshot é lido e, se o streaming estiver desligado, é **apagado** na hora. (b) Só grava quando o streaming está ligado ou quando precisa limpar (custo zero desligado, D-09). (c) Mudança nos testes restrita às asserções que fixavam a perda, com comentário explicando; nenhuma outra asserção afrouxada. |
| 5 | (a) Toda mudança de config zera o resultado do último envio. (b) Fila de patch serializada no store (mesmo padrão do `agenteConfigStore`). (c) Textos revisados, mesmos tons de cor já usados na tela. |
| 6 | (a) O aviso mostra o que vai acontecer e a alternativa (salvar o ID novo). (b) `normalizeAgenteConfig` trata ausência como `''`, com teste de config antiga. (c) Cada segmento vira uma fala separada, então a rajada é de vários POSTs pequenos, na fila ordenada. |

## 5. Como consertar (rollback)

Cada commit é reversível sozinho, **na ordem inversa** (6 → 1), porque 6 depende do canal de status do 5, e 4 depende
do 3:

- CR-01: `git revert <commit 6>` — volta a esperar em silêncio. Um `confirmedMeetingId` já salvo fica no storage sem ninguém ler, e some no próximo salvar (`normalizeAgenteConfig` só devolve os campos conhecidos). Inofensivo.
- WR-07: `git revert <commit 5>` — volta o texto antigo; a chave `taq:agenteStatus` some sozinha quando o navegador fecha (é `storage.session`).
- WR-02: `git revert <commit 4>` — volta a perder a fala no reinício; `taq:agenteStreamer` idem, some ao fechar o navegador.
- WR-11: `git revert <commit 3>`.
- WR-01: `git revert <commit 2>` — volta o envio fire-and-forget.
- Refactor: `git revert <commit 1>`.

Depois de qualquer revert: `npx tsc --noEmit && npx vitest run` em `taqciti/` e recarregar a extensão em `chrome://extensions`.
Nada disso toca backend nem banco — nenhum dado persistente a restaurar.

## 6. Decisões que são do usuário/time

Todas as 5 decisões deste plano **foram tomadas pelo usuário em 2026-09-27** (tabela no topo). Continuam **fora** deste plano,
de propósito:

- **Idempotência no backend** (id de trecho para evitar duplicata do retry) — muda o contrato do webhook. Só se aparecerem duplicatas na prática.
- **Auto-detect do session_id** — é a Fase 8 (TAQ-02), não entra nesta branch.
- Achados informativos IN-01…IN-11 — fora do escopo desta rodada.

## 7. Verificação (ponta a ponta)

Automática (em `taqciti/`): `npx tsc --noEmit` e `npx vitest run` verdes, com testes novos semeando cada achado:

- WR-01: 503 duas vezes e depois 202 → 1 trecho entregue, na ordem, após 1 s + 2 s; 401 → nenhuma nova tentativa; toggle desligado durante o retry → nada mais é enviado.
- WR-11: desligar e religar pela config real dentro da janela → a fala pendente **não** sai.
- WR-02: religar e falar "e agora" → "e agora" é enviado; reinício do service worker com fala pendente → a fala sai depois do reinício.
- WR-07: `describeAgenteStreaming` para cada estado; a tela mostra o erro 401 depois de um envio recusado.
- CR-01: reunião nova com o mesmo session_id → nada enviado + status de espera; confirmar → a reunião nova é enviada desde o início; trocar o session_id → sai sozinho da espera.

Manual (UAT, sugerido depois): com o backend local, ligar o streaming numa reunião do Meet, (1) derrubar o backend e
ver o erro na tela e o reenvio quando ele volta; (2) colocar uma chave errada e ver "401"; (3) sair e voltar para a sala
depois de 10 min e ver o aviso de reunião nova.
