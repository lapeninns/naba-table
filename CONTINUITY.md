# Continuity Ledger

Last updated: 2026-01-27T00:02:55Z

## Goal (incl. success criteria)

- Expand UK phone validation to support more valid UK number types (not just 07 mobiles)
- Success: UK landlines and non-geographic numbers are accepted
- Success: Validation remains DB-safe and canonical across flows

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

- UK phone validation upgraded, tests and lint passing; DevTools QA attempted but blocked by reserve dev error boundary

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

## Now

- Summarize the UK phone validation upgrade and impacts

## Next

- Monitor validation errors and customer phone inserts post-deploy
- If requested, run broader tests or prepare a PR summary

## Open questions (UNCONFIRMED if needed)

- Should we also normalize phone storage for other tables like `waiting_list` for consistency? (UNCONFIRMED)

## Working set (files/ids/commands)

- `reserve/shared/validation/contact.ts`
- `reserve/shared/validation/contact.test.ts`
- `server/customers.ts`
- `reserve/features/reservations/wizard/model/schemas.ts`
- `tasks/uk-phone-validation-20260126-2349/verification.md`
- `npx vitest run reserve/shared/validation/contact.test.ts src/app/api/ops/bookings/route.test.ts src/app/api/bookings/route.test.ts src/app/api/bookings/[id]/route.test.ts`
