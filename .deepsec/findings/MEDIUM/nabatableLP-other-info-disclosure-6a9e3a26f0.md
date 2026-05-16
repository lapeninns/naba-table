# [MEDIUM] Guest booking history returns internal actor identifiers

**File:** [`src/app/api/bookings/[id]/history/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/bookings/[id]/history/route.ts#L139-L206) (lines 139, 141, 204, 206)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-info-disclosure`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

After validating a session-recovery token or matching Supabase user email, the route returns getBookingHistory events directly. That helper resolves actor from audit_logs.actor or booking_versions.changed_by, and ops booking audit events commonly store staff user.email as the actor. A guest with a valid booking token can therefore retrieve internal staff account identifiers for changes made to their reservation.

## Recommendation

Use a guest-specific history DTO for this public route that redacts raw actor values to coarse labels such as guest, restaurant, or system. Keep raw staff/user actor identifiers only on the ops history endpoint after restaurant membership authorization.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-20)
