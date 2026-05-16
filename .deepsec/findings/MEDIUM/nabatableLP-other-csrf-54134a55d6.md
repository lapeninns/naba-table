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

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-20)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
