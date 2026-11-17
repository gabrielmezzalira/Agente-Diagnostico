---
phase: 10
review: 10-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "com a mesma call aberta em duas abas, a fala entra duas vezes na transcrição (`meet/chunk` de aba não dona não é filtrado)"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "o manifesto diz que a extensão não tem integração com nenhum backend, e o cabeçalho do `index.ts` repete isso"
  - id: IN-01
    severity: info
    disposition: deferred
    title: "janela estreita entre a checagem de `isClosing` e o `send-resumed` no \"Continuar envio\""
  - id: IN-02
    severity: info
    disposition: deferred
    title: "falha ao abrir o WebSocket aparece como \"sessão não ativa\" e nunca tenta de novo"
  - id: IN-03
    severity: info
    disposition: fixed
    title: "comentários ainda apontam para o `index.ts` depois da divisão (D-05)"
  - id: IN-04
    severity: info
    disposition: deferred
    title: "as notas da aba AGP aparecem numeradas como se fossem passos"
  - id: IN-05
    severity: info
    disposition: fixed
    title: "o `CLAUDE.md` diz que a Taqciti \"fala apenas com o backend v2\""
  - id: IN-06
    severity: info
    disposition: fixed
    title: "`agp-fake-backend.py` cita o nome errado do arquivo e sobe o servidor ao ser importado"
  - id: IN-07
    severity: info
    disposition: fixed
    title: "no teste de fumaça, `stopServer` pode travar se o processo já tiver saído"
  - id: IN-08
    severity: info
    disposition: fixed
    title: "a versão do manifesto continua 2.1.2 mesmo com permissão e recurso novos"
open: 0
total: 10
recorded: 2026-10-30T15:09:31.825Z
---

# Phase 10: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | fixed | Plano 10-18 (2026-11-17, decisão do usuário: filtrar): `meet/chunk` de uma aba que não é a dona não alimenta mais a transcrição. A conferência com duas abas fica nos testes manuais do fim. |
| WR-02 | warning | fixed | Plano 10-19 (2026-11-17, decisão do usuário: corrigir): descrição do manifesto e cabeçalho do `index.ts` dizem que a transcrição vai ao Agente. O plano 10-20 corrigiu também README, INSTALL e `package.json`, e renomeou a extensão para "TaqCITi". |
| IN-01 | info | deferred | Janela de milissegundos, risco residual já aceito (T-10-02). Sem correção nesta fase. |
| IN-02 | info | deferred | Muda comportamento (retentativa e mensagem de erro). Decisão do time, fora do fechamento da Fase 10. |
| IN-03 | info | fixed | Comentários do `background/` trocados para `messageRouter.ts`, `browserListeners.ts` e `bootstrap.ts` (commit de docs desta rodada). |
| IN-04 | info | deferred | Ajuste de texto visível na aba AGP. Entra junto com o trabalho de UX da próxima fase. |
| IN-05 | info | fixed | Plano 10-20 (2026-11-17): o D-07 foi mantido por decisão do usuário e a frase da seção 10 do `CLAUDE.md` deixou de dizer "apenas". |
| IN-06 | info | fixed | Docstring corrigida para `agp-fake-backend.py` e o `uvicorn.run` ficou atrás de `if __name__ == "__main__"`. Smoke 3/3 verde depois da mudança. |
| IN-07 | info | fixed | `stopServer` não espera mais um `exit` que já passou, e o stderr do Python fica visível. Smoke 3/3 verde depois da mudança. |
| IN-08 | info | fixed | Plano 10-19 (2026-11-17): versão 2.1.2 → 2.2.0 no manifesto e no `package.json`. |
