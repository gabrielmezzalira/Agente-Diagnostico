-- Migration: 20260922000000_add_lens_tagging.sql
-- Adiciona a coluna lens às tabelas questions e red_flags para etiquetar de qual
-- lente (produto | dados) veio cada pergunta/alerta nas sessões de discovery.
-- Aditiva e idempotente (ADD COLUMN IF NOT EXISTS), nullable e SEM DEFAULT:
-- linhas antigas e todas as sessões de sales ficam com lens NULL, sem backfill
-- manual e sem alterar comportamento existente (D-18/D-24/D-03).
-- A validação do valor {produto,dados} fica no código (allowlist), seguindo o
-- padrão das demais colunas enum-like do repo (project_type/source/status/mode),
-- sem CHECK e sem ALTER TYPE (D-22).

ALTER TABLE questions ADD COLUMN IF NOT EXISTS lens text;

ALTER TABLE red_flags ADD COLUMN IF NOT EXISTS lens text;

COMMENT ON COLUMN questions.lens IS
    'Lente de origem da pergunta (discovery apenas): produto | dados. NULL no modo sales e em linhas antigas — sem backfill.';

COMMENT ON COLUMN red_flags.lens IS
    'Lente de origem do alerta (discovery apenas): produto | dados. NULL no modo sales e em linhas antigas — sem backfill.';

-- Amplia (apenas na documentação) os valores válidos de session_prompts.agent.
-- A coluna é text NOT NULL sem CHECK/enum nativo, então os novos valores
-- question_planner_produto/question_planner_dados já podem ser gravados hoje —
-- só o COMMENT muda, sem ALTER TYPE (D-23).
COMMENT ON COLUMN session_prompts.agent IS
    'Agente que gerou o prompt: coverage_classifier | red_flag_detector | question_planner | diagnostic_agent (sales), mais question_planner_produto | question_planner_dados (discovery, split por lente).';
