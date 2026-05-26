-- Migration: 20260525000001_add_recall_bot_id.sql
-- Armazena o ID do bot Recall.ai para poder parar a gravação ao encerrar a sessão.

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS recall_bot_id text;
