# AGENTE DIAGNÓSTICO
## Software Design Document — v2.0
**CITi · Subárea de Dados · Maio 2026**

**Stack:** React + Vite + TypeScript + Tailwind · Python + FastAPI · Supabase (PostgreSQL)

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura](#2-arquitetura)
3. [Schema do Banco de Dados](#3-schema-do-banco-de-dados-supabase)
4. [Features](#4-features)
   - [F1 — Configuração de Projeto](#f1--configuração-de-projeto)
   - [F2 — Setup de Sessão / Reunião](#f2--setup-de-sessão--reunião)
   - [F3 — Geração Dinâmica de Prompts](#f3--geração-dinâmica-de-prompts)
   - [F4 — Banco de Perguntas por Tipo](#f4--banco-de-perguntas-por-tipo)
   - [F5 — Tela de Monitoramento](#f5--tela-de-monitoramento)
   - [F6 — Fila de Perguntas (pin / dismiss / TTL)](#f6--fila-de-perguntas-pin--dismiss--ttl)
   - [F7 — Controle de Budget em Tempo Real](#f7--controle-de-budget-em-tempo-real)
   - [F8 — Persistência de Sessão e Histórico](#f8--persistência-de-sessão-e-histórico)
   - [F9 — Exposição de URL (Tunnel)](#f9--exposição-de-url-tunnel)
   - [F10 — Data Maturity Score](#f10--data-maturity-score)
5. [Contratos de API](#5-contratos-de-api-fastapi)
6. [Eventos WebSocket](#6-eventos-websocket)
7. [Ordem de Implementação](#7-ordem-de-implementação)
8. [Riscos e Decisões em Aberto](#8-riscos-e-decisões-em-aberto)

---

## 1. Visão Geral

O Agente Diagnóstico é um sistema de apoio ao comercial da CITi que atua como um tech lead sênior interrogando projetos antes de fechar contrato — detectando riscos técnicos antes da execução. Opera em dois modos:

- **Modo interativo:** o comercial descreve o projeto no terminal, o agente faz perguntas uma por vez, o comercial digita as respostas manualmente.
- **Modo realtime:** o agente assiste à reunião ao vivo via transcrição de áudio (Taqtic ou Recall.ai), classifica áreas de risco, dispara alertas e sugere perguntas em tempo real.

A versão 2.0 adiciona interface web completa, banco de dados persistente, configuração por projeto, geração dinâmica de prompts, controle de budget, fila de perguntas e histórico de sessões.

---

## 2. Arquitetura

### 2.1 Visão de componentes

| Camada | Tecnologia | Responsabilidade |
|--------|-----------|-----------------|
| Frontend | React + Vite + TS + Tailwind | UI de configuração, monitoramento em tempo real, histórico |
| Backend | Python + FastAPI | Orquestração dos agentes LLM, WebSocket, webhook receiver, tunnel |
| Banco de dados | Supabase (PostgreSQL) | Persistência de projetos, sessões, perguntas, alertas, relatórios |
| LLM | Google Gemini (configurável por projeto) | CoverageClassifier, RedFlagDetector, QuestionPlanner, ReportGenerator |
| Transcrição | Taqtic (extensão Chrome) / Recall.ai (bot cloud) | Captura e entrega de chunks de áudio transcritos |
| Tunnel | cloudflared / ngrok (configurável) | Expõe webhook local para Taqtic ou Recall.ai externos |

### 2.2 Fluxo de dados — modo realtime

```
Reunião Google Meet
    → Taqtic / Recall.ai
    → WebhookServer (FastAPI :8765)
    → TranscriptBuffer (asyncio.Queue)
    → 5 tasks assíncronas paralelas:
```

| Task | O que faz | Cadência |
|------|-----------|----------|
| `_ingestion_task` | Recebe chunks de transcrição | Por evento (push) |
| `_coverage_task` | CoverageClassifier classifica áreas de risco via LLM | A cada 30s ou 250 tokens novos |
| `_red_flag_task` | RedFlagDetector emite até 2 alertas por janela | A cada 15s (timer fixo) |
| `_watchdog_task` | Detecta se o stream pausou | A cada 10s |
| `_render_task` | Envia estado atualizado via WebSocket para o frontend | A cada 250ms |

### 2.3 Componentes LLM

| Componente | Prompt (origem) | Função |
|-----------|----------------|--------|
| `DiagnosticAgent` | Gerado dinamicamente por projeto | Conduz entrevista interativa no modo terminal |
| `CoverageClassifier` | Gerado dinamicamente por projeto | Classifica áreas cobertas → JSON estruturado |
| `RedFlagDetector` | Gerado dinamicamente por projeto | Emite alertas críticos com evidência |
| `QuestionPlanner` | Gerado dinamicamente + banco de perguntas por tipo | Gera 3 perguntas contextuais para o comercial |
| `ReportGenerator` | Template fixo + contexto da sessão | Gera relatório final em Markdown |

> **Nota:** na v1 todos os prompts eram constantes em `prompts.py`. Na v2 todos os prompts dos agentes são gerados dinamicamente a partir do contexto pré-reunião e do tipo de projeto configurado.

---

## 3. Schema do Banco de Dados (Supabase)

### `projects`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | `uuid PK` | Identificador único |
| `name` | `text NOT NULL` | Nome do projeto |
| `client` | `text NOT NULL` | Nome do cliente |
| `description` | `text` | Descrição do escopo |
| `project_type` | `text` | Enum: `bi`, `ml`, `data_engineering`, `automation`, `integration`, `science` |
| `gemini_api_key` | `text (encrypted)` | Chave Gemini por projeto — armazenar via Supabase Vault |
| `budget_usd` | `numeric` | Limite de gasto com LLM em USD (`null` = sem limite) |
| `data_maturity_score` | `int2` | Escala 1–5: maturidade técnica do cliente |
| `pre_meeting_context` | `text` | O que o comercial já sabe antes da reunião |
| `meeting_url` | `text` | Link da reunião (Google Meet etc.) |
| `source` | `text` | Enum: `taqtic`, `recall` — fonte de transcrição padrão |
| `question_ttl_seconds` | `int4` | TTL padrão das perguntas na fila (default: 30) |
| `created_at` | `timestamptz` | Data de criação |
| `updated_at` | `timestamptz` | Última atualização |

### `sessions`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | `uuid PK` | Identificador único |
| `project_id` | `uuid FK → projects` | Projeto relacionado |
| `meeting_url` | `text` | URL da reunião desta sessão (pode sobrescrever a do projeto) |
| `source` | `text` | `taqtic` ou `recall` |
| `status` | `text` | Enum: `active`, `finished`, `cancelled` |
| `tokens_used` | `int4` | Total de tokens consumidos |
| `cost_usd` | `numeric` | Custo real da sessão em USD |
| `started_at` | `timestamptz` | Início da sessão |
| `finished_at` | `timestamptz` | Fim da sessão |

### `questions`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | `uuid PK` | Identificador único |
| `session_id` | `uuid FK → sessions` | Sessão relacionada |
| `text` | `text NOT NULL` | Texto da pergunta |
| `block` | `text` | Bloco temático: `negocio`, `eng_dados`, `visualizacao`, `ciencia_dados`, `automacao`, `integracao`, `consumo`, `parceria` |
| `source` | `text` | Enum: `auto` (gerada pelo planner), `manual` (solicitada pelo usuário) |
| `status` | `text` | Enum: `queued`, `pinned`, `dismissed`, `used` |
| `generated_at` | `timestamptz` | Quando foi gerada |
| `expires_at` | `timestamptz` | Quando some da fila se não interagida |

### `red_flags`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | `uuid PK` | Identificador único |
| `session_id` | `uuid FK → sessions` | Sessão relacionada |
| `text` | `text NOT NULL` | Descrição do red flag |
| `severity` | `text` | Enum: `warning`, `critical` |
| `evidence` | `text` | Trecho da transcrição que gerou o alerta |
| `detected_at` | `timestamptz` | Quando foi detectado |

### `coverage_snapshots`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | `uuid PK` | Identificador único |
| `session_id` | `uuid FK → sessions` | Sessão relacionada |
| `coverage_json` | `jsonb` | Estado completo das áreas: `{area: {status, score, notes}}` |
| `snapshot_at` | `timestamptz` | Quando foi registrado |

### `reports`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | `uuid PK` | Identificador único |
| `session_id` | `uuid FK → sessions` | Sessão relacionada |
| `markdown_content` | `text` | Conteúdo do relatório em Markdown |
| `cost_usd` | `numeric` | Custo desta chamada LLM |
| `generated_at` | `timestamptz` | Quando foi gerado |

### `question_bank`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | `uuid PK` | Identificador único |
| `block` | `text NOT NULL` | Bloco temático |
| `project_types` | `text[]` | Tipos de projeto onde esta pergunta é relevante |
| `text` | `text NOT NULL` | Texto da pergunta |
| `priority` | `int2` | `1` = alta, `2` = média, `3` = baixa |

### `session_prompts` *(tabela auxiliar)*

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | `uuid PK` | Identificador único |
| `session_id` | `uuid FK → sessions` | Sessão relacionada |
| `agent` | `text` | Nome do agente: `coverage_classifier`, `red_flag_detector`, `question_planner`, `diagnostic_agent` |
| `prompt_text` | `text` | Prompt gerado para esta sessão |
| `created_at` | `timestamptz` | Quando foi gerado |

---

## 4. Features

---

### F1 — Configuração de Projeto

**O quê:** Tela de criação e edição de projeto com todos os campos necessários para configurar uma sessão de diagnóstico. Ponto de entrada obrigatório antes de qualquer reunião.

#### Campos da tela

| Campo | Tipo | Obrigatório | Notas |
|-------|------|------------|-------|
| Nome do projeto | text input | Sim | Ex: Pipeline de Vendas |
| Cliente | text input | Sim | Ex: Empresa XYZ |
| Descrição | textarea | Não | Breve descrição do escopo |
| Tipo de projeto | select | Sim | BI, ML, Eng. de Dados, Automação, Integração, Ciência de Dados |
| Data Maturity Score | slider 1–5 | Sim | Ver F10 para definição detalhada |
| Contexto pré-reunião | textarea (grande) | Não | O que o comercial já sabe do cliente |
| URL da reunião | text input | Não | Pré-preenche o campo de sessão |
| Fonte de transcrição | radio: taqtic / recall | Sim | Padrão: `taqtic` |
| Chave de API Gemini | password input | Sim | Armazenada via Supabase Vault |
| Budget de IA (USD) | numeric input | Não | Deixar em branco = sem limite |
| TTL padrão de perguntas (s) | numeric input | Não | Padrão: 30 segundos |

#### Comportamento

- Projeto criado vai para a lista inicial (home screen).
- Projetos com sessões ativas aparecem com badge verde "ao vivo".
- Edição disponível a qualquer momento — mudanças não afetam sessões já encerradas.
- Chave de API Gemini é mascarada após salvar; para rever, usuário deve redigitar.

---

### F2 — Setup de Sessão / Reunião

**O quê:** Tela intermediária entre a página do projeto e o monitoramento ao vivo. Permite confirmar/ajustar configurações específicas desta reunião antes de iniciar.

#### Campos

- URL da reunião (pré-preenchida do projeto, editável)
- Fonte de transcrição (pré-preenchida, editável)
- Contexto adicional desta reunião (complementa o contexto do projeto)
- Budget específico desta sessão (herda do projeto se não preenchido)

#### Fluxo

1. Usuário clica em "Nova sessão" no projeto
2. Tela de setup exibe campos pré-preenchidos
3. Usuário confirma — backend cria registro em `sessions` com `status='active'`
4. Se `source=taqtic`: backend sobe WebhookServer e exibe URL pública (ver F9)
5. Se `source=recall`: backend faz POST na API Recall.ai com a `meeting_url`
6. Redireciona para tela de monitoramento (F5)

---

### F3 — Geração Dinâmica de Prompts

**O quê:** Sistema que gera prompts específicos para cada agente LLM com base no tipo de projeto, contexto pré-reunião e Data Maturity Score. Substitui os prompts fixos de `prompts.py`.

**Por quê:** Na v1, o `SYSTEM_PROMPT` e o `CLASSIFIER_SYSTEM_PROMPT` são constantes em `prompts.py` — o sistema não sabe nada sobre o cliente antes de a reunião começar. Um diagnóstico de projeto BI para um cliente nível 1 de maturidade exige linguagem e focos completamente diferentes de um projeto ML para um cliente nível 4.

#### Como funciona

1. No início de cada sessão, o `PromptBuilder` recebe: tipo de projeto, contexto pré-reunião, Data Maturity Score e banco de perguntas relevantes.
2. Gera um system prompt personalizado para cada agente da sessão.
3. Os prompts gerados são armazenados em `session_prompts` para reprodutibilidade e debugging.
4. Durante a sessão, os agentes usam seus prompts gerados — não as constantes de `prompts.py`.

#### Inputs do PromptBuilder por agente

| Agente | O que recebe | Como personaliza |
|--------|-------------|-----------------|
| `CoverageClassifier` | Tipo de projeto + DMS | Ativa áreas relevantes ao tipo, desativa irrelevantes, ajusta criticidade por maturidade |
| `RedFlagDetector` | Contexto pré-reunião + DMS | Inclui red flags específicos para o contexto já conhecido, calibra sensibilidade pelo DMS |
| `QuestionPlanner` | Banco de perguntas filtrado por tipo + DMS + contexto | Prioriza perguntas críticas para o tipo, adapta complexidade técnica ao DMS |
| `DiagnosticAgent` | Tudo acima + tipo de projeto | Conduz entrevista com foco nas áreas de maior risco para aquele tipo |

---

### F4 — Banco de Perguntas por Tipo

**O quê:** Base de perguntas mapeadas por bloco temático e tipo de projeto, injetada no `QuestionPlanner` como guia (não como script fixo). O agente pode e deve gerar perguntas além das mapeadas.

#### Blocos e perguntas mapeadas

| Bloco | Perguntas mapeadas |
|-------|--------------------|
| **Negócio** | Dor principal · Decisão que precisa ser tomada · Tipo de usuário final · Tipo de entrega esperada |
| **Engenharia de Dados** | Nº de fontes · Tipo de fontes · Qualidade dos dados · Frequência de atualização · Processo manual? · Integração com sistemas · Já possui DW? |
| **Visualização** | Precisa dashboard? · Complexidade · Nº de KPIs · Nível de interação · Frequência de uso · KPIs já definidos? |
| **Ciência de Dados** | Tipo de análise · Precisa IA? · Volume de dados · Base de conhecimento disponível · Tipo de agente (se IA) |
| **Automação** | Existe processo manual a automatizar? · Nº de etapas · Regras de decisão (if/else) · O fluxo pode falhar? · Reprocessamento automático? · Visualização do fluxo (ex: n8n)? |
| **Integração** | Nº de sistemas · Sistemas envolvidos · APIs documentadas? · APIs estáveis? · Autenticação complexa? · Sistemas organizados ou caóticos? |
| **Consumo / Interface** | Integração WhatsApp? · Interface customizada? · Sistema responde em tempo real? |
| **Parceria** | Prazo · Nível de urgência · Ponto focal definido? |

> O `QuestionPlanner` recebe as perguntas relevantes ao tipo de projeto como contexto adicional. O prompt instrui o agente a priorizá-las como ponto de partida — não como lista exaustiva.

---

### F5 — Tela de Monitoramento

**O quê:** Interface principal durante a reunião ao vivo. Layout em 3 colunas com atualização em tempo real via WebSocket.

#### Layout

| Coluna | Conteúdo | Largura |
|--------|---------|---------|
| **Esquerda — Cobertura** | Lista de áreas de risco com status (vermelho/amarelo/verde/cinza) e barra de progresso por área | 220px fixo |
| **Centro — Ao vivo** | Transcrição ao vivo + alertas (red flags) | flex: 1 |
| **Direita — Perguntas** | Fila de perguntas novas + seção de perguntas fixadas + botão "Gerar agora" | 280px fixo |

#### Topbar

- Nome do projeto + cliente
- Status de conexão (ponto verde animado + "ao vivo")
- Timer da sessão (HH:MM:SS)

#### Budget bar (sempre visível abaixo da topbar)

- Barra de progresso colorida: verde < 60%, amarelo 60–80%, vermelho > 80%
- Valores: `$X.XXX consumido / $Y.YYY limite`
- Texto de status: `"relatório custa ~$X.XXX · saldo suficiente"` ou alerta de saldo insuficiente
- Atualizada a cada tick do `_render_task` (250ms)

#### Ações disponíveis

| Ação | Tecla (terminal) | Botão (web) | Comportamento |
|------|-----------------|-------------|---------------|
| Gerar perguntas | P | Botão primário verde | Chama `QuestionPlanner` imediatamente, independente do ciclo automático |
| Gerar relatório | R | Botão secundário | Verifica budget; se suficiente, gera e exibe modal com relatório |
| Forçar classificação | S | Botão Sync | Dispara `_coverage_task` imediatamente |
| Encerrar sessão | Q | Botão vermelho | Confirma, salva sessão como `finished`, redireciona para histórico |

---

### F6 — Fila de Perguntas (pin / dismiss / TTL)

**O quê:** Sistema de gerenciamento de perguntas geradas durante a sessão, com fila temporária, fixação e descarte.

#### Estados de uma pergunta

| Estado | Descrição | Origem |
|--------|-----------|--------|
| `queued` | Na fila, com barra de TTL decrescendo. Se nada for feito, some. | Gerada pelo `QuestionPlanner` |
| `pinned` | Fixada pelo usuário. Fica na seção "Fixadas" sem expirar. | Usuário clica em 📌 |
| `dismissed` | Descartada pelo usuário. Some imediatamente com animação. | Usuário clica em ✕ |
| `used` | Marcada como usada. Registrada para anti-repetição no planner. | Usuário marca como feita |

#### Comportamento da fila

- Cada pergunta nasce no estado `queued` com `expires_at = now() + TTL`.
- TTL padrão configurável no projeto (default: 30s). Exibido como barra colorida embaixo do card.
- Barra: verde > 60% do TTL, laranja 30–60%, vermelha < 30%.
- Quando `expires_at` passa, o card some com animação de fade + slide.
- Máximo de 5 cards na fila ao mesmo tempo — se chegar o 6º, o mais antigo é descartado.
- Perguntas fixadas ficam numa seção separada acima da fila, sem limite de quantidade.

#### Anti-repetição

O `QuestionPlanner` recebe como contexto as últimas 3 perguntas geradas (`queued` + `pinned` + `used`) para evitar repetições. Perguntas `dismissed` não entram no contexto de anti-repetição.

---

### F7 — Controle de Budget em Tempo Real

**O quê:** Sistema de monitoramento e controle de custo LLM por sessão, com estimativa de custo de relatório e parada automática quando o saldo não cobre o relatório.

#### Preços de referência (Gemini)

| Modelo | Input (por 1k tokens) | Output (por 1k tokens) |
|--------|----------------------|------------------------|
| Gemini 1.5 Flash | $0.000075 | $0.000300 |
| Gemini 1.5 Pro | $0.001250 | $0.005000 |
| Gemini 2.0 Flash | $0.000100 | $0.000400 |

O `TokenCounter` acompanha tokens enviados e recebidos por chamada. O custo é acumulado em `sessions.cost_usd` em tempo real.

#### Lógica de parada

1. A cada tick do `_coverage_task`, o sistema verifica: `budget_remaining >= custo_estimado_relatorio`?
2. Se sim: continua normalmente.
3. Se não: para `_coverage_task` e `_red_flag_task`. Exibe alerta na budget bar. Botão de relatório continua ativo.
4. O custo estimado de relatório é calculado com base no tamanho atual da transcrição × fator de saída médio, com margem de 20%.

> **v2.0 (abordagem simples):** estimativa estática baseada em tokens atuais do buffer × fator configurável. Abordagem dinâmica com aprendizado por tipo de projeto é iteração futura.

---

### F8 — Persistência de Sessão e Histórico

**O quê:** Cada sessão é salva no Supabase em tempo real. Após encerrada, fica acessível no histórico do projeto com relatório, alertas, cobertura final e custo real.

#### O que é salvo

- Transcrição completa (chunks em tabela `transcript_chunks`)
- Todos os snapshots de coverage (a cada classificação)
- Todos os red flags emitidos
- Todas as perguntas geradas com status final
- Relatório(s) gerado(s)
- Tokens usados e custo real da sessão

#### Tela de histórico

- Lista de sessões por projeto, ordenada por data (mais recente primeiro)
- Card de sessão: data, duração, custo, status de cobertura final, badge de nº de red flags
- Ao clicar: exibe relatório completo, timeline de alertas, evolução de cobertura

---

### F9 — Exposição de URL (Tunnel)

**O quê:** O `WebhookServer` ouve em `localhost:8765`. Para funcionar com Taqtic em qualquer rede, precisa de uma URL pública. O sistema configura e exibe essa URL automaticamente.

#### Fluxo

1. Sessão inicia com `source=taqtic`
2. Backend verifica se `cloudflared` ou `ngrok` está disponível (verifica PATH)
3. Sobe tunnel apontando para `localhost:8765`
4. URL pública é exibida na tela de setup e no topbar do monitoramento
5. Usuário copia a URL e configura na extensão Taqtic
6. Tunnel é derrubado automaticamente quando a sessão é encerrada

#### Tooling preferencial

- **cloudflared** (preferencial): gratuito, sem conta obrigatória, URLs temporárias.
  ```bash
  cloudflared tunnel --url http://localhost:8765
  ```
- **ngrok** (alternativa): requer conta free; URLs persistentes no plano pago.

---

### F10 — Data Maturity Score

**O quê:** Escala 1–5 preenchida pelo comercial no diagnóstico inicial do projeto, que condiciona o que pode ser vendido e calibra o comportamento dos agentes.

#### Definição dos níveis

| Nível | Perfil do cliente | O que condiciona |
|-------|------------------|-----------------|
| **1 — Inicial** | Sem processos de dados. Dados em planilhas manuais, sem integração. | Projetos simples de coleta e organização. Não vender ML ou IA. |
| **2 — Gerenciado** | Dados centralizados mas sem qualidade. ETL manual ou básico. | Projetos de ETL simples e dashboards básicos. BI sem modelagem complexa. |
| **3 — Definido** | Pipelines funcionando, alguma qualidade de dados, DW básico. | BI avançado, automações, primeiros modelos preditivos simples. |
| **4 — Quantificado** | Dados confiáveis, pipelines monitorados, KPIs consolidados. | ML, ciência de dados, agentes de IA com base sólida. |
| **5 — Otimizado** | Dados como ativo estratégico. Data mesh, observabilidade, governança. | Projetos de ponta: LLMs em produção, RAG, data contracts, lakehouse. |

#### Como o DMS afeta os agentes

- **CoverageClassifier:** níveis 1–2 priorizam qualidade de dados e processos manuais; níveis 4–5 priorizam observabilidade, governança, escala.
- **RedFlagDetector:** calibra sensibilidade — no nível 1, falta de DW não é red flag (é esperado); no nível 4, seria.
- **QuestionPlanner:** adapta vocabulário técnico ao nível. Não pergunta sobre data contracts para um cliente nível 1.
- **ReportGenerator:** inclui seção de "maturidade atual vs maturidade necessária para o projeto" no relatório final.

---

## 5. Contratos de API (FastAPI)

| Método | Endpoint | Body / Params | Response |
|--------|----------|---------------|----------|
| `GET` | `/projects` | — | `[Project]` |
| `POST` | `/projects` | `ProjectCreate` | `Project` |
| `GET` | `/projects/:id` | — | `Project + sessions[]` |
| `PUT` | `/projects/:id` | `ProjectUpdate` | `Project` |
| `DELETE` | `/projects/:id` | — | `204` |
| `POST` | `/sessions` | `SessionCreate {project_id, meeting_url?, source?}` | `Session` |
| `GET` | `/sessions/:id` | — | `Session + questions[] + red_flags[] + report?` |
| `POST` | `/sessions/:id/finish` | — | `Session` |
| `POST` | `/sessions/:id/questions/generate` | — | `[Question]` (chama QuestionPlanner) |
| `POST` | `/sessions/:id/report` | — | `Report` (chama ReportGenerator) |
| `PATCH` | `/questions/:id` | `{status: pinned\|dismissed\|used}` | `Question` |
| `GET` | `/question-bank` | `?project_type=&block=` | `[QuestionBankItem]` |
| `POST` | `/webhook/taqtic` | `TranscriptChunk` | `202` |
| `POST` | `/webhook/recall` | `RecallPayload` | `202` |

---

## 6. Eventos WebSocket

**Conexão:** `ws://localhost:8000/ws/{session_id}`

### 6.1 Backend → Frontend

| Evento | Payload (campos principais) | Frequência |
|--------|----------------------------|------------|
| `coverage_update` | `{areas: [{name, status, score}], presets_active: []}` | A cada classificação (~30s) |
| `red_flag` | `{id, text, severity, evidence, detected_at}` | Quando detectado |
| `question_new` | `{id, text, block, source, expires_at}` | Quando gerada |
| `question_expired` | `{id}` | Quando TTL esgota |
| `transcript_chunk` | `{speaker?, text, timestamp}` | Por chunk |
| `budget_update` | `{used_usd, limit_usd, estimated_report_cost, status}` | A cada 250ms |
| `session_status` | `{status, tokens_used, cost_usd}` | A cada 1s |
| `error` | `{code, message}` | Quando ocorre erro |

### 6.2 Frontend → Backend

| Evento | Payload | Ação |
|--------|---------|------|
| `generate_questions` | — | Dispara `QuestionPlanner` imediatamente |
| `force_classify` | — | Dispara `_coverage_task` imediatamente |
| `pin_question` | `{question_id}` | Atualiza status → `pinned` no BD |
| `dismiss_question` | `{question_id}` | Atualiza status → `dismissed` no BD |
| `use_question` | `{question_id}` | Atualiza status → `used` no BD |
| `generate_report` | — | Verifica budget e gera relatório |
| `finish_session` | — | Encerra sessão e salva estado final |

---

## 7. Ordem de Implementação

| Fase | Feature | Dependências | Entregável verificável |
|------|---------|-------------|----------------------|
| 1 | F1 — Config de Projeto + Supabase schema | — | Criar/listar/editar projetos na UI |
| 2 | F2 — Setup de Sessão | F1 | Criar sessão, ver na lista do projeto |
| 3 | F9 — Tunnel (URL exposure) | F2 | URL pública exibida na tela de setup |
| 4 | F4 — Banco de Perguntas | F1 | Perguntas corretas injetadas por tipo |
| 5 | F3 — Geração Dinâmica de Prompts | F1, F4 | Prompts diferentes por tipo de projeto |
| 6 | F5 — Tela de Monitoramento (base) | F2, F3, WebSocket | Cobertura + transcrição + alertas ao vivo |
| 7 | F6 — Fila de Perguntas | F5 | Pin/dismiss/TTL funcionando |
| 8 | F7 — Controle de Budget | F5 | Budget bar em tempo real, parada automática |
| 9 | F8 — Persistência + Histórico | F5, F6, F7 | Ver relatório e timeline de sessão encerrada |
| 10 | F10 — Data Maturity Score | F1, F3 | DMS afeta prompts e relatório final |

---

## 8. Riscos e Decisões em Aberto

| Item | Descrição | Decisão sugerida |
|------|-----------|-----------------|
| **Qualidade dos prompts dinâmicos** | Prompts gerados podem ser piores que os prompts fixos cuidadosamente ajustados na v1 | Manter prompts v1 como fallback; testar prompts dinâmicos em paralelo com A/B antes de substituir completamente |
| **Custo de estimativa de relatório** | Estimativa estática pode ser muito errada, cortando sessão cedo ou deixando sem saldo | Logar custo real de cada relatório por tipo de projeto; após 10 sessões, substituir estimativa estática pela média observada |
| **Segurança da chave de API** | Chave Gemini armazenada no Supabase — precisa de encriptação na coluna ou vault | Usar Supabase Vault (pgsodium) para a coluna `gemini_api_key`; nunca expor no frontend |
| **Conflito v1 / v2** | Sistema v1 usa terminal puro; v2 adiciona UI. Coexistência pode ser confusa | Manter `main.py` como entry point; `--ui web` ativa o novo frontend; modo terminal permanece para uso local |
| **TTL de perguntas** | TTL muito curto frustra o comercial; muito longo enche a fila | Configurável por projeto; default de 30s baseado em uso real; ajustar após primeiros testes |
| **Latência do tunnel** | cloudflared pode adicionar latência que atrasa a transcrição | Medir round-trip time com Taqtic antes de lançar; threshold aceitável: < 500ms |

---
## 9. Migração v1 → v2 — o que muda em cada arquivo

| Arquivo atual | Ação | Detalhe |
|---------------|------|---------|
| `prompts.py` | Transformar | Constantes viram classe `PromptBuilder` com método `build(agent, project_config) -> str`. Manter constantes v1 como fallback interno. |
| `config.py` | Estender | Adicionar `ProjectConfig` que herda de `Config`. Chave de projeto sobrescreve env var; env var é fallback. |
| `conversation.py` | Estender | `ConversationManager` recebe `session_id` opcional. Se presente, persiste chunks em `transcript_chunks` no Supabase a cada append. |
| `report.py` | Estender | `ReportGenerator.save()` continua salvando arquivo local + salva em `reports` no Supabase quando `session_id` disponível. |
| `llm/gemini_client.py` | Refatorar | Migrar de `google-generativeai` (deprecated) para `google.genai`. Sem mudança de interface — `LLMClient.generate()` permanece igual. |
| `agent.py` | Estender | Recebe `prompt_builder` por injeção. Usa prompt dinâmico se `project_config` disponível; fallback para `SYSTEM_PROMPT` constante. |
| `main.py` | Estender | Adicionar `--ui web` que sobe FastAPI + WebSocket. Modo CLI permanece intacto. |
| `requirements.txt` | Atualizar | Adicionar `fastapi`, `uvicorn`, `supabase-py`, `google-genai`. Remover `google-generativeai`. |
*Agente Diagnóstico · SDD v2.0 · CITi Subárea de Dados · Maio 2026*