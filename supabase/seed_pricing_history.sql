-- Seed: 7 approved pricings for LLM history context (Phase 12). Run manually in Supabase SQL editor.
--
-- NOTA: Os UUIDs de project_id e pricing_id abaixo são fixos e servem apenas como
-- dados de seed. Eles NÃO são FKs reais — as tabelas projects e pricings podem não
-- conter esses IDs. O objetivo é popular pricing_history com snapshots realistas para
-- que o LLM tenha contexto histórico durante sugestões de precificação.
-- Use ON CONFLICT DO NOTHING para idempotência (execute quantas vezes quiser).

INSERT INTO pricing_history (id, project_id, pricing_id, snapshot, approved_at)
VALUES (
  '00000000-0000-0000-0001-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0002-000000000001',
  '{
    "project_type": "bi",
    "inputs": {
      "start_date": "2026-01-10",
      "num_analysts": 2,
      "hours_per_day": 3,
      "ticket_price": 8000,
      "extra_calendar_days": 0
    },
    "features": [
      {"bloco": "Engenharia de Dados", "funcionalidade": "Ingestão de dados do ERP", "horas": 20},
      {"bloco": "Engenharia de Dados", "funcionalidade": "Modelagem dimensional (star schema)", "horas": 16},
      {"bloco": "Visualização", "funcionalidade": "Dashboard de vendas por região", "horas": 12},
      {"bloco": "Visualização", "funcionalidade": "Dashboard de metas vs realizado", "horas": 8},
      {"bloco": "Parceria", "funcionalidade": "Treinamento de usuários finais", "horas": 4}
    ],
    "outputs": {
      "preco_total": "9600",
      "dias_corridos": "42",
      "dias_uteis": "25",
      "total_horas": "60"
    }
  }'::jsonb,
  '2026-01-15 10:00:00+00'
)
ON CONFLICT DO NOTHING;

INSERT INTO pricing_history (id, project_id, pricing_id, snapshot, approved_at)
VALUES (
  '00000000-0000-0000-0001-000000000002',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0002-000000000002',
  '{
    "project_type": "bi",
    "inputs": {
      "start_date": "2026-02-03",
      "num_analysts": 3,
      "hours_per_day": 4,
      "ticket_price": 12000,
      "extra_calendar_days": 5
    },
    "features": [
      {"bloco": "Engenharia de Dados", "funcionalidade": "Extração de dados do sistema financeiro legado", "horas": 30},
      {"bloco": "Engenharia de Dados", "funcionalidade": "Pipeline de carga incremental diária", "horas": 20},
      {"bloco": "Visualização", "funcionalidade": "Painel de DRE interativo", "horas": 24},
      {"bloco": "Visualização", "funcionalidade": "Relatório de fluxo de caixa com drill-down", "horas": 16},
      {"bloco": "Visualização", "funcionalidade": "Alertas de KPI por e-mail", "horas": 10},
      {"bloco": "Parceria", "funcionalidade": "Homologação com área financeira", "horas": 8}
    ],
    "outputs": {
      "preco_total": "20400",
      "dias_corridos": "51",
      "dias_uteis": "33",
      "total_horas": "108"
    }
  }'::jsonb,
  '2026-02-10 14:30:00+00'
)
ON CONFLICT DO NOTHING;

INSERT INTO pricing_history (id, project_id, pricing_id, snapshot, approved_at)
VALUES (
  '00000000-0000-0000-0001-000000000003',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0002-000000000003',
  '{
    "project_type": "data_engineering",
    "inputs": {
      "start_date": "2026-02-17",
      "num_analysts": 2,
      "hours_per_day": 4,
      "ticket_price": 10000,
      "extra_calendar_days": 3
    },
    "features": [
      {"bloco": "Engenharia de Dados", "funcionalidade": "Mapeamento e catalogação de fontes de dados", "horas": 8},
      {"bloco": "Engenharia de Dados", "funcionalidade": "Ingestão de 5 fontes (SQL Server, planilhas, API REST)", "horas": 35},
      {"bloco": "Engenharia de Dados", "funcionalidade": "Camada de transformação com dbt", "horas": 28},
      {"bloco": "Engenharia de Dados", "funcionalidade": "Orquestração com Airflow (DAGs diárias)", "horas": 20},
      {"bloco": "Engenharia de Dados", "funcionalidade": "Monitoramento de qualidade de dados", "horas": 12},
      {"bloco": "Parceria", "funcionalidade": "Documentação técnica do pipeline", "horas": 6}
    ],
    "outputs": {
      "preco_total": "17500",
      "dias_corridos": "52",
      "dias_uteis": "34",
      "total_horas": "109"
    }
  }'::jsonb,
  '2026-02-25 09:15:00+00'
)
ON CONFLICT DO NOTHING;

