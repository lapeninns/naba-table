# Continuity Ledger

Last updated: 2026-01-27T00:22:58Z

## Goal (incl. success criteria)

- Fix sign-out requiring a reload to take effect (idempotent sign-out)
- Success: sign-out completes even when session is already missing/expired
- Success: UI transitions to signed-out state immediately without manual reload

## Constraints/Assumptions

- Follow AGENTS.md SDLC phases with task artifacts
- Supabase is remote-only; no local migrations
- Keep a single canonical path; avoid shims/adapters

## Key decisions

- Replace regex-only UK mobile validation with `libphonenumber-js` GB parsing/validation
- Keep a single canonical validator: `reserve/shared/validation/contact.ts::isUKPhone`
- Canonicalize valid GB numbers to E.164 at storage time in `server/customers.ts`
- Enforce DB-safe phone length in `server/customers.ts::sanitizePhoneValue`

## State

- Sign-out flow patched to be idempotent; targeted tests and lint passing

## Done

- Created task folder: `tasks/uk-phone-validation-20260126-2349/`
- Added dependency: `libphonenumber-js@1.12.35` via `pnpm add`
- Upgraded UK phone validation in `reserve/shared/validation/contact.ts`
- Added canonicalization helper: `formatUKPhoneToE164`
- Enforced DB-safe phone length at storage in `server/customers.ts`
- Updated mobile-only copy in `reserve/features/reservations/wizard/model/schemas.ts`
- Added tests: `reserve/shared/validation/contact.test.ts`
- Ran: `npx vitest run reserve/shared/validation/contact.test.ts src/app/api/ops/bookings/route.test.ts src/app/api/bookings/route.test.ts src/app/api/bookings/[id]/route.test.ts` (60 passed)
- Ran: `npm run lint` (0 errors, existing warnings)
- Attempted Chrome DevTools MCP QA via `pnpm reserve:dev`, but dev rendered an error boundary before the phone step
- Created task folder: `tasks/signout-stale-session-20260127-0016/`
- Added canonical missing-session helper: `lib/supabase/auth-errors.ts`
- Patched server sign-out route: `src/app/api/auth/signout/route.ts`
- Patched client sign-out helper: `lib/supabase/signOut.ts`
- Added tests:
- `src/app/api/auth/signout/route.test.ts`
- `tests/server/supabase-auth-errors.test.ts`
- Ran: `npx vitest run tests/server/supabase-auth-errors.test.ts src/app/api/auth/signout/route.test.ts` (5 passed)
- Ran: `npm run lint` (0 errors, existing warnings)
- DevTools MCP: `fetch('/api/auth/signout', { method: 'POST' })` returned 200 locally

## Now

- Summarize sign-out root cause and the applied fix for the user

## Next

- Validate in staging/production with a real authenticated session
- Monitor `/api/auth/signout` error rates and sign-out UX

## Open questions (UNCONFIRMED if needed)

- Are there other sign-out triggers besides guest navbar and ops sidebar that need idempotent behavior? (UNCONFIRMED)

## Working set (files/ids/commands)

- `lib/supabase/auth-errors.ts`
- `lib/supabase/signOut.ts`
- `src/app/api/auth/signout/route.ts`
- `src/app/api/auth/signout/route.test.ts`
- `tests/server/supabase-auth-errors.test.ts`
- `tasks/signout-stale-session-20260127-0016/verification.md`
- `npx vitest run tests/server/supabase-auth-errors.test.ts src/app/api/auth/signout/route.test.ts`
