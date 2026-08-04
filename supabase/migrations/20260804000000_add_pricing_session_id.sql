-- =============================================================================
-- Migration: 20260804000000_add_pricing_session_id.sql
--
-- Permite vincular uma precificação a uma sessão/diagnóstico específico do
-- projeto, para que múltiplas precificações do mesmo projeto possam se
-- referir a reuniões/diagnósticos diferentes. Vínculo é opcional — pricings
-- existentes ficam com session_id NULL e continuam usando todos os
-- relatórios do projeto ao "Importar do diagnóstico" (comportamento atual).
-- =============================================================================

ALTER TABLE pricings
    ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES sessions(id) ON DELETE SET NULL;

COMMENT ON COLUMN pricings.session_id IS
    'Sessão/diagnóstico de referência desta precificação. NULL = usa todos os relatórios do projeto (comportamento legado).';

CREATE INDEX IF NOT EXISTS idx_pricings_session_id
    ON pricings(session_id);
