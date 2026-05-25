-- =============================================================================
-- Migration: 20260524000000_initial_schema.sql
-- Agente Diagnóstico v2.0 — CITi Subárea de Dados
--
-- Cria as 9 tabelas do schema inicial.
-- Ordem de criação respeita dependências de FK:
--   1. projects (sem FK)
--   2. sessions (FK → projects)
--   3. questions (FK → sessions)
--   4. red_flags (FK → sessions)
--   5. coverage_snapshots (FK → sessions)
--   6. reports (FK → sessions)
--   7. question_bank (sem FK)
--   8. session_prompts (FK → sessions)
--   9. transcript_chunks (FK → sessions)
--
-- IMPORTANTE: gemini_api_key NÃO é armazenado como texto.
-- A coluna gemini_api_key_secret_id (uuid) armazena o ID do secret no
-- Supabase Vault (pgsodium). A aplicação chama vault.create_secret() em
-- tempo de execução — nunca diretamente nesta migration.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Pré-requisito: Vault extension
-- Certifique-se de que a extensão 'supabase_vault' está habilitada em:
-- Dashboard → Database → Extensions → supabase_vault → Enable
-- Verificação: SELECT count(*) FROM vault.secrets;
-- (deve retornar 0 sem erro, não uma exceção)
-- ---------------------------------------------------------------------------


-- =============================================================================
-- 1. projects
-- =============================================================================
CREATE TABLE IF NOT EXISTS projects (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name                     text NOT NULL,
    client                   text NOT NULL,
    description              text,
    project_type             text,                   -- enum: bi, ml, data_engineering, automation, integration, science
    gemini_api_key_secret_id uuid,                   -- referência ao Vault (vault.secrets.id) — NUNCA plaintext
    budget_usd               numeric,                -- null = sem limite de gasto
    data_maturity_score      int2,                   -- escala 1–5
    pre_meeting_context      text,
    meeting_url              text,
    source                   text DEFAULT 'taqtic',  -- enum: taqtic, recall
    question_ttl_seconds     int4 DEFAULT 30,
    created_at               timestamptz DEFAULT now(),
    updated_at               timestamptz DEFAULT now()
);

COMMENT ON COLUMN projects.gemini_api_key_secret_id IS
    'UUID do secret armazenado no Supabase Vault via vault.create_secret(). '
    'Nunca armazene a chave de API em texto plano nesta coluna.';


-- =============================================================================
-- 2. sessions
-- =============================================================================
CREATE TABLE IF NOT EXISTS sessions (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id   uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    meeting_url  text,
    source       text,                               -- enum: taqtic, recall
    status       text DEFAULT 'active',             -- enum: active, finished, cancelled
    tokens_used  int4 DEFAULT 0,
    cost_usd     numeric DEFAULT 0,
    started_at   timestamptz DEFAULT now(),
    finished_at  timestamptz
);


-- =============================================================================
-- 3. questions
-- =============================================================================
CREATE TABLE IF NOT EXISTS questions (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id   uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    text         text NOT NULL,
    block        text,                               -- enum: negocio, eng_dados, visualizacao, ciencia_dados, automacao, integracao, consumo, parceria
    source       text DEFAULT 'auto',               -- enum: auto, manual
    status       text DEFAULT 'queued',             -- enum: queued, pinned, dismissed, used
    generated_at timestamptz DEFAULT now(),
    expires_at   timestamptz
);


-- =============================================================================
-- 4. red_flags
-- =============================================================================
CREATE TABLE IF NOT EXISTS red_flags (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    text        text NOT NULL,
    severity    text,                               -- enum: warning, critical
    evidence    text,
    detected_at timestamptz DEFAULT now()
);


-- =============================================================================
-- 5. coverage_snapshots
-- =============================================================================
CREATE TABLE IF NOT EXISTS coverage_snapshots (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id    uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    coverage_json jsonb NOT NULL,                   -- {area: {status, score, notes}}
    snapshot_at   timestamptz DEFAULT now()
);


-- =============================================================================
-- 6. reports
-- =============================================================================
CREATE TABLE IF NOT EXISTS reports (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id       uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    markdown_content text NOT NULL,
    cost_usd         numeric DEFAULT 0,
    generated_at     timestamptz DEFAULT now()
);


-- =============================================================================
-- 7. question_bank
-- =============================================================================
CREATE TABLE IF NOT EXISTS question_bank (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    block         text NOT NULL,                    -- bloco temático
    project_types text[],                           -- tipos de projeto onde esta pergunta é relevante
    text          text NOT NULL,
    priority      int2 DEFAULT 2                    -- 1 = alta, 2 = média, 3 = baixa
);


-- =============================================================================
-- 8. session_prompts
-- =============================================================================
CREATE TABLE IF NOT EXISTS session_prompts (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    agent       text NOT NULL,                      -- enum: coverage_classifier, red_flag_detector, question_planner, diagnostic_agent
    prompt_text text NOT NULL,
    created_at  timestamptz DEFAULT now()
);


-- =============================================================================
-- 9. transcript_chunks
-- Schema inferido de uso: id, session_id, speaker, text, timestamp
-- Não definido explicitamente no CLAUDE.md Seção 3; schema mínimo usado.
-- Fase 9 pode adicionar colunas se necessário.
-- =============================================================================
CREATE TABLE IF NOT EXISTS transcript_chunks (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    speaker    text,                                -- nome/papel do falante (pode ser null se não identificado)
    text       text NOT NULL,                       -- conteúdo transcrito do chunk
    timestamp  timestamptz DEFAULT now()
);


-- =============================================================================
-- Índices para queries frequentes
-- =============================================================================

-- Sessões por projeto (listagem de histórico)
CREATE INDEX IF NOT EXISTS idx_sessions_project_id ON sessions(project_id);

-- Status de sessão (badge "ao vivo" na home)
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

-- Perguntas por sessão e status (fila de perguntas)
CREATE INDEX IF NOT EXISTS idx_questions_session_status ON questions(session_id, status);

-- Perguntas expiradas (limpeza por TTL)
CREATE INDEX IF NOT EXISTS idx_questions_expires_at ON questions(expires_at);

-- Red flags por sessão (timeline de alertas)
CREATE INDEX IF NOT EXISTS idx_red_flags_session_id ON red_flags(session_id);

-- Snapshots de cobertura por sessão (evolução)
CREATE INDEX IF NOT EXISTS idx_coverage_snapshots_session_id ON coverage_snapshots(session_id);

-- Chunks de transcrição por sessão (reconstituição de reunião)
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_session_id ON transcript_chunks(session_id);

-- Banco de perguntas por bloco e tipo de projeto
CREATE INDEX IF NOT EXISTS idx_question_bank_block ON question_bank(block);

-- Prompts de sessão por agente
CREATE INDEX IF NOT EXISTS idx_session_prompts_session_agent ON session_prompts(session_id, agent);


-- =============================================================================
-- NOTA SOBRE O VAULT
-- =============================================================================
-- A extensão supabase_vault é necessária para armazenar a chave de API do Gemini.
-- Esta migration não chama vault.create_secret() — isso é feito pela aplicação
-- FastAPI no momento de criação de cada projeto.
--
-- Verifique que o Vault está disponível ANTES de rodar esta migration:
--   SELECT count(*) FROM vault.secrets;
-- Se retornar erro (não conjunto vazio), habilite a extensão em:
--   Dashboard → Database → Extensions → supabase_vault → Enable
-- =============================================================================
