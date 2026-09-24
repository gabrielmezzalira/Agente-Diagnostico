# Phase 5: Two-Lens Monitoring (Frontend) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-23
**Phase:** 5-two-lens-monitoring-frontend
**Areas discussed:** Escopo (Gerar PRD), Detecção de modo, Layout do agrupamento, Badges e labels,
Retirar sales (milestone), Integração Taqciti (milestone), Botão Gerar PRD × Relatório, Onde vive a
aprovação, Empty state, Exibição do readiness, Localização do botão, Exposição do readiness (backend)

---

## Retirar sales (tema de milestone levantado pelo usuário)

| Opção | Descrição | Selected |
|-------|-----------|----------|
| Manter fallback, decidir pós-Fase 9 | Não arranca o sales agora; mantém lista plana como fallback; remoção vira decisão de milestone após a Fase 9 validar discovery numa call real | ✓ |
| Retirar sales já (nova fase antes da 5) | Tratar aposentadoria do sales como iniciativa própria agora (backend+frontend+DB) | |
| Fase 5 só discovery, sales congelado | Implementar só o caminho discovery, deixando o sales como está sem polir | |

**User's choice:** Manter fallback, decidir pós-Fase 9.
**Notes:** O usuário quer o produto voltado a discovery enterprise (sales é comercial demais), mas
concordou que remover agora é arriscado/irreversível. Redirecionado para decisão de milestone.

## Integração Taqciti × Agente (tema de milestone levantado pelo usuário)

| Opção | Descrição | Selected |
|-------|-----------|----------|
| Confirmar Modelo A/C (roadmap atual) | Agente entra no Taqciti (aba AGP, Fase 10) + Taqciti alimenta o backend (Fases 7-8) + web app do Agente coexiste | ✓ |
| Rediscutir a arquitetura Taqciti | Reabrir as Fases 6-10 (replanejamento de milestone) | |
| Só quero entender melhor | A tabela de opções respondeu; mantém o roadmap | |

**User's choice:** Confirmar Modelo A/C (roadmap atual).
**Notes:** O usuário não lembrava que a integração já estava decidida/sequenciada (Fases 6-10, com
a aba AGP dentro do Taqciti na Fase 10). Apresentadas as opções "agente no Taqciti" vs "Taqciti no
agente" — a 2ª é tecnicamente inviável (captura mora na extensão/aba do Meet). Confirmado o roadmap.

## Escopo — Gerar PRD + status/aprovação (D-35)

| Opção | Descrição | Selected |
|-------|-----------|----------|
| Incluir na Fase 5 (honrar D-35) | Adiciona botão Gerar PRD gated por readiness + UI de status/aprovação; aproveita o backend da Fase 4 | ✓ |
| Fase separada (roadmap update) | Mantém Fase 5 estrita em UI-01/02/03 e cria fase dedicada | |
| Versão mínima agora | Só o botão gated, sem a UI completa de status/aprovação | |

**User's choice:** Incluir na Fase 5 (honrar D-35). → D-41.
**Notes:** Backend já pronto (readiness, status, PATCH, gate) exceto a exposição do readiness.
Follow-up: ampliar o texto dos SC da Fase 5 no roadmap.

## Detecção de modo

| Opção | Descrição | Selected |
|-------|-----------|----------|
| Inferir do payload (lens != null) | Se área vier com lens preenchida → discovery; tudo null → sales. Zero fetch, sem backend | ✓ |
| Buscar project.mode via REST | Expor mode em Session / buscar Project; mais trabalho, muda contrato | |

**User's choice:** Inferir do payload. → D-42.
**Notes:** Explicado o conceito de "payload". Nuance registrada: na página do projeto usa-se
`project.mode` (sem WS).

## Layout do agrupamento

| Opção | Descrição | Selected |
|-------|-----------|----------|
| Duas seções empilhadas | Mesma coluna 220px, cabeçalhos Produto/Dados; sales = lista plana | ✓ |
| Duas colunas lado a lado | Rouba largura da transcrição central | |
| Grupos colapsáveis | Mais interação/código | |

**User's choice:** Duas seções empilhadas. → D-43.

## Badges e labels

