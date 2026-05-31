# [BUG] Booking history version IDs are coerced to invalid numbers

**File:** [`server/bookingHistory.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/bookingHistory.ts#L121) (lines 121)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-logic-bug`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

booking_versions.version_id is typed as a string elsewhere in the Supabase schema and ops change-feed code, but buildHistoryEvent coerces it with Number(). UUID or non-safe integer string values become NaN or lose precision; when returned through JSON, NaN serializes as null. Reservation history clients then receive unstable or duplicate event IDs.

## Recommendation

Keep versionId as a string in BookingHistoryEvent and return version.version_id directly, or only parse after proving the database column is a safe numeric type.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-10-26)
