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

## Revalidation

**Verdict:** true-positive

The CSRF portion is still present: retryEmailDelivery uses raw fetch without the browser CSRF token, and the retry route does not enforce any CSRF validation before performing the resend. The route relies on requireSession and restaurant membership checks, which prove the victim is authorized but do not prove the request was intentionally made by the app UI. I also traced retryEmailDeliveryLogEntry, and it only checks that the delivery log exists, is failed or bounced, and has a bookingId; it does not impose a recent-delivery guard or retry throttle. The route itself also does not call requireApiRateLimit. An attacker needs a target deliveryLogId and the victim must be a member of the associated restaurant, so this is not a cross-tenant primitive. Within that targeted scope, a same-site forged POST can cause customer email sends under the victim session. The original medium severity is appropriate because the impact is bounded to replaying retryable delivery logs rather than arbitrary email content.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-06)
