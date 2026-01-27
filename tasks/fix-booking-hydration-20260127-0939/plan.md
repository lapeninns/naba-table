---
task: fix-booking-hydration
timestamp_utc: 2026-01-27T09:39:49Z
owner: github:@codex
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: [90787006]
---

# Implementation Plan: Fix Booking Hydration Error

## Objective

We will diagnose and eliminate the hydration mismatch on `/bookings/[id]` so that the server-rendered HTML matches the client render.

## Success Criteria

- [x] Hydration mismatch root cause identified in code.
- [x] Server and client markup are deterministic for the route.
- [x] Targeted tests pass and no obvious regressions are introduced.

## Architecture & Components

- Route: `src/app/(public)/bookings/[bookingId]/page.tsx`
- Client UI: `src/components/features/booking/detail/ReservationDetailClient.tsx`
- Nested UI: `src/components/features/booking/detail/ReservationHistory.tsx`
- Shared formatting: `reserve/shared/formatting/booking.ts`

## Data Flow & API Contracts

- No API contract changes planned.
- Prop contract change:
- `ReservationDetailClient` will accept `initialNow: number` supplied by the server route.

## UI/UX States

- Loading / Empty / Error / Success states must remain correct.

## Edge Cases

- Timezone/locale-dependent formatting.
- `Date.now()`/`new Date()` at render time.
- `Math.random()` or unstable IDs in SSR output.
- Browser-only state used during initial render.
- Pending lock thresholds near grace cutoffs (time-based gating).

## Testing Strategy

- Add or update focused tests for formatting helpers if changed.
- Run targeted Vitest suites covering booking detail and shared formatting.
- Run lint/typecheck as available.

## Rollout

- No feature flag planned; change should be safe and deterministic.
- Monitor Sentry hydration errors post-deploy.
- Validate behavior on booking detail route with authenticated and recovery-cookie flows.

## DB Change Plan (if applicable)

- No DB changes planned.
