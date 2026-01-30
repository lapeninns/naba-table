# Continuity Ledger

Last updated: 2026-01-30T14:20:51Z

## Goal (incl. success criteria)

- Preserve static rendering by removing `cookies()` from RootLayout and keep analytics consent gating.
- Prevent unbounded memory growth in Supabase N+1 signature tracking.
- Success: RootLayout remains static; consent gating still works client-side.
- Success: signature map prunes and caps entries without breaking N+1 detection.

## Constraints/Assumptions

- Follow AGENTS.md SDLC phases; task folders required for code changes.
- Supabase is remote-only (no local migrations).
- No visible UI changes expected; DevTools MCP QA not required.
- Root layout should not read request-bound data.
- Do not print or commit secrets.

## Key decisions

- Move Plausible consent gating into client providers using existing `useAnalyticsConsent`.
- Add TTL pruning + size cap to Supabase request signature map.

## State

- Phase 3 (Implementation) complete; validation recorded.

## Done

- Read AGENTS.md, server/AGENTS.md, and src/app/AGENTS.md.
- Reviewed RootLayout and analytics consent wiring; reviewed Supabase instrumentation map.
- Created task folder `tasks/fix-layout-analytics-consent-tracker-20260130-1404` with SDLC artifacts.
- Removed `cookies()` usage from `src/app/layout.tsx` and moved Plausible gating to client providers.
- Added pruning/size cap for Supabase N+1 signature tracking.
- Ran `pnpm typecheck`.
- Ran `pnpm lint` (warnings only; pre-existing).
- Ran `pnpm test:ci`.
- Removed pinned pnpm versions from CI workflows to resolve action-setup conflicts.
- Pushed branch `task/fix-layout-analytics-consent-tracker-20260130-1404` and updated PR #31.

## Now

- Commit workflow fixes, push, re-run checks.

## Next

- Merge PR once required checks pass.

## Open questions (UNCONFIRMED if needed)

- None.

## Working set (files/ids/commands)

- `src/app/layout.tsx`
- `src/app/providers.tsx`
- `server/supabase-instrumentation.ts`
- `tasks/fix-layout-analytics-consent-tracker-20260130-1404/`
