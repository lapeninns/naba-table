---
task: booking-manage-pdf-cancel-fixes
timestamp_utc: 2026-02-12T18:21:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Research: Booking Manage/PDF/Cancel Consistency Fixes

## Requirements

- Functional:
- Fix PDF download in guest-managed booking detail flow.
- Remove broken "Manage booking" CTA from confirmation step 4 action bar.
- Ensure cancel status is reflected immediately in manage booking UI without page reload.
- Prevent updates to cancelled bookings at API boundary.

- Non-functional (a11y, perf, security, privacy, i18n):
- Preserve existing accessible button semantics and focus handling.
- Maintain auth/session-recovery authorization checks for guest access.
- Keep query-cache behavior deterministic and resilient to stale state.

## Existing Patterns & Reuse

- Guest booking authorization already supports `sr_access` token in `/api/bookings/[id]`.
- Reservation detail page uses `useReservation` (React Query key: `reservationKeys.detail(id)`).
- Cancellation mutation currently updates only `queryKeys.bookings.*`, not `reservationKeys.detail(id)`.

## External Resources

- No external docs required; existing in-repo patterns are sufficient.

## Constraints & Risks

- Session recovery token validation must not bypass ownership checks.
- Route changes must avoid breaking authenticated download behavior.
- Cache update must include optimistic update + rollback + invalidation.

## Open Questions (owner, due)

- Q: Should cancelled bookings allow rebook only (current behavior) while edit/cancel are locked?
  A: Keep current UX; only enforce immutable cancelled booking for updates.

## Recommended Direction (with rationale)

- Reuse existing session-recovery token validation in PDF route for guest-managed reservations.
- Remove confirmation "Manage booking" action entirely per request.
- Patch cancel mutation to update/invalidate `reservationKeys.detail(id)` immediately.
- Add explicit API guard rejecting updates when booking status is `cancelled`.
