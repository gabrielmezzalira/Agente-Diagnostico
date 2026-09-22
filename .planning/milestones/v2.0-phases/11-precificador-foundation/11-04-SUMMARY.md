# Plan 11-04 Summary — Precificador Frontend

**Completed:** 2026-07-19

## What was built

### New files
- `frontend/src/lib/pricingCalculator.ts` — Pure functions (`featureDias`, `calculatePricing`) with no React imports. Implements the pricing formula: diasCorridos = diasUteis × 1.4 + extraDays, precoTotal = ticket × (diasCorridos / 30).
- `frontend/src/hooks/usePricing.ts` — Hook that fetches a `PricingWithDetails`, exposes `pricing`, `features`, `outputs` (calculated locally via `calculatePricing`), and setters for optimistic updates.
- `frontend/src/hooks/usePricingFeatures.ts` — Hook providing `addFeature`, `updateFeature`, `deleteFeature` with optimistic UI updates and server sync.
- `frontend/src/pages/PricingListPage.tsx` — Lists all pricings for a project; creates new pricing with defaults and navigates to editor.
- `frontend/src/pages/PricingEditorPage.tsx` — Full editor with inputs form (save-on-blur), live outputs card (computed client-side), inline-editable feature table with CITI? checkbox, add/delete rows, and approve button.

### Modified files
- `frontend/src/lib/api.ts` — Added `listByProject` alias alongside existing `list` method (both call `GET /projects/{id}/pricings/`).
- `frontend/src/App.tsx` — Added two routes: `/projects/:id/pricings` → `PricingListPage`, `/pricings/:id` → `PricingEditorPage`.
- `frontend/src/pages/ProjectDetailPage.tsx` — Added `Pricing[]` state, fetches `api.pricings.listByProject` on load, replaced "Nenhuma precificação ainda." static text with a real list of clickable pricing links with status badges.

## Key decisions
- Outputs are calculated **client-side** via `pricingCalculator.ts` on every pricing/features state change — no server round-trip needed for live preview.
- `horas` in `PricingFeature` is typed as `string` (Supabase NUMERIC → string in JSON); the hook coerces to `Number()` for calculations and back to `String()` for optimistic patches.
- Approved pricings disable all inputs and action buttons via `isApproved` flag propagated from `pricing.status`.

## Bugs fixed post-completion
- `POST /projects/${id}/pricings/` had a trailing slash → FastAPI 307 redirect dropped the POST method → "Method Not Allowed". Fixed by removing trailing slashes from all POST/PUT/DELETE pricings and pricingFeatures URLs.
- `api.pricings.history` was calling `/projects/${id}/pricings/history` (wrong). Fixed to `/projects/${id}/pricing-history`.

## Verification
- `tsc --noEmit`: 0 errors
- `npm run build`: success (465 kB bundle)
- Human checkpoint: full E2E flow passed (create pricing → add features → outputs update in real time → approve → list shows aprovada badge)