INSERT INTO pricing_history (id, project_id, pricing_id, snapshot, approved_at)
VALUES (
  '00000000-0000-0000-0001-000000000004',
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0002-000000000004',
  '{
    "project_type": "data_engineering",
    "inputs": {
      "start_date": "2026-03-01",
      "num_analysts": 3,
      "hours_per_day": 3,
      "ticket_price": 9500,
      "extra_calendar_days": 0
    },
    "features": [
      {"bloco": "Engenharia de Dados", "funcionalidade": "Levantamento e modelagem do data warehouse", "horas": 16},
      {"bloco": "Engenharia de Dados", "funcionalidade": "Pipeline de ingestão do ERP (SAP B1)", "horas": 24},
      {"bloco": "Engenharia de Dados", "funcionalidade": "Pipeline de ingestão do CRM (Salesforce)", "horas": 20},
      {"bloco": "Engenharia de Dados", "funcionalidade": "Camada gold com métricas consolidadas", "horas": 18},
      {"bloco": "Integração", "funcionalidade": "Autenticação OAuth2 com Salesforce", "horas": 8},
      {"bloco": "Parceria", "funcionalidade": "Deploy em cloud (AWS S3 + Glue)", "horas": 12}
    ],
    "outputs": {
      "preco_total": "15200",
      "dias_corridos": "48",
      "dias_uteis": "33",
      "total_horas": "98"
    }
  }'::jsonb,
  '2026-03-12 16:00:00+00'
)
ON CONFLICT DO NOTHING;

INSERT INTO pricing_history (id, project_id, pricing_id, snapshot, approved_at)
VALUES (
  '00000000-0000-0000-0001-000000000005',
  '00000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0002-000000000005',
  '{
    "project_type": "ml",
    "inputs": {
      "start_date": "2026-03-15",
      "num_analysts": 2,
      "hours_per_day": 4,
      "ticket_price": 15000,
      "extra_calendar_days": 5
    },
    "features": [
      {"bloco": "Ciência de Dados", "funcionalidade": "Análise exploratória e tratamento de dados de churn", "horas": 16},
      {"bloco": "Ciência de Dados", "funcionalidade": "Feature engineering (variáveis comportamentais e transacionais)", "horas": 20},
      {"bloco": "Ciência de Dados", "funcionalidade": "Treino e comparação de modelos (XGBoost, LightGBM, Logistic)", "horas": 24},
      {"bloco": "Ciência de Dados", "funcionalidade": "Validação cruzada e análise de viés", "horas": 12},
      {"bloco": "Ciência de Dados", "funcionalidade": "API de scoring (FastAPI) com versionamento de modelo", "horas": 16},
      {"bloco": "Parceria", "funcionalidade": "Relatório de performance e plano de retraining", "horas": 8}
    ],
    "outputs": {
      "preco_total": "26250",
      "dias_corridos": "52",
      "dias_uteis": "32",
      "total_horas": "96"
    }
  }'::jsonb,
  '2026-03-28 11:00:00+00'
)
ON CONFLICT DO NOTHING;

INSERT INTO pricing_history (id, project_id, pricing_id, snapshot, approved_at)
VALUES (
  '00000000-0000-0000-0001-000000000006',
  '00000000-0000-0000-0000-000000000006',
  '00000000-0000-0000-0002-000000000006',
  '{
    "project_type": "automation",
    "inputs": {
      "start_date": "2026-04-07",
      "num_analysts": 2,
      "hours_per_day": 3,
      "ticket_price": 7000,
      "extra_calendar_days": 0
    },
    "features": [
      {"bloco": "Automação", "funcionalidade": "Mapeamento e documentação do processo manual de relatórios", "horas": 6},
      {"bloco": "Automação", "funcionalidade": "Automação de extração de dados de 3 planilhas via Python", "horas": 14},
      {"bloco": "Automação", "funcionalidade": "Geração automática de PDF com relatório consolidado", "horas": 12},
      {"bloco": "Automação", "funcionalidade": "Agendamento via cron job (geração toda segunda às 8h)", "horas": 4},
      {"bloco": "Automação", "funcionalidade": "Envio automático por e-mail para lista de destinatários", "horas": 6},
      {"bloco": "Parceria", "funcionalidade": "Testes de integração e homologação com área operacional", "horas": 6}
    ],
    "outputs": {
      "preco_total": "9800",
      "dias_corridos": "42",
      "dias_uteis": "25",
      "total_horas": "48"
    }
  }'::jsonb,
  '2026-04-15 13:45:00+00'
)
ON CONFLICT DO NOTHING;

INSERT INTO pricing_history (id, project_id, pricing_id, snapshot, approved_at)
VALUES (
  '00000000-0000-0000-0001-000000000007',
  '00000000-0000-0000-0000-000000000007',
  '00000000-0000-0000-0002-000000000007',
  '{
    "project_type": "integration",
    "inputs": {
      "start_date": "2026-04-20",
      "num_analysts": 2,
      "hours_per_day": 4,
      "ticket_price": 11000,
      "extra_calendar_days": 3
    },
    "features": [
      {"bloco": "Integração", "funcionalidade": "Análise de APIs do ERP (Protheus) e CRM (HubSpot)", "horas": 10},
      {"bloco": "Integração", "funcionalidade": "Mapeamento de entidades e regras de sincronização", "horas": 8},
      {"bloco": "Integração", "funcionalidade": "Middleware de integração bidirecional ERP-CRM", "horas": 32},
      {"bloco": "Integração", "funcionalidade": "Tratamento de conflitos e deduplicação de registros", "horas": 14},
      {"bloco": "Integração", "funcionalidade": "Monitoramento de falhas e retry automático", "horas": 10},
      {"bloco": "Parceria", "funcionalidade": "Testes end-to-end e aprovação com equipe de TI do cliente", "horas": 8}
    ],
    "outputs": {
      "preco_total": "22000",
      "dias_corridos": "54",
      "dias_uteis": "34",
      "total_horas": "82"
    }
  }'::jsonb,
  '2026-04-30 10:30:00+00'
)
ON CONFLICT DO NOTHING;
