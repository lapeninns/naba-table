# [MEDIUM] Public booking failures expose raw internal error messages

**File:** [`server/bookings/api-error.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/bookings/api-error.ts#L65-L76) (lines 65, 75, 76)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-info-disclosure`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

`mapBookingApiError` returns `error.message` for every unexpected `Error` and exposes `dbError.code` in the JSON response body. This mapper is used by the public booking create failure response, so unauthenticated callers can receive raw Supabase, RPC, validation, timezone, or infrastructure error text when an unexpected path throws. Those messages can reveal internal function names, schema details, SQLSTATEs, configuration state, or operational failures that should remain server-side.

## Recommendation

Return a generic message and stable public code for unknown 500 errors, while logging the raw message, stack, and provider code server-side. Keep only explicitly whitelisted domain errors in client responses.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-24)
