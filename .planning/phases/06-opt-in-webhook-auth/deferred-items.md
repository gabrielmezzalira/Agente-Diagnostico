# Deferred Items — Phase 06 (Opt-In Webhook Auth)

Itens fora do escopo deste plano, descobertos durante a execução mas não corrigidos aqui
(SCOPE BOUNDARY — só se corrige o que a task atual causou).

## `backend/tests/test_schema.py::test_tables_exist` falha sem conexão real ao Supabase

- **Descoberto durante:** Task 1 (06-01), ao rodar `pytest tests/ -x -q` para confirmar zero
  regressão.
- **Sintoma:** `postgrest.exceptions.APIError: {'message': "Could not find the table
  'public.information_schema.tables' in the schema cache", 'code': 'PGRST205', ...}`.
- **Causa:** o teste depende de uma conexão real ao Supabase (via `SUPABASE_URL`/`SUPABASE_KEY`
  do ambiente local) para checar o schema; sem uma sessão válida contra o projeto real, a
  chamada falha na API do PostgREST.
- **Confirmado pré-existente:** rodado com `git stash` isolando `backend/app/routers/webhook.py`
  (única mudança de código da Task 1) — o teste falha de forma idêntica sem a mudança desta
  fase. Não é uma regressão causada por `verify_extension_key`/`Depends()`.
- **Escopo:** nada em `webhook.py`, `test_webhook_auth.py` ou na extensão toca schema/conexão
  Supabase. Fora do escopo desta task (Rule 1-3 só cobre bugs causados pela mudança atual).
- **Ação:** nenhuma nesta fase. `pytest tests/ -x -q --deselect tests/test_schema.py::test_tables_exist`
  confirma 92 passed / 4 skipped, zero regressão real.
