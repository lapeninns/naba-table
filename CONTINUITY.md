# Continuity Ledger

Last updated: 2026-01-26T23:34:04Z

## Goal (incl. success criteria)

- Stop booking 500s caused by `customers_phone_check` violations in `/api/ops/bookings`
- Success: Missing-phone walk-ins no longer violate the phone-length constraint
- Success: Phone-length constraints are centralized and enforced at the API boundary

## Constraints/Assumptions

- Follow AGENTS.md SDLC phases with task artifacts
- Supabase is remote-only; no local migrations
- Keep a single canonical path; avoid shims/adapters

## Key decisions

- Root cause: fallback phone generation (`000-${slug}` with 24-char slug) exceeded DB max length (20)
- Centralize the constraint as `CUSTOMER_PHONE_LENGTH_MIN/MAX` in `reserve/shared/validation/contact.ts`
- Generate a constraint-safe fallback phone in `src/app/api/ops/bookings/route.ts` using hashed digits and a fixed prefix
- Align public booking schemas to the same constraint to fail fast (400) instead of 500

## State

- Fix implemented, tests passing, verification artifacts updated

## Done

- Created task folder: `tasks/weekend-booking-phone-constraint-20260126-2324/`
- Patched fallback phone generation in `src/app/api/ops/bookings/route.ts`
- Added shared phone-length constants in `reserve/shared/validation/contact.ts`
- Aligned phone-length validation in:
- `src/app/api/bookings/route.ts`
- `src/app/api/bookings/[id]/route.ts`
- `lib/profile/schema.ts`
- Strengthened ops route test assertion in `src/app/api/ops/bookings/route.test.ts`
- Ran: `npx vitest run src/app/api/ops/bookings/route.test.ts src/app/api/bookings/route.test.ts src/app/api/bookings/[id]/route.test.ts` (55 passed)
- Ran: `npm run lint` (0 errors, existing warnings)

## Now

- Summarize root cause and the applied fix for the user

## Next

- Monitor production logs for disappearance of Postgres `23514` on `customers_phone_check`
- If requested, prepare a PR summary and rollout notes

## Open questions (UNCONFIRMED if needed)

- Why is the issue observed mostly on Fri/Sat/Sun? Likely correlation with missing-phone ops walk-ins, but UNCONFIRMED

## Working set (files/ids/commands)

- `src/app/api/ops/bookings/route.ts`
- `src/app/api/ops/bookings/route.test.ts`
- `reserve/shared/validation/contact.ts`
- `src/app/api/bookings/route.ts`
- `src/app/api/bookings/[id]/route.ts`
- `lib/profile/schema.ts`
- `tasks/weekend-booking-phone-constraint-20260126-2324/verification.md`
- `npx vitest run src/app/api/ops/bookings/route.test.ts src/app/api/bookings/route.test.ts src/app/api/bookings/[id]/route.test.ts`
