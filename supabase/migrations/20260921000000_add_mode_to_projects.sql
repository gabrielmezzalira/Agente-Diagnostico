-- Migration: 20260921000000_add_mode_to_projects.sql
-- Adiciona a coluna mode à tabela projects para diferenciar sessões de
-- vendas (comportamento atual, com portfólio comercial CITi) de sessões
-- de discovery (18 áreas Produto+Dados, sem portfólio comercial).
-- Aditiva e idempotente (ADD COLUMN IF NOT EXISTS): projetos existentes
-- recebem 'sales' automaticamente via DEFAULT, sem backfill manual.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS mode text DEFAULT 'sales';

COMMENT ON COLUMN projects.mode IS
    'Modo do projeto: sales (comportamento atual, portfólio comercial CITi) | discovery (18 áreas Produto+Dados, sem portfólio comercial). Default sales — linhas existentes ficam sales sem backfill manual.';
