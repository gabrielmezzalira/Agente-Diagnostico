---
phase: 08-taqciti-session-association
plan: 07
subsystem: backend-extension-routes
status: in-progress
tags: [backend, fastapi, decision-b1, risco-residual]
requirements-completed: []
---

# Phase 8 Plan 07: Rotas da extensão (clientes e sessão) Summary (parcial)

> Registro parcial feito ANTES de qualquer rota, como exige a precondição das Tasks 2 e 3. Este arquivo é
> completado ao final da execução.

## Task 1: Decisão B1 (respondida pelo time, registrada literalmente)

- **Opção escolhida:** `aprovar-recomendado` (contrato como proposto: mode `discovery`, 409 sem índice único, gate opt-in `verify_extension_key`).
- **B4-a (mode do cliente criado pela Taqciti):** `discovery` (recomendado; implementado no plano 08-12).
- **Duplicidade de nome:** 409 sem índice único, comparando sem acento e sem diferença de caixa; nome de 1 a 120 caracteres.
- **Gate das rotas de escrita:** opt-in da Fase 6 (o mesmo `verify_extension_key`).
- **Data da decisão:** 2026-10-12.

## Risco residual T-08-10

- **Risco:** enquanto `EXTENSION_SHARED_KEY` não estiver ativa no Railway, qualquer pessoa com a URL do backend consegue criar clientes e sessões pelas rotas novas; com a decisão B2 (chave Gemini opcional), cada sessão criada roda o pipeline com a chave do SERVIDOR (custo de IA). Severidade alta.
- **Dono do risco:** "Time Antonio" (resposta literal do usuário; entendido como Antonio).
- **Condição de revisão / até quando vale:** "até o login do AGM".
- **Contexto informado pelo usuário:** o deploy ainda NÃO foi feito; os merges vão para a `main` e o deploy sai da `master`, então as rotas ainda não estão expostas em produção.
- **Data do aceite:** 2026-10-12.
- **Conferência no fechamento da fase:** o plano 08-21 confere este registro (ou a env var ativa).

## Lembrete bloqueante (decisão B2 = `aprovar-sem-env`)

> **TEM QUE CRIAR `GEMINI_API_KEY` NO RAILWAY** antes de deploy / merge na `master` / junção com o AGM.
> Sem ela, projetos sem chave própria não rodam o pipeline de IA (ver `08-DECISOES-PENDENTES.md`).
