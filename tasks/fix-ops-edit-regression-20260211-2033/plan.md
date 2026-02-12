---
task: fix-ops-edit-regression
timestamp_utc: 2026-02-11T20:33:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Fix Ops edit regression

## Objective

Restore reliable ops booking edits after guest flow changes by unifying datetime shape expectations across ops UI + API.

## Success Criteria

- [ ] Ops edit payload from dashboard uses RFC3339 datetime with timezone.
- [ ] Ops PATCH route accepts both `Z` and `+00:00` style offsets.
- [ ] Guest flow remains unchanged.

## Architecture & Components

- `src/components/features/dashboard/BookingsList.tsx`: timezone-aware `toIsoTime`.
- `src/app/api/ops/bookings/[id]/route.ts`: schema offset support.

## Testing Strategy

- Quick static validation via TypeScript check for touched files.
- Manual verification on app host for editing from dashboard and bookings pages.
