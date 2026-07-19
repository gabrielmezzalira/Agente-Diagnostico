-- =============================================================================
-- Migration: 20260719000000_precificador_schema.sql
-- Agente Precificador — Foundation schema
--
-- Cria 4 tabelas para o módulo Precificador e adiciona 3 colunas LLM ao
-- projects. As funções Vault (vault_create_secret / vault_delete_secret) já
-- foram definidas na migration 20260524000000_initial_schema.sql.
--
-- Ordem de criação respeita dependências de FK:
--   1. pricings (FK → projects)
--   2. pricing_features (FK → pricings)
--   3. pricing_history (FK → projects + pricings)
--   4. pricing_chat_messages (FK → pricings)
-- =============================================================================


-- =============================================================================
-- 1. Extend projects with LLM config columns
-- =============================================================================
ALTER TABLE projects ADD COLUMN IF NOT EXISTS pricing_llm_provider TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS pricing_llm_model TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS pricing_api_key_secret_id UUID;

COMMENT ON COLUMN projects.pricing_llm_provider IS
    'Provider do LLM do Precificador: openai | anthropic | google';

COMMENT ON COLUMN projects.pricing_llm_model IS
    'Nome do modelo LLM do Precificador (ex: gpt-4o, claude-3-5-sonnet-20241022, gemini-2.0-flash)';

COMMENT ON COLUMN projects.pricing_api_key_secret_id IS
    'UUID do secret da chave de API do LLM do Precificador — armazenado no Supabase Vault. Nunca em texto plano.';


-- =============================================================================
-- 2. pricings
-- =============================================================================
CREATE TABLE IF NOT EXISTS pricings (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id           uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    status               text DEFAULT 'draft',      -- enum: draft, approved
    start_date           date,
    num_analysts         int,
    hours_per_day        numeric,
    ticket_price         numeric,
    extra_calendar_days  int DEFAULT 0,
    created_at           timestamptz DEFAULT now(),
    updated_at           timestamptz DEFAULT now()
);

COMMENT ON COLUMN pricings.status IS 'draft | approved — precificações aprovadas não podem ser alteradas nem deletadas';
COMMENT ON COLUMN pricings.extra_calendar_days IS 'Dias corridos extras a somar ao cálculo (ex: buffer de entrega)';

CREATE OR REPLACE TRIGGER trg_pricings_updated_at
    BEFORE UPDATE ON pricings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- =============================================================================
-- 3. pricing_features
-- =============================================================================
CREATE TABLE IF NOT EXISTS pricing_features (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pricing_id        uuid NOT NULL REFERENCES pricings(id) ON DELETE CASCADE,
    bloco             text,
    funcionalidade    text,
    horas             numeric,
    citi_responsible  boolean DEFAULT true,   -- flag visual — não afeta cálculo
    ordem             int,
    created_at        timestamptz DEFAULT now()
);

COMMENT ON COLUMN pricing_features.citi_responsible IS 'Flag visual (coluna CITI?) — não entra nas fórmulas de cálculo';


-- =============================================================================
-- 4. pricing_history — snapshot imutável de precificações aprovadas
-- =============================================================================
CREATE TABLE IF NOT EXISTS pricing_history (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    pricing_id  uuid NOT NULL REFERENCES pricings(id),
    snapshot    jsonb,   -- {project_type, inputs{}, features[], outputs{}}
    approved_at timestamptz DEFAULT now()
);

COMMENT ON COLUMN pricing_history.snapshot IS
    'Snapshot imutável em JSONB: {project_type, inputs, features, outputs calculados}';


-- =============================================================================
-- 5. pricing_chat_messages — criada agora, populada na Phase 13 (chatbot)
-- =============================================================================
CREATE TABLE IF NOT EXISTS pricing_chat_messages (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pricing_id  uuid NOT NULL REFERENCES pricings(id) ON DELETE CASCADE,
    role        text,       -- user | assistant | tool
    content     text,
    tool_calls  jsonb,
    created_at  timestamptz DEFAULT now()
);


-- =============================================================================
-- Índices
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_pricings_project_id
    ON pricings(project_id);

CREATE INDEX IF NOT EXISTS idx_pricing_features_pricing_id
    ON pricing_features(pricing_id);

CREATE INDEX IF NOT EXISTS idx_pricing_history_project_id
    ON pricing_history(project_id);

CREATE INDEX IF NOT EXISTS idx_pricing_chat_messages_pricing_id
    ON pricing_chat_messages(pricing_id);
