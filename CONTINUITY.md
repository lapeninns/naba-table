# Continuity Ledger

Last updated: 2026-01-29T09:20:00Z

## Goal (incl. success criteria)

- Fix ops sign-in redirect loop on `app.localhost` so ops can access `/dashboard` and `/bookings`
- Success: Ops sign-in lands on dashboard without redirect loop
- Success: Manual UI QA for edit booking flow can complete per AGENTS.md

## Constraints/Assumptions

- Follow AGENTS.md SDLC phases; task folder already created
- Manual UI QA via Chrome DevTools MCP is required (UI change)
- No DB changes expected

## Key decisions

- Derive and thread restaurantSlug from ops restaurant details to avoid edit dialog schedule gating
- Harden auth hostname parsing to honor forwarded/origin headers for app-host redirects

## State

- Phase 4 QA in progress; ops sign-in loop resolved

## Done

- Implemented ops edit booking slug propagation fix
- Ran validators: `pnpm lint` (warnings only), `pnpm typecheck`, `pnpm test`
- Updated auth hostname parsing and added test for origin-host precedence
- Chrome DevTools QA: ops sign-in succeeds; bookings page reachable; edit booking dialog opens via “More actions” on future booking
- Verified time selection populates options and enables “Save changes” without saving

## Now

- Confirm if we should apply a booking edit (save) or leave as cancel-only

## Next

- Record verification results in task artifacts (screens, notes) once approved

## Open questions (UNCONFIRMED if needed)

- None

## Working set (files/ids/commands)

- `lib/auth/redirects.ts`
- `src/app/api/auth/signin/route.test.ts`
- Chrome DevTools MCP (ops bookings → More actions → Edit Booking)
