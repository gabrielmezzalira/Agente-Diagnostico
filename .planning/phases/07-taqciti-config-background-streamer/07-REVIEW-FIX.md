---
phase: 07-taqciti-config-background-streamer
fixed_at: 2026-09-27T14:00:25Z
review_path: .planning/phases/07-taqciti-config-background-streamer/07-REVIEW.md
iteration: 1
findings_in_scope: 13
fixed: 13
skipped: 0
status: all_fixed
---

# Fase 7: Relatório de Correção de Code Review

**Corrigido em:** 2026-09-27
**Revisão de origem:** `.planning/phases/07-taqciti-config-background-streamer/07-REVIEW.md`
**Iteração:** 1

**Resumo:**
- Achados no escopo (Critical + Warning): 13
- Corrigidos: 13 (8 na 1ª rodada + 5 na 2ª, depois das decisões do usuário em 2026-09-27)
- Pulados: 0

Todas as correções rodaram numa worktree isolada (`.claude/worktrees/rf-07-4871-1790515596`,
branch temporária `gsd-reviewfix/07-4871`), com `npm ci` local e a suíte completa de testes
(`vitest`) mais `tsc --noEmit` verificados a cada commit. Ao final, a branch temporária foi
avançada por fast-forward sobre `feat/fase-07-taqciti-config-background-streamer` e removida — ver
seção "Verificação" abaixo para os números finais.

## Fixed Issues

### WR-03: A fila de patches fica envenenada para sempre depois de uma única falha de escrita

**Arquivos modificados:** `taqciti/src/shared/config/agenteConfigStore.ts`, `taqciti/src/shared/config/agenteConfigStore.test.ts`
**Commit:** `aee15a6`
**O que foi feito:** `patchAgenteConfig` agora encadeia com `queue.catch(() => undefined).then(...)`
em vez de `queue.then(...)` direto — uma rejeição de `writeLocal` (quota, contexto invalidado) não
deixa mais a fila presa numa promessa rejeitada para sempre. Adicionado teste cobrindo uma falha de
escrita seguida de um patch bem-sucedido.

### WR-04: Erros de gravação não são tratados na tela: rejeição sem tratamento e nenhum retorno para a pessoa

**Arquivos modificados:** `taqciti/src/shared/hooks/useAgenteConfigForm.ts`,
`taqciti/src/sidepanel/screens/AgenteConfigScreen.tsx`, `taqciti/src/sidepanel/screens/AgenteConfigScreen.test.tsx`
**Commit:** `5857d69`
**O que foi feito:** O hook agora expõe `error: string | null`, com `catch` em `save()` e em
`setStreamingEnabled`. A tela mostra a mensagem num `<p aria-live="assertive">` separado do status de
prontidão. Adicionados dois testes (falha ao salvar, falha ao alternar o toggle).

### WR-05: `save()` manda o objeto inteiro, contrariando o contrato do store, grava o padrão da build no storage e descarta o que foi digitado durante o salvamento

**Arquivos modificados:** `taqciti/src/shared/hooks/useAgenteConfigForm.ts`,
`taqciti/src/sidepanel/screens/AgenteConfigScreen.tsx`, `taqciti/src/sidepanel/screens/AgenteConfigScreen.test.tsx`
**Commit:** `110fd77`
**O que foi feito:** `save()` agora monta o patch só com os campos marcados como editados
(`editedRef`), evitando a corrida com um auto-detect futuro (Fase 8) e a gravação do padrão da build
no primeiro "Salvar". Os três campos de texto ficam `disabled` enquanto `saving` é verdadeiro.
Adicionado teste com spy em `patchAgenteConfig` provando que só o campo editado é enviado.

### WR-06: A chave `x-agente-key` pode ir em texto puro por `http://` para qualquer host, e digitar "localhost:8000" vira https e quebra o dev local

**Arquivos modificados:** `taqciti/src/shared/config/agenteConfig.ts`,
`taqciti/src/shared/config/agenteConfig.test.ts`, `taqciti/src/background/agenteStreamer.test.ts`
**Commit:** `6dfb1c6`
**O que foi feito:** `isValidAgenteBackendUrl` só aceita `http:` para host de loopback
(`localhost`/`127.0.0.1`/`[::1]`) — qualquer outro host com `http:` vira `invalid-url`, e o streamer
não envia (a chave e a transcrição não trafegam sem TLS). `normalizeAgenteBackendUrl` agora prefixa
`http://` (não `https://`) quando o host digitado sem protocolo é loopback, corrigindo o caso comum de
dev local. Ajustado o fixture `AGENTE_URL` de `agenteStreamer.test.ts` de `http://agente.test` para
`https://agente.test`, já que o protocolo em si não era o que aqueles testes exercitavam.

