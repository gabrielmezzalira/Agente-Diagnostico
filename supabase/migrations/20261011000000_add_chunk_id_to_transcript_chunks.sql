-- Migration: 20261011000000_add_chunk_id_to_transcript_chunks.sql
-- Fase 8 / Plano 08-09 (D-19, decisão B3 = aprovar-chunk-id).
-- Dá a cada trecho da transcrição um "número de série" (chunk_id) para que o
-- reenvio automático da Taqciti nunca grave a mesma fala duas vezes: o índice
-- único (session_id, chunk_id) faz o segundo insert falhar com 23505, que o
-- backend trata como duplicata (202 sem reprocessar).
-- Aditiva e idempotente (IF NOT EXISTS). Linhas antigas ficam com chunk_id NULL
-- e continuam válidas: no Postgres, NULLs são distintos em índice único, então
-- linhas sem chunk_id (clientes antigos, /webhook/recall) nunca colidem.
-- Rollback: DROP INDEX IF EXISTS ux_transcript_chunks_session_chunk;
--           ALTER TABLE transcript_chunks DROP COLUMN IF EXISTS chunk_id;

ALTER TABLE transcript_chunks ADD COLUMN IF NOT EXISTS chunk_id text;

CREATE UNIQUE INDEX IF NOT EXISTS ux_transcript_chunks_session_chunk
    ON transcript_chunks (session_id, chunk_id);

COMMENT ON COLUMN transcript_chunks.chunk_id IS
    'Identificador do trecho enviado pela Taqciti (ex.: bulk:{meetingId}:{index} ou UUID), máx. 200 caracteres. Com session_id forma chave única para deduplicar reenvios (D-19). NULL em linhas antigas e no recall.';
