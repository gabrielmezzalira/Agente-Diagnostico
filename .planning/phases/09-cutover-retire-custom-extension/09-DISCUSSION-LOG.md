# Phase 9: Cutover + Retire Custom Extension - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-26
**Phase:** 09-cutover-retire-custom-extension
**Areas discussed:** Quando a Taqciti conta como validada, Como instalar a Taqciti, Remover ou desativar a antiga, Ordem e janela do cutover

Nota: antes da discussão, o usuário afirmou que a Fase 8 está fechada (o git local ainda mostrava a branch
`feat/fase-08-…` 211 commits à frente da `main`).

---

## Quando a Taqciti conta como validada

| Pergunta | Opções | Escolha |
|---|---|---|
| O que basta para validar | UAT Fase 8 + 1 reunião ponta a ponta / Só UAT Fase 8 / Período de uso real | UAT Fase 8 + 1 reunião ✓ |
| Prova SC1 antes ou depois de remover | Antes / Depois | Antes ✓ |
| O que comprovar no banco | Transcrição source=extension / Cobertura+perguntas / Relatório final / Encerramento pela Taqciti | Os quatro ✓ |
| Ambiente | Produção com ZZ-TESTE / Backend local | Produção com ZZ-TESTE ✓ |

## Como instalar a Taqciti

| Pergunta | Opções | Escolha |
|---|---|---|
| Distribuição | Instaladores da release / .zip servido pelo web app / Chrome Web Store | Instaladores da release ✓ |
| ExtensionPage | Reescrever para a Taqciti / Remover / Trocar só o link | Reescrever ✓ |
| Configuração | Embutida no build / Página explica / Você decide | Embutida no build ✓ |
| Origem da release (follow-up) | Repo original da Taqciti / Este repo / Não sei | Repo original ✓ |
| Chave do Agente (follow-up) | Página ensina a colar / Sem chave por enquanto / Você decide | Sem chave por enquanto ✓ |

**Notes:** follow-ups surgiram porque a chave não pode ir no bundle (D-10 Fase 7) e o `release.yml` do subtree não roda neste repo.

## Remover ou desativar a antiga

| Pergunta | Opções | Escolha |
|---|---|---|
| extension/ + zip | Remover de vez / Mover para archive / Desativar e remover depois | Remover de vez ✓ |
| Resíduos fora de extension/ | Limpar referências mortas / Só o mínimo | Limpar ✓ |
| Docs | Sim, commit só de docs / Só PROJECT e ROADMAP | Sim ✓ |

## Ordem e janela do cutover

| Pergunta | Opções | Escolha |
|---|---|---|
| Deploy x prova | Deploy primeiro / Produção já atualizada / Não sei | Deploy primeiro ✓ |
| Aviso ao time | Página avisa / Só por fora | Página avisa ✓ |
| Antiga ainda em uso | Continua funcionando / Bloquear no backend | Continua funcionando ✓ |

## Claude's Discretion

- Texto/layout da ExtensionPage; quais testes estender para SC3; granularidade dos commits de limpeza.

## Deferred Ideas

- Renomear "extension" no backend; bloquear extensão antiga; chave/EXTENSION_SHARED_KEY até o login do AGM; workflow de release neste repo.
