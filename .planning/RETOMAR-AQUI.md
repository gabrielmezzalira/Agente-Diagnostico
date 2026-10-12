# RETOMAR AQUI — guia para continuar em outro PC/conta

**Atualizado:** 2026-10-12 · **Branch:** `feat/fase-08-taqciti-session-association` · **Projeto:** Agente Diagnóstico (CITi)

> Este arquivo existe porque a memória do Claude (fora do repo) não viaja entre PCs. Tudo o que importa está aqui e em `.planning/`.

## Onde estamos
- **Fase 8 (Taqciti Session Association): 27/27 planos executados**, mas a fase **NÃO está concluída**.
- Falta: (1) **teste manual D-20** (Chrome + Meet reais, por uma pessoa); (2) `/gsd-code-review`; (3) `/gsd-verify-work`; (4) PR da branch para a `main`. O requisito TAQ-02 continua Pending de propósito até o D-20 passar.
- Estado detalhado: `.planning/STATE.md`, `.planning/ROADMAP.md`, SUMMARYs em `.planning/phases/08-taqciti-session-association/`.

## Passo a passo no outro PC
1. `git fetch && git checkout feat/fase-08-taqciti-session-association && git pull`
2. Abra o Claude Code na pasta do repo e leia este arquivo + `CLAUDE.md` (regras do projeto: português, SOLID, **nunca ler `.env`**).
3. **Teste D-20:** roteiro em `.planning/phases/08-taqciti-session-association/08-VALIDATION.md`, seção "Roteiro manual D-20 (a)-(i)". Preciso de: Chrome ≥ 116, backend local `:8000`, web app `:5173`, extensão carregada de `taqciti/dist` (gere com `cd taqciti && npm install && npm run build`). Registre "ok" ou o problema na coluna de resultado.
4. Depois: `/gsd-code-review 8` e `/gsd-verify-work 8`. Se o D-20 achar problema, abra plano de correção.
5. Execução dos planos (se precisar de mais algum): `/gsd-execute-phase 8`. O isolamento por worktree degrada para sequencial enquanto o `HEAD` estiver à frente do `origin/HEAD`.

## ⚠️ LEMBRETES OBRIGATÓRIOS (antes de deploy, merge na `master`/`main` ou junção com o AGM)
1. **TEM QUE CRIAR `GEMINI_API_KEY` NO RAILWAY** (hoje não existe). Sem ela, projeto sem chave própria não roda IA nem importação de PDF.
2. **Ordem do rollout:** migração `chunk_id` (**já aplicada** em produção, Supabase "Agente-Diagnostico", 2026-10-12) → deploy do backend (rota de finish + correção da corrida do `stop_session`) → build da Taqciti.
3. **NÃO distribuir build da Taqciti antes do D-20.**
4. Merges vão para a `main`; o **deploy sai da `master`**.
5. Rever o risco **T-08-10** (rotas de escrita da extensão abertas sem `EXTENSION_SHARED_KEY`): aceito pelo "Time Antonio" **até o login do AGM**.

## Decisões do time (fonte de verdade: `.planning/phases/08-taqciti-session-association/08-DECISOES-PENDENTES.md`)
- B1 aprovar-recomendado · B2 aprovar-sem-env + pdf-fallback sim · B3-a aprovar-chunk-id (B3-b `retirada-nunca`, B3-c `404-depois` por falta de resposta) · B5 vincular-ao-vivo · D-11 confirmar-d11 (lixeira local = evolução futura).
- B4-b: Taqciti encerra a sessão **na hora que a call acaba** (fila vazia); envio parado → encerra em **5 min**; reentrar na mesma sala depois de encerrada = **reunião nova** (DA-1); DA-2 continuar-com-aviso; DA-3 fechar-aba-encerra. Motivo: o backend chama o Gemini a cada 15/30 s mesmo sem texto novo, enquanto a sessão estiver aberta.

## Em aberto (NÃO tratar como aceitas — decidir com o time)
- **DA-4:** aba navega para outro site no meio da call, sem fechar (recomendada: `navegar-encerra`).
- **DA-5:** após ~16 h de falha ao encerrar, nada mais encerra a sessão (recomendada: `nova-rodada-no-boot`).
- `finishGaveUp` não é limpo pela retomada do envio (08-20) — confirmar.
- Aviso de histórico cheio de reuniões não enviadas; remoção do código da Fase 7 (`confirmNewMeeting`, `confirmedMeetingId`, `configDestination`, texto "confirme abaixo").

## Acessos que o outro PC pode não ter
- **Supabase** (projeto `fzvwtkipzxdnubprvfct`, "Agente-Diagnostico"): conector do Claude (`/mcp` → claude.ai Supabase) ou SQL Editor. Não é preciso reaplicar a migração.
- **Railway** (criar `GEMINI_API_KEY`) e **Gemini** (valor da chave: nunca colar em conversa/arquivo do repo).
- `.env` e `taqciti/server/.env.local` **não estão no repo** e o Claude não deve lê-los; peça os valores a quem tem.
- `.planning/config.json` aparece como modificado só por fim de linha (CRLF); pode ignorar.