### WR-08: Se a primeira leitura falhar, `createAgenteConfigReader` guarda a promessa rejeitada e o streamer para até a config mudar

**Arquivos modificados:** `taqciti/src/shared/config/agenteConfigStore.ts`,
`taqciti/src/shared/config/agenteConfigStore.test.ts`
**Commit:** `41e0a3b`
**O que foi feito:** `createAgenteConfigReader` agora zera `cached` quando `loadAgenteConfig()`
rejeita, permitindo que a próxima chamada tente de novo, em vez de repetir a mesma rejeição para
sempre. Um flag `listening` separado garante que o listener de `onChanged` não seja registrado duas
vezes entre tentativas. Adicionados dois testes (recuperação após falha; listener não duplica).

### WR-10: Testes da janela por fala que passam por construção: o "drain" é um passo real com efeito colateral

**Arquivos modificados:** `taqciti/src/background/agenteStreamer.ts`, `taqciti/src/background/agenteStreamer.test.ts`
**Commit:** `83cf2a3`
**O que foi feito:** Exposto um observador sem efeito colateral (`whenIdle` na instância,
`whenAgenteStreamerIdle` no módulo) que só espera a fila serializada terminar, sem enfileirar nenhum
passo novo. Os testes de "fim" e "pausa" trocaram a chamada manual e redundante de
`onSessionFlushed` por esse observador, provando de fato que `flushState` (sessionController.ts)
aciona o streamer. O teste "não bloqueante em erro de rede" agora afirma que `send` foi chamado (antes
nenhum `expect` provava que o envio realmente aconteceu). O teste "cadência local intacta" agora
configura o streaming (antes rodava com streaming desligado, o que tornava a asserção de ausência
trivial) e prova que a cadência de 250ms é independente da janela do Agente de 1500ms.
**Não alterado:** o teste de "toggle com fala pendente" (linha ~797) continua chamando
`onSessionFlushed` manualmente — o comportamento correto ao religar depende da decisão de time
registrada em WR-02/WR-11 (ver seção de achados pulados).

### WR-12: Se o `loadConfig` falhar no tick, a fala pendente fica sem timer e só sai quando alguém voltar a falar

**Arquivos modificados:** `taqciti/src/background/agenteStreamer.ts`, `taqciti/src/background/agenteStreamer.test.ts`
**Commit:** `adc8a7f`
**O que foi feito:** Um `finally` em `tick()` garante que, depois de qualquer tentativa (sucesso ou
falha), um buffer não vazio sempre tenha um timer armado — com atraso mínimo de 1s (`RETRY_MIN_MS`)
para não virar laço apertado se a falha se repetir. Adicionado teste com `loadConfig` falhando uma vez
(3ª chamada) e confirmando que o retry manda a fala depois.

### WR-13: `dispose()` não é terminal: um passo já enfileirado na instância antiga rearma timer e envia com as deps antigas

**Arquivos modificados:** `taqciti/src/background/agenteStreamer.ts`, `taqciti/src/background/agenteStreamer.test.ts`
**Commit:** `6213569`
**O que foi feito:** Um flag `disposed` marca a instância como descartada; `step`, `tick` e `rearm`
passam a virar no-op depois do `dispose()`, em vez de continuar rearmando timer ou enviando com o
`deps` da instância antiga. Adicionado teste que deixa um passo preso esperando `loadConfig()`,
descarta a instância no meio, resolve o `loadConfig` depois — e confirma que nada é enviado e nenhum
timer órfão dispara depois. **Validação da força do teste:** removi os três guards temporariamente e
confirmei que o teste falha (captura a regressão de verdade) antes de restaurar o fix.

### CR-01: Reunião nova com o mesmo session_id trava o streaming em silêncio, enquanto a UI diz "Ligado"

