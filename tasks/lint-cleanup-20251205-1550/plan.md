---
task: lint-cleanup
timestamp_utc: 2025-12-05T15:50:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Lint cleanup batch

## Objective

Eliminate the remaining lint warnings/errors reported by pre-commit so `eslint --max-warnings=0` passes.

## Success Criteria

- [ ] All listed warnings/errors are resolved:
  - Unused imports/vars in marketing restaurant page, auth callback, receipt client, booking detail client, booking list client, guest dashboard.
  - `no-explicit-any` in e2e login route.
  - React hook dependency array error in `useGuestBookings`.
- [ ] Targeted lint runs on touched files succeed with `--max-warnings=0`.

## Architecture & Components

- Files: `src/app/(public)/(marketing)/restaurants/[slug]/page.tsx`, `src/app/api/auth/callback/route.ts`, `src/app/api/auth/e2e-login/route.ts`, `src/app/guest/bookings/[bookingId]/receipt/ReceiptClient.tsx`, `src/components/features/booking/detail/ReservationDetailClient.tsx`, `src/components/features/booking/list/BookingListClient.tsx`, `src/components/features/guest/dashboard/GuestDashboardClient.tsx`, `src/guest/hooks/useGuestBookings.ts`.

## Data Flow & API Contracts

- No API or runtime behavior changes intended; only lint-driven refactors.

## UI/UX States

- Not impacted.

## Edge Cases

- Ensure `useGuestBookings` dependencies include relevant filter fields.

## Testing Strategy

- Run `pnpm eslint <file> --max-warnings=0` per touched file to avoid SIGKILL.

## Rollout

- No feature flags or rollout steps.
