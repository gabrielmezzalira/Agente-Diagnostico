# Deferred Items — Phase 07 (Taqciti Config + Background Streamer)

Itens fora do escopo deste plano (07-03), descobertos durante a execução mas não corrigidos aqui
(SCOPE BOUNDARY — só se corrige o que a task atual causou).

## `backend/tests/test_schema.py::test_tables_exist` falha sem conexão real ao Supabase

- **Descoberto durante:** Task 2 (07-03), ao rodar `python -m pytest tests/ -x -q` (bateria final
  da fase) exigida pelo `<verify>` do plano.
- **Sintoma:** idêntico ao já registrado em `.planning/phases/06-opt-in-webhook-auth/deferred-items.md`:
  `postgrest.exceptions.APIError: {'message': "Could not find the table
  'public.information_schema.tables' in the schema cache", 'code': 'PGRST205', ...}`.
- **Confirmado pré-existente e fora de escopo:** o subtree diff desde o commit de importação da
  Taqciti (`git log --format=%H -1 --grep='git-subtree-dir: taqciti'`) mostra **zero** arquivos
  alterados em `backend/` por toda a Fase 7 (planos 01/02/03) — nenhuma mudança desta fase toca
  schema, conexão Supabase ou `test_schema.py`. Já havia sido isolado e confirmado pré-existente
  na Fase 6 (ver deferred-items.md daquela fase, via `git stash`).
- **Escopo:** este plano (07-03) é 100% dentro de `taqciti/` (frontend); nenhum arquivo do backend
  está em `files_modified`. Fora do escopo (Rule 1-3 só cobre bugs causados pela mudança atual).
- **Ação:** nenhuma nesta fase. `pytest tests/ -x -q --deselect tests/test_schema.py::test_tables_exist`
  confirma 92 passed / 4 skipped, zero regressão real causada por este plano.

## Warning de lint pré-existente em `taqciti/src/document/baixarDocumento.ts`

- **Descoberto durante:** Task 2 (07-03), ao rodar `npm run lint` (bateria final da fase).
- **Sintoma:** `warning  Unused eslint-disable directive (no problems were reported from
  'no-control-regex')` na linha 26 de `baixarDocumento.ts`.
- **Causa:** um comentário `// eslint-disable-next-line no-control-regex` que já não suprime
  nenhum problema real (a regra deixou de disparar ali, provavelmente por uma mudança anterior no
  próprio regex).
- **Escopo:** `baixarDocumento.ts` não está em `files_modified` deste plano; nenhuma task desta
  fase tocou este arquivo. `npm run lint` sai com **0 erros** (warning não falha o CI) — fora do
  escopo de Rule 1-3.
- **Ação:** nenhuma nesta fase. Registrar para quem cuidar de limpeza geral de lint.