**Arquivos modificados:** `taqciti/src/features/agente/wordDelta.ts`, `taqciti/src/shared/config/agenteConfig.ts`, `taqciti/src/shared/config/agenteStatus.ts`, `taqciti/src/shared/hooks/useAgenteStreamingStatus.ts`, `taqciti/src/sidepanel/screens/AgenteConfigScreen.tsx`, `taqciti/src/background/agenteStreamerInstance.ts` (+ testes)
**Commit:** `c17cefb` (2ª rodada, decisão do usuário em 2026-09-27: "esperar e avisar")
**O que foi feito:** a espera deixou de ser silenciosa. `planStreamStep` sinaliza `waitingForNewMeeting`, o streamer grava `waitingMeetingId` no status de runtime, e a tela mostra "Reunião nova detectada — nada está sendo enviado" com o botão "Continuar enviando para esta sessão" (grava `confirmedMeetingId` na config). Confirmada, a reunião nova sai desde o início dela, na hora. Trocar o session_id libera sozinho. Com o WR-02, a espera sobrevive ao reinício do service worker.

### WR-01: O cursor avança antes do envio ser confirmado: falha de rede perde palavras de vez (agora até 5 s de fala), e a ordem de chegada não é garantida

**Arquivos modificados:** `taqciti/src/features/agente/sendRetryPolicy.ts` (novo), `taqciti/src/background/agenteSender.ts` (novo), `taqciti/src/background/agenteStreamerInstance.ts` (+ testes)
**Commit:** `1a5c10a` (2ª rodada, decisão: "fila + 3 tentativas")
**O que foi feito:** fila de envio ordenada; erro de rede, 5xx e 429 são reenviados após 1 s, 2 s e 4 s; 4xx é definitivo; teto de 50 trechos; desligar o streaming cancela a fila e o retry em andamento (D-09). **Risco aceito:** o webhook não tem idempotência, então um timeout depois de o backend já ter gravado pode duplicar o trecho (documentado em `sendRetryPolicy.ts`).

### WR-02: Depois de reiniciar o service worker ou religar o toggle, palavras são descartadas (agora também tudo o que estava pendente na janela)

**Arquivos modificados:** `taqciti/src/background/agenteStreamerSnapshot.ts` (novo), `taqciti/src/background/agenteStreamerInstance.ts`, `taqciti/src/background/agenteStreamer.ts`, `taqciti/src/background/index.ts`, `taqciti/src/shared/config/constants.ts` (+ testes)
**Commit:** `634f541` (2ª rodada, decisão: "reativo + persistir")
**O que foi feito:** cursor e falas pendentes vão para `chrome.storage.session` (`taq:agenteStreamer`) e são restaurados no boot do service worker; religar o toggle ancora o cursor no instante do religar. Os dois testes que fixavam a perda agora exigem o envio ("e agora", "e mais isso"). Desligado, o snapshot é apagado uma vez e nada é gravado por flush.

### WR-07: O status "Ligado — está sendo enviada" não reflete a entrega real (401, 404 e erros de rede ficam invisíveis)

**Arquivos modificados:** `taqciti/src/shared/config/agenteStatus.ts` (novo), `taqciti/src/shared/config/agenteStatusStore.ts` (novo), `taqciti/src/shared/hooks/useAgenteStreamingStatus.ts` (novo), `taqciti/src/sidepanel/screens/AgenteConfigScreen.tsx`, `taqciti/src/background/agenteSender.ts` (+ testes)
**Commit:** `a73349d` (2ª rodada, decisão: "status real de envio")
**O que foi feito:** a fila de envio reporta cada tentativa; o service worker grava em `taq:agenteStatus` (só metadados) e a tela mostra "pronto para enviar", "último envio às HH:MM:SS", "tentando de novo…" ou o erro (ex.: "a chave de autenticação não foi aceita (HTTP 401)"). Mudar a config zera o resultado anterior.

### WR-11: Desligar e religar o toggle dentro da janela envia a fala pendente (D-09 não é reativo)

**Arquivos modificados:** `taqciti/src/shared/config/agenteConfigStore.ts` (`onAgenteConfigChange`), `taqciti/src/background/agenteStreamerInstance.ts`, `taqciti/src/background/agenteStreamer.ts` (+ testes)
**Commit:** `6814865` (2ª rodada, decisão: "reativo + persistir")
**O que foi feito:** dep opcional `onConfigChange` — o streamer descarta janela, fila de envio e cursor no instante em que o toggle é desligado, dentro da fila serializada. `step`, `tick` e a mudança de config tratam o desligado igual (`stopStreaming`).

**Refactors mecânicos da 2ª rodada** (sem mudança de comportamento, cada um num commit próprio): `c1fd85b`, `51a6902`, `6139853`, `2ef854b`.

## Verificação

Depois de cada commit, rodei (na worktree isolada, com `npm ci` local):

