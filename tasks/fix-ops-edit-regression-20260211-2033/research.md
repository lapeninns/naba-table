---
task: fix-ops-edit-regression
timestamp_utc: 2026-02-11T20:33:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Ops edit regression after guest edit fix

## Requirements

- Functional:
- Ops booking edits must succeed from dashboard and bookings views.
- Guest booking edit behavior must remain unchanged.

- Non-functional (a11y, perf, security, privacy, i18n):
- Preserve existing UI and auth behavior.
- Keep API validation strict while accepting canonical datetime formats.

## Existing Patterns & Reuse

- Ops edit dialog: `components/dashboard/EditBookingDialog.tsx`
- Dashboard list DTO conversion: `src/components/features/dashboard/BookingsList.tsx`
- Ops PATCH API: `src/app/api/ops/bookings/[id]/route.ts`
- Guest update schema already accepts offsets in `src/app/api/bookings/[id]/route.ts`

## Constraints & Risks

- Multiple ops entrypoints exist (dashboard summary list vs bookings list).
- Dashboard list generated naive datetimes (`YYYY-MM-DDTHH:mm:ss`) without timezone.
- Ops PATCH schema previously rejected offset-style payloads (`+00:00`).

## Findings

- Dashboard `toIsoTime` emitted timezone-less strings, causing invalid payloads in ops edits for some flows.
- Ops PATCH schema used `z.string().datetime()` while guest uses `datetime({ offset: true })`.

## Recommended Direction

- Normalize dashboard-generated booking timestamps to UTC ISO (`...Z`) using restaurant timezone.
- Align ops PATCH schema with guest offset support (`datetime({ offset: true })`).