| Opção | Descrição | Selected |
|-------|-----------|----------|
| Badge de lente + bloco sub-label | Badge Produto/Dados principal; bloco secundário; estender mapa 8→12 | ✓ |
| Só badge de lente (remove bloco) | Tag vira só a lente; bloco some | |
| Badge de lente + bloco server-driven | Label do bloco também vindo do backend | |

**User's choice:** Badge de lente + bloco como sub-label. → D-44.
**Notes:** Explicados os conceitos de badge, label, sub-label e server-driven.

## Botão Gerar PRD × botão Relatório

| Opção | Descrição | Selected |
|-------|-----------|----------|
| Mesmo botão, muda por modo | Discovery = "Gerar PRD" gated; sales = "Relatório" | (substituído) |
| Botão "Gerar PRD" separado | Botão novo só no discovery | |

**User's choice:** O usuário reformulou: o botão "Gerar PRD" fica na plataforma do Agente, **dentro
do projeto**, antes de gerar a precificação, bloqueado, com uma barrinha mostrando a % para ser
liberado. → refinado em D-47.

## Onde vive a aprovação (status)

| Opção | Descrição | Selected |
|-------|-----------|----------|
| Na sessão encerrada (pós-call) | Seletor de status + aprovar junto do relatório gerado | ✓ |
| Durante a sessão ativa | Aprovar na topbar/modal ao vivo | |
| Nos dois lugares | Status visível/editável nos dois | |

**User's choice:** Na sessão encerrada (pós-call). → D-48.

## Empty state da cobertura

| Opção | Descrição | Selected |
|-------|-----------|----------|
| Placeholder "aguardando..." | Skeleton discreto até o initial_state chegar | ✓ |
| Coluna vazia | Nada até chegar | |

**User's choice:** Placeholder "aguardando…". → D-46.

## Exibição do readiness (o que falta)

| Opção | Descrição | Selected |
|-------|-----------|----------|
| Tooltip no botão | Hover lista os sinais baixos | ✓ (parte) |
| Indicador visível abaixo da budget bar | Score sempre visível, sem hover | |
| Os dois | Indicador + tooltip | |

**User's choice:** Tooltip no botão **+ um pequeno gráfico no próprio botão** mostrando a % preenchida
conforme os insumos. → incorporado em D-47.

## Localização do botão "Gerar PRD" + barrinha

| Opção | Descrição | Selected |
|-------|-----------|----------|
| Na tela da sessão (ao vivo + encerrada) | Readiness nasce do estado da sessão; sem fetch extra | |
| Na página do projeto | Botão + barrinha na ProjectDetailPage, antes da precificação; precisa buscar readiness | ✓ |
| Barrinha ao vivo + botão no projeto | Duas superfícies | |

**User's choice:** Na página do projeto. → D-47.

## Exposição do readiness (backend)

| Opção | Descrição | Selected |
|-------|-----------|----------|
| Rota REST na Fase 5 (GET readiness) | GET /sessions/{id}/readiness aditivo; página do projeto consome | ✓ |
| Evento WebSocket (barra ao vivo) | readiness_update via WS | |
| Fase de backend separada antes | Mantém Fase 5 100% frontend | |

**User's choice:** Rota REST na Fase 5. → D-49.
**Notes:** Descoberto no scout que `readiness_score()` existe como função pura mas não é exposto por
nenhuma rota/evento. Usuário aceitou a adição de backend aditiva dentro da Fase 5 (precedente D-38).

---

## Claude's Discretion
- Cores/estilo das badges; texto dos cabeçalhos de seção; forma do helper de inferência de modo;
  os 12 labels de bloco; forma do placeholder e do mini-gráfico de % no botão; posição exata do
  botão na ProjectDetailPage; shape da resposta de GET /sessions/{id}/readiness.

## Deferred Ideas
- Remoção do modo sales → decisão de milestone pós-Fase 9.
- Integração Taqciti (streaming/binding/aba AGP) → Fases 6-10 (Modelo A/C confirmado).
- Editar os SC da Fase 5 no ROADMAP.md para incluir Gerar PRD + aprovação (D-41).
- Calibração fina dos pesos/limiar do readiness → pós sessões reais.
- Label de bloco server-driven → só se o vocabulário ficar volátil.
</content>