```bash
npx tsc --noEmit -p tsconfig.json
npx vitest run
```

Resultado final, depois dos 8 commits:

- **Testes:** 34 arquivos, 480 testes — todos passando (partindo de 468 antes desta rodada; 12 testes
  novos adicionados pelas correções acima).
- **Typecheck:** limpo, sem erros.
- **Ambiente:** todas as verificações rodaram dentro da worktree isolada
  (`.claude/worktrees/rf-07-4871-1790515596`), com `node_modules` instalado localmente ali (`npm ci`) —
  não no checkout principal. Os números acima são reproduzíveis rodando `npm ci && npx vitest run &&
  npx tsc --noEmit -p tsconfig.json` dentro de `taqciti/` na branch `feat/fase-07-taqciti-config-background-streamer`
  depois do merge desta rodada.

**Nota sobre a limpeza da worktree:** o fast-forward de `feat/fase-07-taqciti-config-background-streamer`
para os 8 commits acima rodou com sucesso, assim como a remoção da branch temporária
`gsd-reviewfix/07-4871` e do sentinela de recuperação. `git worktree remove --force` conseguiu
desregistrar a worktree do git (`git worktree list` já não mostra mais o caminho), mas o Windows recusou
apagar o diretório físico (`Permission denied`) — provavelmente um handle de arquivo preso (ex.:
antivírus, indexação) dentro do `node_modules` que o `npm ci` instalou ali. Por segurança (ver
`CLAUDE.md`/regras deste agente contra `rm -rf` improvisado em diretórios que podem ser reparse points),
não forcei a remoção manualmente. O diretório órfão fica em
`.claude/worktrees/rf-07-4871-1790515596` — já está fora do controle do git como worktree e dentro do
`.gitignore` de `.claude/`, então não afeta o histórico nem o estado do repositório; pode ser apagado
manualmente quando conveniente (ex.: depois de fechar quaisquer processos que ainda tenham arquivos
abertos ali).

### 2ª rodada (5 decisões do usuário, plano em `07-DECISOES-REVIEW.md`)

Rodada feita no checkout principal. Depois de cada commit: `npx tsc --noEmit` e `npx vitest run`
em `taqciti/`. Resultado final: **37 arquivos, 517 testes, todos passando** (partindo de 480),
typecheck limpo, `npm run build` ok. Cada teste novo foi validado falhando com a correção
desativada antes de ser commitado.

### 3ª rodada — achados da re-revisão incremental (`07-REVIEW.md`, iteração 2)

**Atenção aos códigos:** os CR/WR/IN abaixo são os da **iteração 2** do `07-REVIEW.md` e repetem os números da 1ª revisão
com outro significado. O `07-REVIEW-DISPOSITION.md` é gerado pelo gate e ainda descreve a 1ª revisão; ele não foi editado
à mão (o gate descarta uma linha cujo id foi reaproveitado por outro achado). Decisões e contexto em
`07-DECISOES-REVIEW-2.md`.

| Achado (iteração 2) | Situação | Commit |
|---------------------|----------|--------|
| WR-01 | corrigido | `ddb856b` |
| WR-02 | corrigido | `2d4df95` |
| WR-03 | corrigido | `9b564d7` |
| WR-05 | corrigido | `4a31957` |
| IN-06 | corrigido | `32864ad` |
| IN-02, IN-03 | corrigidos | `ff970d0` |
| IN-01, IN-04 | corrigidos | `3e4a1dc` |
| CR-01 (crítico) | corrigido (decisão: opção A, vínculo `boundMeetingId`) | `b3dfcf1`, `e28bdac`, `a66e15d` |
| WR-04 | corrigido (decisão: opção 2-B; status `interrupted`) | `6404a73` |
| IN-05 | **pendente, fora desta fase**: task de backend (404 para sessão desconhecida em `backend/app/routers/webhook.py`) | — |

Estado final: typecheck, lint e **595 testes** (40 arquivos) verdes; `npm run build` ok. O CR-01 também foi exercitado à
mão no Chrome em 2026-10-10 (aviso de reunião nova apareceu, nada vazou para a sessão anterior, e a confirmação liberou a
reunião) — roteiro e resultado em `07-DECISOES-REVIEW-2.md`, seção "Teste manual do CR-01".

---

_Corrigido: 2026-09-27T14:00:25Z (1ª rodada) e 2026-09-27 (2ª rodada)_
_Corretor: Claude (gsd-code-fixer)_
_Iteração: 1_
