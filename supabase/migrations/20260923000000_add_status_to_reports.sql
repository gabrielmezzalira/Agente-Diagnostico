-- Migration: 20260923000000_add_status_to_reports.sql
-- Adiciona a coluna status à tabela reports para o campo Status do PRD
-- (Rascunho | Em revisão | Aprovado para build) — só relatórios discovery usam.
-- Aditiva e idempotente (ADD COLUMN IF NOT EXISTS), nullable e SEM DEFAULT:
-- linhas antigas e todos os relatórios sales ficam com status NULL, sem backfill
-- manual e sem alterar comportamento existente (D-36, análogo a D-18/D-24 para lens).
-- A validação do valor {Rascunho, Em revisão, Aprovado para build} fica no código
-- (Pydantic Literal), seguindo o padrão das demais colunas enum-like do repo
-- (project_type/source/mode/lens), sem CHECK e sem ALTER TYPE.

ALTER TABLE reports ADD COLUMN IF NOT EXISTS status text;

COMMENT ON COLUMN reports.status IS
    'Status do relatório discovery (igual ao campo Status do PRD): Rascunho | Em revisão | '
    'Aprovado para build. NULL para relatórios sales e linhas antigas — sem backfill. '
    'Validação de valor em código (Pydantic Literal), sem CHECK/enum nativo.';
