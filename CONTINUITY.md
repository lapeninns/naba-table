# Continuity Ledger

Last updated: 2026-01-27T10:00:30Z

## Goal (incl. success criteria)

- Diagnose and fix a production hydration error on the booking details page
- Success: server and client render deterministically for `/bookings/[id]`
- Success: no hydration mismatch caused by time, randomness, or browser-only state
- Success: targeted tests pass and task artifacts are complete

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

- Phase 4: addressed lint-staged React Compiler memoization warning; targeted eslint now passes

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
- Identified new production issue: Hydration Error (Issue 90787006) at `/bookings/[id]`
- Created task folder: `tasks/fix-booking-hydration-20260127-0939/`
- Updated research/plan/todo artifacts for hydration fix
- Added deterministic date/time helpers in `reserve/shared/formatting/booking.ts`
- Added tests: `reserve/shared/formatting/booking.test.ts` (2 passing)
- Hardened booking detail render in `src/components/features/booking/detail/ReservationDetailClient.tsx`
- Removed default-locale `Intl` usage in `src/components/features/booking/detail/ReservationHistory.tsx`
- Passed explicit timezone into `ReservationHistory` from booking detail
- Passed `initialNow` from server routes:
- `src/app/(public)/bookings/[bookingId]/page.tsx`
- `src/app/(public)/bookings/booking-page.tsx`
- Ran: `npx vitest run reserve/shared/formatting/booking.test.ts` (passed)
- Ran: `npx vitest run tests/ops/booking-details-utils.test.tsx tests/ops/booking-details-hook.test.tsx` (5 passed)
- Ran: `npm run lint` (0 errors, existing warnings)
- Ran: `pnpm typecheck` (failed due to stale `.next/types/validator.ts` references)
- Chrome DevTools MCP: attempted booking detail, redirected to `/auth/signin` due to missing session
- Captured DevTools notes: `tasks/fix-booking-hydration-20260127-0939/artifacts/devtools-notes.txt`
- Fixed lint-staged blocker by aligning `useMemo` deps with React Compiler inference in `ReservationDetailClient`
- Ran: `npx eslint --max-warnings=0 src/components/features/booking/detail/ReservationDetailClient.tsx` (passed)

## Now

- Report the lint-staged fix and recommend re-running the commit/hooks

## Next

- Validate the booking detail route in staging/production with a real session or recovery cookie
- Monitor Sentry hydration error volume after deploy

## Open questions (UNCONFIRMED if needed)

- Can we run DevTools MCP against a staging session to directly confirm no hydration mismatch on `/bookings/[id]`? (UNCONFIRMED)

## Working set (files/ids/commands)

- `src/app/(public)/bookings/[bookingId]/page.tsx`
- `src/app/(public)/bookings/booking-page.tsx`
- `src/components/features/booking/detail/ReservationDetailClient.tsx`
- `src/components/features/booking/detail/ReservationHistory.tsx`
- `reserve/shared/formatting/booking.ts`
- `reserve/shared/formatting/booking.test.ts`
- `tasks/fix-booking-hydration-20260127-0939/`
- `tasks/fix-booking-hydration-20260127-0939/artifacts/devtools-notes.txt`
- `src/components/features/booking/detail/ReservationDetailClient.tsx`
- `npx vitest run reserve/shared/formatting/booking.test.ts`
- `npx vitest run tests/ops/booking-details-utils.test.tsx tests/ops/booking-details-hook.test.tsx`
- `npm run lint`
