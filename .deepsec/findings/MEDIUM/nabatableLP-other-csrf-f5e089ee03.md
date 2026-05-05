# [MEDIUM] Retry email mutation lacks CSRF protection

**File:** [`src/components/features/email-delivery/useOpsEmailDeliveryRetryState.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/email-delivery/useOpsEmailDeliveryRetryState.ts#L44) (lines 44)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The retry confirmation flow calls bookingService.retryEmailDelivery at line 44. Tracing that service shows it uses a raw credentialed JSON POST to /api/ops/email-delivery/retry without the x-csrf-token header that fetchJson normally adds, and the route parses the JSON body and authenticates the cookie session but never calls validateCsrfToken. The route does verify restaurant membership before resending, so this is not cross-tenant, but a same-site attacker or compromised sibling subdomain could cause an authenticated ops user to resend a known failed/bounced delivery-log email.

## Recommendation

Send the CSRF token on retry requests, preferably by using fetchJson or explicitly setting CSRF_HEADER_NAME, and enforce validateCsrfToken in src/app/api/ops/email-delivery/retry/route.ts before performing the resend.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)
