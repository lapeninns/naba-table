# Continuity Ledger

Last updated: 2026-01-27T12:57:22Z

## Goal (incl. success criteria)

- Configure Resend + Vercel DNS + DMARC + BIMI for `notifications.nabatable.com`
- Success: Resend domain verifies with SPF/DKIM published in Vercel DNS
- Success: DMARC enforcement exists at both `_dmarc.nabatable.com` and `_dmarc.notifications.nabatable.com`
- Success: BIMI TXT published at `default._bimi.notifications.nabatable.com`
- Success: produce BIMI-ready static SVG Tiny-PS logo

## Constraints/Assumptions

- Follow AGENTS.md SDLC phases with task artifacts
- DNS is managed by Vercel DNS
- Sending provider is Resend; DNS records must come from Resend API
- No secrets in source; use placeholders
- DMARC must be enforced for BIMI compliance

## Key decisions

- Create dedicated task folder: `tasks/resend-bimi-notifications-20260127-1220/`
- Use DMARC `p=quarantine; pct=100` as safe default before optional `p=reject`
- Generate a simplified, static, filter-free Tiny-PS SVG for BIMI compatibility
- Add a non-interactive CLI script gated by `APPLY_DNS=1` and `VERCEL_TOKEN`
- Fix Resend record name handling to avoid duplicate `.notifications` labels
- Use `pnpm dlx vercel@latest` because the global `vercel` binary is broken

## State

- DMARC + BIMI DNS are applied and the BIMI SVG is publicly hosted at the target URL

## Done

- Created task folder: `tasks/resend-bimi-notifications-20260127-1220/`
- Stubbed SDLC artifacts: `research.md`, `plan.md`, `todo.md`, `verification.md`
- Inspected brand SVG: `public/brand/nabatable-logo.svg`
- Created BIMI-ready static SVG: `public/brand/nabatable-bimi.svg`
- Added CLI automation: `scripts/email/setup-notifications-domain.ts`
- Added npm script: `email:setup:notifications-domain`
- Ran CLI dry-run with invalid key; failed fast as expected
- Ran CLI without key; failed fast with missing `RESEND_API_KEY`
- Ran CLI with `.env.local` key; Resend rejected domain list due to restricted key
- Fixed lint warning in `scripts/email/setup-notifications-domain.ts`
- Ran: `pnpm -s lint` (0 errors, pre-existing warnings remain)
- Patched `recordNameToFqdn` for subdomain-aware Resend records
- Ran dry run successfully; Resend domain lookup succeeded and DNS commands generated
- Removed root DMARC `p=none` and replaced with enforced DMARC via Vercel CLI
- Added `_dmarc.notifications` and `default._bimi.notifications` via Vercel CLI
- Ran `dig` checks for DMARC/BIMI/SPF/DKIM; records resolve as expected
- Requested Resend domain verification; API returned success
- Copied BIMI SVG to public path: `public/bimi/nabatable-bimi.svg`
- Added DNS for `assets.nabatable.com` and attached it to the Vercel project
- Deployed to production via `pnpm dlx vercel@latest deploy --prod --yes`
- Verified public hosting: `curl -I https://assets.nabatable.com/bimi/nabatable-bimi.svg` returned HTTP 200
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

- Report that BIMI asset hosting is live and verified

## Next

- Send a real test email from `notifications.nabatable.com` and inspect Authentication-Results
- Confirm Resend domain status transitions to `verified`
- Validate BIMI with external inspectors after caching/propagation

## Open questions (UNCONFIRMED if needed)

- PEM/VMC availability pending user input (UNCONFIRMED)

## Working set (files/ids/commands)

- `tasks/resend-bimi-notifications-20260127-1220/research.md`
- `tasks/resend-bimi-notifications-20260127-1220/plan.md`
- `tasks/resend-bimi-notifications-20260127-1220/todo.md`
- `tasks/resend-bimi-notifications-20260127-1220/verification.md`
- `public/brand/nabatable-logo.svg`
- `public/brand/nabatable-bimi.svg`
- `scripts/email/setup-notifications-domain.ts`
- `package.json`
- `pnpm -s lint`
- `date -u +\"%Y%m%d-%H%M %Y-%m-%dT%H:%M:%SZ\"`
