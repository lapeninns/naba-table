# [MEDIUM] Email retry mutation is CSRFable and unthrottled

**File:** [`src/services/ops/bookings.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/services/ops/bookings.ts#L875-L881) (lines 875, 877, 881)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

retryEmailDelivery() uses raw fetch with credentials: include and does not attach the shared x-csrf-token header. The /api/ops/email-delivery/retry POST route parses JSON and uses the session cookie but does not call validateCsrfToken(), and the retry path resends failed/bounced emails without a recent-delivery guard or route-level rate limit. A same-site attacker context can submit retries with the victim staff session and trigger customer email sends.

## Recommendation

Use fetchJson or explicitly attach the CSRF header, enforce validateCsrfToken() at the start of the retry route, and add a per-user/per-delivery-log rate limit.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-20)
