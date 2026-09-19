# Plan 11-02 Summary — Frontend LLM Config & Pricing Entry Point

## What was done

### `frontend/src/lib/api.ts`
- Added `pricing_llm_provider`, `pricing_llm_model`, `has_pricing_api_key` fields to the `Project` interface.
- Added `pricing_llm_provider?`, `pricing_llm_model?`, `pricing_api_key?` fields to `ProjectCreate`.
- Declared new interfaces: `Pricing`, `PricingOutputs`, `PricingFeature`, `PricingWithDetails`, `PricingCreateBody`, `PricingUpdateBody`, `PricingFeatureCreateBody`, `PricingFeatureUpdateBody`, `PricingHistory`.
- Added `api.pricings` namespace with: `list`, `create`, `get`, `update`, `delete`, `approve`, `history`.
- Added `api.pricingFeatures` namespace with: `list`, `add`, `update`, `delete`.

### `frontend/src/pages/ProjectFormPage.tsx`
- Imported `ChevronDown` from `lucide-react` (alongside existing `ChevronLeft`).
- Extended `DEFAULT_FORM` with `pricing_llm_provider`, `pricing_llm_model`, `pricing_api_key` fields.
- Added state: `hasPricingApiKey` and `showLlmConfig`.
- `useEffect` now populates pricing LLM fields from the loaded project and auto-expands the section if provider or model are already set.
- Submit handler strips empty pricing fields from the payload.
- Added collapsible "Configuração IA do Precificador" section (above submit buttons) with provider `<select>`, model `<input type="text">`, and API key `<input type="password">` — all using existing `Field` + `inputCls` patterns.

### `frontend/src/pages/ProjectDetailPage.tsx`
- Added "Precificações" section below the sessions history.
- Section header matches the sessions header style.
- "Nova Precificação" button links to `/projects/:id/pricings` using the same accent button styling as the "Nova sessão" CTA.
- Placeholder text "Nenhuma precificação ainda." shown until Plan 11-04 wires up the list.

## Verification
- All three grep checks returned >= 1 matches.
- `npm run build` completed with 0 TypeScript errors (2001 modules transformed, built in ~760ms).
