# Continuity Ledger

Last updated: 2026-03-25T18:28:00Z

## Goal (incl. success criteria)

- Continue the paused `guest-booking-lifecycle` mission validator pass in the dedicated worktree.
- Success means the stale assertions `VAL-BOOKING-002`, `VAL-BOOKING-004`, `VAL-BOOKING-005`, `VAL-BOOKING-008`, `VAL-BOOKING-009`, `VAL-BOOKING-010`, and `VAL-BOOKING-011` have fresh truthful validation evidence and the live runtime behavior matches that evidence.

## Constraints/Assumptions

- Work only in the isolated mission worktree and validate against the live Next.js server on port `3000`.
- Follow existing booking detail/recovery intent helpers and dev harness patterns; do not widen allowed redirect targets beyond approved internal guest/public/app paths.
- Required validation includes targeted Vitest/Playwright coverage, `pnpm typecheck`, `pnpm lint`, and manual live browser verification on `http://localhost:3000`.

## Key decisions

- Keep receipt token continuity in the shared reservation-fetch path instead of creating a receipt-only API client.
- Treat `GET /api/bookings/:id?token=...` as booking-scoped confirmation-token access for receipt reads while keeping public booking detail pages on the recovery-token path.
- Preserve rebook continuity with a safe canonical fallback instead of letting fixture slugs dead-end on a not-found route.
- Expose booking-detail loading/error validation and guest receipt lifecycle validation through dev-only harnesses that reuse the canonical UI.

## State

- The resumed validator pass is functionally complete: booking-detail rebook continuity is fixed, booking-detail loading/error states are browser-visible, and the receipt client/API now preserve tokenized entitlement through hydration/refetch.
- The old local example `/guest/bookings/333.../receipt?token=abc123` still fails in the live browser, but the failure is now a truthful missing-data case: the connected remote dataset does not contain bookings `333...`, `444...`, or `555...`.
- A dev-only guest receipt harness now provides deterministic browser validation for confirmed, pending, and cancelled receipt states when the local runtime lacks those seeded records.

## Done

- Loaded the paused mission state, recent handoffs, validation contract, and current synthesis/state artifacts.
- Confirmed the port-3000 Next.js server is running from the mission worktree.
- Reproduced the live outcomes for unauthenticated public booking detail, authorized recovery-backed public booking detail, tokenized guest receipt, and rebook navigation.
- Created `tasks/guest-booking-lifecycle-validation-rerun-20260325-1800/`.
- Added the shared booking-detail loading/error harness and the new dev-only guest receipt harness.
- Fixed the booking API/token/client path so receipt token access no longer trips the deprecated-token branch and remains stable through client refetches.
- Verified with focused Vitest, focused Playwright, full Vitest, `pnpm typecheck`, `pnpm lint`, and Chrome DevTools screenshots.
- Confirmed via read-only Supabase query that the local remote dataset lacks the historical receipt fixture bookings used by the old `abc123` browser example.

## Now

- Update task artifacts and final handoff notes with the fixed contract plus the remaining missing-seed limitation.

## Next

- Share the final mission/worktree summary with the user.

## Open questions (UNCONFIRMED if needed)

- None.

## Working set (files/ids/commands)

- `CONTINUITY.md`
- `tasks/guest-booking-lifecycle-validation-rerun-20260325-1800/`
- `reserve/features/reservations/wizard/api/useReservation.ts`
- `src/app/api/bookings/[id]/route.ts`
- `src/app/guest/bookings/[bookingId]/receipt/*`
- `src/app/(public)/dev/guest-receipt/page.tsx`
- `src/components/features/booking/detail/*`
- `server/restaurants/getRestaurantBySlug.ts`
- `tests/guest/public-booking-pages.test.tsx`
- `tests/guest/guest-receipt-pages.test.tsx`
- `tests/e2e/guest-public-pages.spec.ts`
- `tests/e2e/guest-receipt-pages.spec.ts`
