# Phase 7: Taqciti Config + Background Streamer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-25
**Phase:** 7-Taqciti Config + Background Streamer
**Areas discussed:** Repo e branch da Fase 7, session_id antes do binding (Fase 8), Cadência do streaming, Config e autenticação (agenteConfig.ts)

---

## Repo e branch da Fase 7

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, é esse mesmo | Confirma C:\Users\anton\OneDrive\Desktop\taqciti como repo de dev ativo | ✓ |
| Não, é outro caminho/repo | Perguntar qual é o caminho correto | |

| Option | Description | Selected |
|--------|-------------|----------|
| Docs aqui, código lá | Mantém histórico do milestone num lugar só, código com caminho absoluto pro repo taqciti | |
| Espelhar .planning no repo taqciti também | Duplica o rastro de planejamento | |

**User's choice:** PIVOT — nenhuma das duas opções. O usuário quer trazer o código da Taqciti para dentro deste repositório, para ficar tudo localizado em um lugar e conseguir fazer melhorias mais rápido. Pediu recomendação.

**Notes:** Claude recomendou `git subtree` do repositório inteiro (com histórico) para uma pasta `taqciti/`, explicando o trade-off de trazer o `server/` (DocCITi, não relacionado ao Agente) como peso morto, versus copiar só a extensão sem histórico (risco de divergência da Taqciti publicada de verdade — ela tem release próprio, ex: "chore(release): versao 2.1.2").

| Option | Description | Selected |
|--------|-------------|----------|
| git subtree do repo inteiro (recomendado) | Extensão + server/ do DocCITi numa pasta taqciti/, histórico preservado | ✓ |
| Copiar só a extensão (sem server/, sem histórico) | Mais enxuto, perde blame, risco de divergir | |

| Option | Description | Selected |
|--------|-------------|----------|
| Task 1 do primeiro plano da Fase 7 (recomendado) | Commit isolado, versionado junto do resto da fase | ✓ |
| Você faz manualmente agora, antes de planejarmos | Fora do fluxo do GSD | |

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, uma branch só (a já aberta aqui) | Sem branch no repo taqciti; PR final só daqui | ✓ |
| Ainda quero uma branch espelhada lá também | — | |

**User's choice (branch):** Uma branch só — a já aberta neste repositório (`feat/fase-07-taqciti-config-background-streamer`).

---

## session_id antes do binding (Fase 8)

| Option | Description | Selected |
|--------|-------------|----------|
| Campo manual temporário em agenteConfig.ts (recomendado) | Campo simples pra colar o session_id ativo | ✓ |
| Sem session_id, streaming fica noop por enquanto | Adia validação end-to-end pra depois da Fase 8 | |

**User's choice:** Campo manual temporário em agenteConfig.ts/UI.

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, mesma peça (recomendado) | Fase 7 entrega o campo manual de verdade; Fase 8 só adiciona auto-detect por cima | ✓ |
| Não, só gambiarra de teste | Fase 8 reconstrói do zero | |

**User's choice:** Sim, mesma peça — evita retrabalho na Fase 8.

---

## Cadência do streaming

| Option | Description | Selected |
|--------|-------------|----------|
| Reaproveitar o mesmo agrupamento (recomendado) | Plugar no mesmo debounce que já existe pro chrome.storage | ✓ |
| Cadência própria, independente do storage | Intervalo separado, mais um número mágico | |

**User's choice:** Reaproveitar o mesmo agrupamento.

| Option | Description | Selected |
|--------|-------------|----------|
| Só o texto novo desde o último envio (recomendado) | Mesmo padrão da extensão antiga, evita duplicar linhas no banco | ✓ |
| Segmento inteiro toda vez + deduplicar no backend | Mexe em mais um sistema pra esta fase | |

**User's choice:** Só o texto novo desde o último envio.

---

## Config e autenticação (agenteConfig.ts)

| Option | Description | Selected |
|--------|-------------|----------|
| Variável de build + editável em runtime (recomendado) | Padrão via build, mas troca sem recompilar na mesma tela do session_id | ✓ (após pedido de esclarecimento) |
| Só variável de build | Qualquer troca exige recompilar e reinstalar | |

**Notes:** Usuário pediu explicação adicional antes de decidir ("me explique melhor para que eu consiga escolher") — Claude detalhou a diferença com exemplo concreto antes de repetir a pergunta.

| Option | Description | Selected |
|--------|-------------|----------|
| Desligado por padrão (opt-in, recomendado) | Ninguém afetado até decidir ligar, mesmo espírito da Fase 6 | ✓ |
| Ligado por padrão | Todo mundo já manda transcrição, a não ser que desligue | |

**User's choice:** Desligado por padrão.

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, reaproveitar x-agente-key (recomendado) | Mesmo mecanismo da Fase 6, campo vazio não muda nada | ✓ |
| Não, deixar pra depois | Assume gate desligado em produção por enquanto | |

**User's choice:** Sim, reaproveitar x-agente-key.

---

## Claude's Discretion

- Nome exato dos campos de configuração na UI da Taqciti e onde ficam (popup vs. painel lateral).
- Formato/local exato do novo `agenteConfig.ts` dentro de `src/shared/config/`.
- Mecanismo técnico exato de onde no `sessionController.ts`/pipeline de eventos o streamer se pluga.

## Deferred Ideas

- Enviar as mudanças de volta para o repositório `taqciti` original (`git subtree push`) — fora desta fase.
- Remover o `server/` (DocCITi) trazido junto pelo subtree — decisão futura separada.
- Deduplicar no backend em vez de na Taqciti — descartado; a Taqciti resolve mandando só o delta.
