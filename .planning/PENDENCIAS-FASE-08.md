# Pendências da Fase 8 — o que fazer e o que testar

**Atualizado:** 2026-10-12 · **Branch:** `feat/fase-08-taqciti-session-association`
Complementa o `RETOMAR-AQUI.md`. Marque `[x]` conforme for fechando.

## 1. Para fazer (fora do código, precisa de uma pessoa)

- [ ] **Criar `GEMINI_API_KEY` no Railway** (hoje não existe). Sem ela, projeto sem chave própria não roda IA nem importa PDF.
      O valor da chave nunca vai em conversa nem em arquivo do repo.
- [ ] **Teste manual D-20** (Chrome + Meet reais). Roteiro: `.planning/phases/08-taqciti-session-association/08-VALIDATION.md`,
      seção "Roteiro manual D-20 (a)-(i)". Precisa de Chrome ≥ 116, backend local `:8000`, web app `:5173` e a extensão
      carregada de `taqciti/dist` (`cd taqciti && npm install && npm run build`).
- [ ] Depois do D-20: `/gsd-code-review 8` e `/gsd-verify-work 8`; abrir o PR para a `main`.
- [ ] **Ordem do rollout:** migração `chunk_id` (já aplicada) → deploy do backend → build da Taqciti.
      **Não distribuir a build da Taqciti antes do D-20.**
- [ ] Merge vai para a `main`; **o deploy sai da `master`**.
- [ ] Rever o risco **T-08-10** (rotas de escrita da extensão abertas sem `EXTENSION_SHARED_KEY`), aceito até o login do AGM.

## 2. Para testar à mão (mudanças desta sessão)

Todas em `taqciti/`; testes automáticos cobrem a regra, mas nenhuma foi vista no Chrome real.

- [ ] **DA-4 — navegar encerra** (`meetingTabNavigated.ts`): com a reunião gravando, navegar a MESMA aba para outro site.
      Esperado: a reunião vira "encerrada" e a sessão do Agente fecha (na hora com a fila vazia; senão em até 5 min).
      Contra-prova: recarregar a mesma sala, ou mudar só o `?query`, **não** encerra.
- [ ] **DA-5 — nova rodada no boot** (`agenteSessionFinisherInstance.ts`): com uma associação `picker` marcada
      `finishGaveUp: true` no `chrome.storage`, recarregar a extensão. Esperado: uma única tentativa de encerrar;
      se falhar de novo, desiste de novo e não repete até o próximo boot.
- [ ] **Retomar envio limpa `finishGaveUp`** (`associationSend.ts`): reunião com envio parado e desistência marcada →
      "Continuar envio" → concluir. Esperado: a sessão passa a ser encerrada normalmente depois.

## 3. Decisões do time (não decidi sozinho)

- [ ] **Confirmar DA-4 e DA-5.** Implementei as opções *recomendadas* do guia (`navegar-encerra`, `nova-rodada-no-boot`)
      a pedido de "continue a implementação". Cada uma está em commit próprio e se desfaz com `git revert`:
      DA-4 = `566a005`, DA-5 = `32c029b`.
- [ ] **Remover o código da Fase 7** (`confirmNewMeeting`, `confirmedMeetingId`, `configDestination`, texto "confirme abaixo").
      **Não feito:** é remoção de código e mexe no formato da config guardada no navegador de quem já usa.
- [ ] **Aviso de histórico cheio** de reuniões não enviadas. **Não feito:** precisa de decisão de produto e de UI.
