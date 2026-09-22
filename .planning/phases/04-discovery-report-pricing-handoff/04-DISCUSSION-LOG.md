# Phase 4: Discovery Report + Pricing Handoff - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-22
**Phase:** 4-discovery-report-pricing-handoff
**Areas discussed:** Estrutura Produto/Dados, Seção Métricas p/ Precificação, Handoff/extração no import, Tabela de cobertura discovery, Template PRD (novo), Readiness + revisão humana (novo)

---

## Estrutura Produto/Dados — geração

| Option | Description | Selected |
|--------|-------------|----------|
| Prompt discovery separado (irmão) | Estrutura de relatório discovery própria, gated por mode; sales byte-idêntico | ✓ |
| Estender o generate_report atual | Branches condicionais inline no mesmo prompt sales | |

**User's choice:** Prompt discovery separado (irmão) + template que já existe (colocado na raiz).
**Notes:** O usuário sinalizou ter um template para o relatório e o colocou na raiz (`PRD_modelo_em_branco_CITi.pdf`).

## Estrutura Produto/Dados — conteúdo

| Option | Description | Selected |
|--------|-------------|----------|
| Híbrido: código pré-monta + LLM analisa | Código agrupa itens por lens; LLM escreve análise | ✓ |
| LLM sintetiza livre por lente | LLM produz seções sozinho | |
| Código monta tudo, sem LLM na estrutura | Só tabelas; LLM só texto de análise | |

**User's choice:** Híbrido.

## Seção Métricas para Precificação — conteúdo

| Option | Description | Selected |
|--------|-------------|----------|
| Funcionalidades + sinais de esforço | Funcionalidades por bloco + fontes/volume/complexidade/quick wins | ✓ |
| Só lista de funcionalidades | Apenas entregáveis por bloco | |
| Só métricas brutas de discovery | Números sem transformar em features | |

**User's choice:** Funcionalidades + sinais de esforço.

## Handoff / extração no import

| Option | Description | Selected |
|--------|-------------|----------|
| Reusar como está + verificar | Não toca o extrator; verifica com import real | ✓ |
| Ajustar extrator p/ priorizar Métricas | Foca a seção de métricas; muda o Precificador | |
| Decidir após testar | (variante) | |

**User's choice:** Reusar como está + verificar (após pedir explicação do extrator atual).
**Notes:** Pediu explicação de como o extrator funciona hoje e justificativas antes de decidir. Também pediu para listar os blocos temáticos atuais e propor novos para discovery.

## Blocos temáticos (ampliação)

| Option | Description | Selected |
|--------|-------------|----------|
| GenAI / IA (LLM, RAG, agentes) | Separa IA generativa de Ciência de Dados | ✓ |
| Governança & LGPD/Segurança | Governança/compliance como bloco precificável | ✓ |
| Infra / MLOps / Observabilidade | Pipelines monitorados, MLOps | ✓ |
| Descoberta / Consultoria | Mapeamento/discovery como entregável | ✓ |

**User's choice:** Todos os 4 candidatos + **Machine Learning** (adição freeform).
**Notes:** 7 blocos atuais + 5 novos = 12. Nota de sobreposição ML/GenAI/Ciência de Dados → prompt terá linha de desambiguação.

## Tabela de cobertura discovery

| Option | Description | Selected |
|--------|-------------|----------|
| Duas tabelas (Produto / Dados) | Uma tabela por lente, labels do DISCOVERY_AREA_SET | ✓ |
| Tabela única com coluna 'Lente' | 18 áreas numa tabela + coluna produto/dados | |
| Você decide | Formato a critério do planner | |

**User's choice:** Duas tabelas (Produto / Dados).

## Template PRD — profundidade

| Option | Description | Selected |
|--------|-------------|----------|
| Esqueleto do PRD, só o que o pipeline produz | Segue estrutura do PRD; preenche só o capturado | ✓ |
| PRD completo auto-gerado (16 seções) | LLM preenche tudo (risco de alucinação) | |
| Manter simples (Produto/Dados/Métricas) | Ignora o PRD; 3 seções do ROADMAP | |

**User's choice:** Esqueleto do PRD, só o que o pipeline produz.
**Notes:** O template revelou-se o PRD padrão da CITi (16 seções), entregável pós-Discovery Enterprise.

## Métricas x PRD — encaixe

| Option | Description | Selected |
|--------|-------------|----------|
| Seção dedicada consolidando os sinais | Seção 'Métricas para Precificação' explícita | |
| Só dentro das seções nativas do PRD | Métricas em 6.3/11/7.3, sem seção nova | ✓ |
| Você decide | Formato ao planner | |

**User's choice:** Só dentro das seções nativas do PRD.

## SC#1 — resolução da tensão

| Option | Description | Selected |
|--------|-------------|----------|
| Reformular o SC#1 | Ajustar texto do SC no ROADMAP (métricas nativas + extraíveis) | ✓ |
| Manter seção com o nome afinal | Criar seção identificável 'Métricas para Precificação' | |

**User's choice:** Reformular o SC#1.

## Readiness — sinais

| Option | Description | Selected |
|--------|-------------|----------|
| Cobertura mínima por lente | ≥ N produto e ≥ M dados cobertas/parciais | ✓ |
| % global de cobertura | Limiar único sobre as 18 áreas | ✓ |
| Perguntas respondidas / transcrição mínima | Volume mínimo de conversa | ✓ |
| Seções-chave do PRD com dado | Seções essenciais com insumo mapeável | ✓ |

**User's choice:** Todos os 4 sinais.

## Readiness — combinação

| Option | Description | Selected |
|--------|-------------|----------|
| Score ponderado + limiar | Soma ponderada > limiar; botão mostra o que falta | ✓ |
| AND rígido (todos precisam passar) | Todos os sinais obrigatórios | |
| Núcleo obrigatório + resto por score | Meio-termo | |

**User's choice:** Score ponderado + limiar.
**Notes:** Pesos/limiar exatos = default calibrável, ajustar após sessões reais.

## Revisão humana + trava de preço

| Option | Description | Selected |
|--------|-------------|----------|
| Status + trava o handoff de preço | Status no PRD; import só aceita 'Aprovado' | ✓ |
| Só status, sem travar o preço | Status informativo; import como hoje | |
| Revisão só depois (fora desta fase) | Só readiness nesta fase | |

**User's choice:** Status + trava o handoff de preço.

---

## Claude's Discretion
- Formato do esqueleto do PRD em Markdown (derivar do PDF) + marcadores de seção vazia.
- Pesos e limiar do score de readiness (default, calibrável).
- Formato de pré-montagem determinística das tabelas por lens.
- Detalhe da migration do `status` (nome, enum vs text nullable).
- Texto de desambiguação dos blocos ML / GenAI / Ciência de Dados.

## Deferred Ideas
- Botão "Gerar PRD" + UI de revisão/aprovação → Fase 5 (frontend).
- PRD completo auto-gerado (personas, user stories Gherkin, CSD, KPIs) → fora desta fase.
- Adaptar extrator para focar na seção de métricas → só se REP-02 vier ruim.
- Calibração fina dos pesos/limiar de readiness → após sessões reais.
- Aplicar a reformulação do SC#1 no ROADMAP → follow-up de edição.
