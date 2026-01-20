# Continuity Ledger

Last updated: 2026-01-20T16:07:07Z

## Goal (incl. success criteria)

- Fix guest booking recovery flow so saving booking changes via email recovery link does not redirect to "Something went wrong".
- Success: Guest can open /bookings/recover?access_token=...&next=/bookings/<id> and save updates without error.
- Success: Booking update requests succeed with session recovery auth.

## Constraints/Assumptions

- Follow AGENTS SDLC phases; task folder required before implementation.
- Manual UI QA via Chrome DevTools MCP required for UI changes.
- Use existing patterns in src/app/api routes; no custom UI primitives.

## Key decisions

- Adjust recovery cookie domain logic to only set `domain` when host matches root domain (normalize `www.`) to avoid dropped cookies on previews/custom domains.

## State

- Phase 2/3: plan drafted; implementing recovery cookie domain fix.

## Done

- Located relevant routes via codebase retrieval.
- Loaded root and src/app AGENTS policies.
- Created task folder `tasks/guest-recover-save-error-20260120-1605/` with SDLC stubs.
- Reviewed booking recovery/update flows and identified cookie domain risk.

## Now

- Update recovery route to scope cookie domain safely.

## Next

- Verify modified route compiles and lint passes.
- Plan manual QA via Chrome DevTools MCP once UI verification is scheduled.

## Open questions (UNCONFIRMED if needed)

- What exact API call fails when saving (endpoint/status code)? (UNCONFIRMED)
- Does failure occur for all updates or only certain fields? (UNCONFIRMED)

## Working set (files/ids/commands)

- CONTINUITY.md
- AGENTS.md
- src/app/AGENTS.md
- src/app/(public)/bookings/recover/route.ts
- src/app/api/bookings/[id]/route.ts
- src/app/(public)/bookings/booking-page.tsx
- tasks/guest-recover-save-error-20260120-1605/research.md
- tasks/guest-recover-save-error-20260120-1605/plan.md
- tasks/
