# Continuity Ledger

Last updated: 2025-12-27T20:06:10Z

## Goal (incl. success criteria)

- Implement a long-term fix so the ops dashboard renders summary data on first load (no navigation workaround).
- Success: cache/session handling no longer clears the in-flight summary query; verified via manual QA.

## Constraints/Assumptions

- Follow AGENTS policy.
- No code changes unless requested.
- Secrets never in source.

## Key decisions

- None yet.

## State

- Implemented session hydration + query enablement changes; added missing query persistence module; fixing ESLint warnings per user request; pending verification/commit.

## Done

- Located OpsDashboardClient loading/skeleton logic and summary query hook.
- Reviewed Supabase session provider and QueryLayer cache reset behavior.
- Created task folder `tasks/fix-ops-dashboard-loading-20251227-1955/` with research/plan/todo/verification stubs.
- Updated ops app layout to pass initial Supabase session to AppProviders.
- Gated ops summary query until Supabase session is resolved.
- Added `lib/query/persist.ts` module referenced by AppProviders and GuestNavbar.
- Resolved ESLint warnings in signin, auth callback/signin routes, bookings route, onboarding wizard, receipt client, and proxy.

## Now

- Re-run lint/build, then stage and commit changes to Frontend-2025-Dec-19.

## Next

- Run tests and Chrome DevTools MCP QA; attach artifacts and update verification.md.

## Open questions (UNCONFIRMED if needed)

- None.

## Working set (files/ids/commands)

- lib/query/persist.ts
- src/app/(public)/auth/signin/page.tsx
- src/app/api/auth/callback/route.ts
- src/app/api/auth/signin/route.ts
- src/app/api/bookings/route.ts
- src/app/api/onboarding/restaurant/[id]/tables/route.ts
- src/app/app/(app)/layout.tsx
- src/app/guest/bookings/[bookingId]/receipt/ReceiptClient.tsx
- src/app/guest/bookings/[bookingId]/receipt/page.tsx
- src/components/features/onboarding/OnboardingWizard.tsx
- src/hooks/ops/useOpsTodaySummary.ts
- tasks/fix-ops-dashboard-loading-20251227-1955/todo.md
