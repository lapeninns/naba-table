# [BUG] String false can be stored as marketing opt-in

**File:** [`src/app/api/ops/bookings/schema.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/ops/bookings/schema.ts#L73) (lines 73)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-boolean-coercion`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

opsWalkInBookingSchema uses z.coerce.boolean() for marketingOptIn. This coerces any non-empty string, including "false" and "0", to true. A client submitting JSON or form-derived strings can therefore persist marketing consent as enabled despite sending a false value.

## Recommendation

Use a strict boolean or an explicit boolean-string parser that handles true/false strings intentionally and rejects ambiguous values.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-23)
