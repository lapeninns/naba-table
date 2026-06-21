# [MEDIUM] Public booking creation trusts ops-only headers

**File:** [`server/bookings/create-request-context.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/bookings/create-request-context.ts#L24-L31) (lines 24, 25, 26, 27, 28, 31)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-header-trust`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The booking create context derives `isOpsWalkIn`, `requestSource`, `bookingSource`, and `bookingDetails.created_by` directly from client-supplied `x-ops-walk-in` and `x-ops-email-provided` headers. The public `POST /api/bookings` route passes raw request headers into this helper, so an unauthenticated guest can submit `x-ops-walk-in: true` and have the booking persisted as an ops walk-in (`source: ops.walkin`, `created_by: ops.walkin`). Omitting `x-ops-email-provided` also makes downstream side-effects treat the email as not provided, suppressing the initial guest email even when the public payload contains an email address. This lets public callers spoof an internal ops channel and alter customer notification behavior without membership or CSRF checks.

## Recommendation

Do not derive trusted ops context from public request headers. Pass an explicit context from the authenticated `/api/ops/bookings` handler after membership and CSRF validation, and make the public booking route ignore or strip `x-ops-*` headers.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-24)
