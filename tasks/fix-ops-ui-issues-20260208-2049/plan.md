---
task: fix-ops-ui-issues
timestamp_utc: 2026-02-08T20:49:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Ops UI + Security Fixes

## Objective

We will remove SSRF risk from server-side prefetches and fix ops UI regressions (status labels, calendar date drift, inert filter button, skeleton divider) so the dashboard behaves correctly across timezones.

## Success Criteria

- [ ] Status labels render from `getOpsBookingStatusUi` when possible.
- [ ] Server-side prefetch origin is derived from trusted env vars only.
- [ ] Heatmap calendar selected day remains correct across timezones.
- [ ] Filter button performs a deterministic action (no dead UI).
- [ ] Skeleton divider renders at intended breakpoint.

## Architecture & Components

- `src/components/features/dashboard/booking-details/utils.ts`
- `src/components/features/dashboard/HeatmapCalendar.tsx`
- `src/components/features/dashboard/OpsDashboardToolbar.tsx`
- `src/components/features/dashboard/cards/OpsBookingCardSkeleton.tsx`
- `lib/site-url.ts`
- `src/app/app/(app)/dashboard/page.tsx`
- `src/app/(public)/bookings/[bookingId]/page.tsx`
- `src/app/(public)/bookings/booking-page.tsx`
- `src/app/guest/bookings/[bookingId]/receipt/page.tsx`

## Data Flow & API Contracts

- No API contract changes.

## UI/UX States

- No new states; ensure existing controls behave as expected.

## Edge Cases

- Unknown status strings still render with safe fallback.
- Env URLs missing fall back to canonical site URL.

## Testing Strategy

- Unit/Integration: none added.
- Manual: smoke check dashboard toolbar and date selector (if time allows).

## Rollout

- No feature flags; safe incremental change.

## DB Change Plan (if applicable)

- Not applicable.
