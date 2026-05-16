# [MEDIUM] Guest booking history can expose raw staff actor identifiers

**File:** [`server/bookingHistory.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/bookingHistory.ts#L91-L118) (lines 91, 96, 118)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-info-disclosure`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

getBookingHistory returns actor directly from audit_logs.actor or booking_versions.changed_by. The public booking history route returns these events to guests with a valid booking recovery token or matching customer login, while ops audit call sites store staff email addresses or user ids as the actor. A guest viewing their own reservation history can therefore learn internal staff identifiers.

## Recommendation

Add an audience option to the history helper and redact or generalize actor for guest/public responses, for example returning Restaurant team. Only expose raw actor identifiers on ops routes after per-restaurant membership authorization.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-10-26)

**Verdict:** fixed

`server/bookingHistory.ts` now normalizes booking history actors to `System` or `Restaurant team` instead of returning raw audit actors or `changed_by` identifiers. Covered by `tests/server/booking-history-redaction.test.ts`.
