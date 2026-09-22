# Phase 2: Discovery Mode + DiscoveryPromptBuilder - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-20
**Phase:** 2-discovery-mode-discoverypromptbuilder
**Areas discussed:** As 18 áreas de discovery, Armazenamento do mode + papel do project_type, Forma do DiscoveryPromptBuilder, Enquadramento (framing) do discovery, Escopo de UI do mode

---

## As áreas de discovery

Iteração longa. A proposta inicial (11 áreas) foi expandida pelo usuário e depois reduzida.

**Rodada 1 — lista proposta (11):** Produto (gargalo, frente_atuacao, impacto_usuario,
mapeamento_processo, viabilidade_entrega) + Dados (fontes_dados, qualidade_dados, metricas,
lgpd_seguranca, abordagem_solucao, quick_wins).

| Opção | Descrição | Selected |
|--------|-------------|----------|
| Confirmar lista proposta | Usar as 11 keys/labels propostas | |
| Ajustar keys/labels | Mudar nomes/labels/ordem | ✓ |
| Repensar a divisão | Mudar as áreas em si | |

**Rodada 2 — usuário adicionou** (Produto: Desenho da solução, fluxo dos dados, mapeamento do
fluxo dos processos, o que o cliente espera como solução, se a solução cabe ao cliente;
Dados: ciência de dados, análise de dados, engenharia de dados, machine learning, sistemas em
nuvem, automatizações).

| Opção | Descrição | Selected |
|--------|-------------|----------|
| Substituir (11 total) | Trocar a lista antiga pela nova | |
| Não, era pra SOMAR | Acrescentar às 11 originais (resulta em 22) | ✓ |

**Rodada 3 — mesclado dá 22; fechar considerando duplicatas + custo realtime:**

| Opção | Descrição | Selected |
|--------|-------------|----------|
| Enxugar juntando as duplicadas | Fundir as ⚠ e mostrar lista reduzida | ✓ |
| Manter todas as 22 | Usar as 22, atualizar roadmap p/ 22 | |
| Você me diz quais fundir | Usuário indica as fusões | |

**Rodada 4 — aprovação da lista reduzida (18):**

| Opção | Descrição | Selected |
|--------|-------------|----------|
| Aprovar as 18 como estão | Travar DISCOVERY_AREA_SET com 18 | ✓ |
| Enxugar mais o lado Dados | Fundir ciência/análise/ML | |
| Ajustar algum nome/ordem | Mexer em label/key/ordem | |

**User's choice:** 18 áreas (8 Produto + 10 Dados). Ver tabela em CONTEXT.md D-06.
**Notes:** Fusões: mapeamento_processo+mapeamento_processos; viabilidade_entrega+fit_solucao_cliente
→ viabilidade_solucao; desenho_solucao+abordagem_solucao; fontes_dados+qualidade_dados →
qualidade_fontes. metricas/lgpd_seguranca/quick_wins mantidas. Roadmap/REQUIREMENTS dizem
"11" → atualizar para "18" (D-12). Builder sinalizou custo/diluição de classificar 18 áreas
por ciclo de 30s; usuário aceitou 18.

---

## Armazenamento do mode + papel do project_type

| Opção | Descrição | Selected |
|--------|-------------|----------|
| Coluna mode default 'sales'; 11 sempre ativas; project_type opcional | Nova coluna, áreas sempre ativas, project_type ignorado no discovery | ✓ |
| mode default 'sales'; project_type ainda calibra no discovery | project_type influencia áreas/hints também no discovery | |
| Você decide o detalhe do project_type | Travar só a coluna | |

**User's choice:** Coluna `mode` enum `sales|discovery` default `sales`; 18 sempre ativas;
`project_type` opcional/ignorado no discovery.
**Notes:** Ver D-07/D-08. Ponto de atenção: `_init_coverage` e hints do sales dependem de
`AREAS_BY_PROJECT_TYPE`; discovery precisa de ramo próprio sem quebrar sales nem `custom_areas`.

---

## Forma do DiscoveryPromptBuilder

| Opção | Descrição | Selected |
|--------|-------------|----------|
| Classe separada + llm.py escolhe por mode | Classe irmã, CITI só no sales | ✓ |
| Subclasse de PromptBuilder | Herda e sobrescreve framing | |
| Flag/estratégia no PromptBuilder atual | Um builder com branch por mode | |
| Você decide (planner, SOLID) | Travar só comportamento | |

**User's choice:** Classe separada `DiscoveryPromptBuilder`, irmã de `PromptBuilder`,
reaproveitando helpers de DMS; seleção por `mode`; CITI_PORTFOLIO/CATALOG/TECH só no sales.
**Notes:** Ver D-09. Alinhado ao Open/Closed do CLAUDE.md. CITI hoje é injetado em llm.py:114/184.

---

## Enquadramento (framing) do discovery

| Opção | Descrição | Selected |
|--------|-------------|----------|
| Remover portfólio + manter DMS + ADICIONAR framing de discovery | Enquadramento de facilitador de discovery | ✓ |
| Só remover o portfólio, sem novo enquadramento | Prompt neutro | |
| Você decide o texto do enquadramento | Travar remoção + DMS, texto livre p/ planner | |

**User's choice:** Remover portfólio + manter DMS + adicionar enquadramento de discovery.
**Notes:** Ver D-10. Texto exato do framing fica discricionário do research/planner (proposta
a validar); deve cumprir SC#3 (sem CITI, com DMS).

---

## Escopo de UI do mode

| Opção | Descrição | Selected |
|--------|-------------|----------|
| Toggle mínimo no form agora | Backend + seletor simples sales/discovery no form | ✓ |
| Só backend/API nesta fase | Toggle no frontend só na Fase 5 | |

**User's choice:** Toggle mínimo `sales|discovery` no formulário de projeto agora.
**Notes:** Ver D-11. UI rica de duas lentes = Fase 5.

---

## Claude's Discretion

- Texto exato do enquadramento de discovery (D-10) e dos hints por área.
- Composição vs duplicação dos helpers de DMS no DiscoveryPromptBuilder.
- Formato da migration/enum no Postgres (default `sales`).
- Reservar ou não campo `lens` opcional em `AreaDefinition` já nesta fase (D-06b).

## Deferred Ideas

- Tags de lente + dois agentes na geração de perguntas → Fase 3 (LENS).
- Enxugar mais o lado Dados (ciência/análise/ML) → revisitar se diluir/custar demais.
- Seção "Métricas para Precificação" + handoff → Fase 4.
- UI de duas lentes + remover cópia de áreas do frontend → Fase 5.
- `generate_custom_areas` dinâmico → DISCF-02, milestone futuro.
- Deletar sales/CITI_PORTFOLIO → decisão de TEAM/ROADMAP após validar discovery.
