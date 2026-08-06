-- =============================================================================
-- Migration: 20260805000000_add_name_to_sessions_and_pricings.sql
-- Adiciona coluna name às tabelas sessions e pricings.
-- O nome é opcional (null = sem nome definido); o backend gera "Sessão 01",
-- "Precificação 02", etc. como default na criação.
-- =============================================================================

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE pricings ADD COLUMN IF NOT EXISTS name TEXT;
