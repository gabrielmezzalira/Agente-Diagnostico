-- Migration: 20261012000000_add_docudata_project_id.sql
-- Vínculo opcional do projeto do Agente com o projeto do DocuData
-- (integração de Discovery). Aditiva e idempotente (ADD COLUMN IF NOT EXISTS):
-- nenhuma linha existente é alterada (a coluna nasce NULL). Não aplicar sem
-- conferir o estado do banco.
--
-- Rollback (manual, não executado):
-- ALTER TABLE projects DROP COLUMN IF EXISTS docudata_project_id;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS docudata_project_id text;

COMMENT ON COLUMN projects.docudata_project_id IS
    'Id do projeto correspondente no DocuData (opcional). NULL = sem vínculo.';
