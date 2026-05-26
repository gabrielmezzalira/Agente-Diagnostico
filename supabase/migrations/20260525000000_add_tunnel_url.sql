-- Migration: 20260525000000_add_tunnel_url.sql
-- Adiciona tunnel_url à tabela sessions para armazenar a URL pública
-- gerada pelo cloudflared/ngrok durante sessões com source='taqtic'.

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS tunnel_url text;
