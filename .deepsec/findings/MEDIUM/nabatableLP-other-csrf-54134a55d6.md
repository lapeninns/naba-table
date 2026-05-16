# [MEDIUM] Email delivery retry POST bypasses the CSRF helper

**File:** [`src/services/ops/bookings.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/services/ops/bookings.ts#L877-L881) (lines 877, 879, 880, 881)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

retryEmailDelivery uses raw fetch with credentials: include and only a Content-Type header, so it does not attach the x-csrf-token that fetchJson adds. Tracing the called handler at src/app/api/ops/email-delivery/retry/route.ts shows it parses JSON, calls requireSession, checks restaurant membership, and retries/resends booking email, but never calls validateCsrfToken. A targeted attacker with a known deliveryLogId could cause an authenticated staff browser to replay a booking email under the victim session.

## Recommendation

Use fetchJson or explicitly attach CSRF_HEADER_NAME from getBrowserCsrfToken, and enforce validateCsrfToken(request) in the retry route before parsing or mutating.

## Revalidation

**Verdict:** true-positive

The service method retryEmailDelivery still uses raw fetch rather than fetchJson, so it does not attach the x-csrf-token header that fetchJson would add. The called route, src/app/api/ops/email-delivery/retry/route.ts, parses request.json(), calls requireSession(), checks the user’s restaurant membership through the booking, and then retries the failed or bounced email, but it never calls validateCsrfToken, validateCsrfProtectedMutation, withCsrfProtectedMutation, or withOpsMutation. The membership check prevents cross-tenant retry, but it does not protect the victim’s own restaurant from a forged state-changing request. Supabase auth cookies are configured for the root domain with SameSite=Lax, so same-site contexts across the root/app hosts can send the victim’s cookies, while the proxy only sets the CSRF cookie and does not enforce it. A targeted attacker who knows a failed or bounced deliveryLogId for the victim restaurant can cause the victim staff browser to replay that booking email. The route has no independent Origin or fetch-metadata guard that would compensate for the missing CSRF token. The finding is therefore real with the stated targeted precondition.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-06)
