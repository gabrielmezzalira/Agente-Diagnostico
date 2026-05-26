-- Renomeia source 'taqtic' → 'extension' em projects e sessions.
-- A extensão Chrome substitui o Taqtic como modo de captura local.

UPDATE projects SET source = 'extension' WHERE source = 'taqtic';
UPDATE sessions SET source = 'extension' WHERE source = 'taqtic';
