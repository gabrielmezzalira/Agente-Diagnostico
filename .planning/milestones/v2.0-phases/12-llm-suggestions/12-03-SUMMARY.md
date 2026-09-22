# Plan 12-03 Summary — Frontend LLM Suggestions

**Completed:** 2026-07-19
**Checkpoint:** aprovado pelo usuário

## What was built

### New files
- `frontend/src/hooks/useLLMSuggestions.ts` — Hook com estado `importing`, `suggesting`, `suggestions`, `showSuggestions`. Callbacks `importFromDiagnosis`, `suggestFeatures`, `acceptSuggestion`, `rejectSuggestion`, `closeSuggestions` (estável via `useCallback([], [])`).
- `frontend/src/lib/api.ts` — Adicionados interface `SuggestedFeature` e métodos `api.pricings.importFromDiagnosis` / `api.pricings.suggestFeatures`.

### Modified files
- `frontend/src/pages/PricingEditorPage.tsx`:
  - Componente `SuggestionCard` com aceitar (+) e rejeitar (X)
  - 2 botões na topbar ("Importar do diagnóstico", "Sugerir funcionalidades") — visíveis apenas em rascunho
  - Painel de sugestões abaixo da tabela de features
  - `useEffect([suggestions.length, showSuggestions, closeSuggestions])` fecha painel ao esvaziar
  - Erros inline para `importError` e `suggestError`
  - **Click-to-edit na tabela**: Bloco, Funcionalidade e Horas exibem texto por padrão; clique ativa input; blur/Enter salva
  - Delete button visível apenas no hover da linha (`group-hover`)

## Bugs fixed post-completion
- `vault.decrypted_secrets` inacessível via PostgREST: trocado para `db.rpc("vault_get_secret", {"p_secret_id": ...})`
- Pacotes LangChain não instalados: `pip install langchain-openai langchain-anthropic langchain-google-genai`
- Coluna "Funcionalidade" truncada: resolvido com click-to-edit (texto exibido sem container de input)
- Horas estimadas muito altas: adicionado `get_recent_history()` sem filtro de tipo; histórico injetado como âncora no prompt; cap de 80h no código

## Seed aplicada
`supabase/seed_pricing_history.sql` — 7 snapshots aprovados rodados manualmente no Supabase SQL Editor com `SET session_replication_role = 'replica'` para bypass de FK.

## Verification
- `npm run build`: 0 erros TypeScript
- Botões visíveis em rascunho, ocultos em aprovado ✓
- Erro informativo ao importar sem relatório ✓
- Painel de sugestões com aceitar/rejeitar funcional ✓
- Checkpoint humano: aprovado
