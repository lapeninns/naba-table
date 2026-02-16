---
task: fix-ops-booking-edit-regression
timestamp_utc: 2026-02-16T13:21:23Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Ops booking edit regression (dashboard path)

## Requirements

- Functional:
  - Ops must be able to edit bookings reliably from dashboard and bookings list paths.
  - Guest booking edit flow must remain stable.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No auth model changes.
  - Keep API validation strict and canonical (`datetime` with offset).
  - Keep behavior deterministic across timezones.

## Existing Patterns & Reuse

- Ops edit API boundary and validation:
  - `src/app/api/ops/bookings/[id]/route.ts`
- Ops dashboard virtualized list DTO mapper:
  - `src/components/features/dashboard/list/BookingsListVirtualized.tsx`
  - `src/components/features/dashboard/list/utils.ts`
- Ops bookings page DTO mapper (stable path):
  - `src/utils/ops/mapOpsBookingListItemToBookingDTO.ts`

## External Resources

- Vercel request logs (`vercel logsv2`) for production, last 15 minutes.

## Constraints & Risks

- Regression loop history between ops and guest edits; patch must target shared invariants, not one-off path behavior.
- PostHog MCP is currently unavailable in this session (`Unexpected content type` handshake error), so telemetry correlation uses Vercel request logs + in-repo instrumentation behavior.
- Ops host currently does not initialize PostHog provider by design (`lib/posthog/provider.tsx`), so PostHog may not carry the failing ops edit event context.

## Findings

- Last 15 minutes Vercel logs include a single booking-edit failure:
  - `2026-02-16T13:18:57.671Z PATCH /api/ops/bookings/:id -> 400`
  - Request id: `zn25l-1771247937671-3e915bd9fa61`
- The ops API expects offset-aware datetimes:
  - `startIso: z.string().datetime({ offset: true })`
  - `endIso: z.string().datetime({ offset: true })`
- Dashboard list conversion currently emits timezone-less strings:
  - `toIsoTime(summary.date, booking.startTime)` => `YYYY-MM-DDTHH:mm:ss` (no `Z` or offset)
- This mismatch reproduces the exact 400 pattern only on dashboard path, while ops bookings page uses already-ISO start/end values and remains stable.

## Open Questions (owner, due)

- Q: Should we also re-enable ops-host PostHog capture for this event class? (owner: github:@amankumarshrestha, due: 2026-02-17)

## Recommended Direction (with rationale)

- Restore timezone-aware ISO generation at dashboard DTO mapping (`toIsoTime`) and pass `summary.timezone` through call sites.
- Add a focused regression test for `toIsoTime` to enforce offset-preserving output and avoid future refactor drift.
- Keep API schema unchanged (strict boundary is correct).
