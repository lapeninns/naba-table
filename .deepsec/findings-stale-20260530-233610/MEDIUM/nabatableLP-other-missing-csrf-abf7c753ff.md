# [MEDIUM] Cookie-authenticated email retry POST lacks CSRF validation

**File:** [`src/app/api/ops/email-delivery/retry/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/email-delivery/retry/route.ts#L105-L206) (lines 105, 120, 206)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-missing-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The POST handler parses a JSON body, authenticates with the Supabase session cookie via requireSession(), and can trigger retryEmailDeliveryLogEntry() to resend booking email, but it never calls validateCsrfToken() or otherwise verifies the x-csrf-token double-submit token. The global proxy only sets the CSRF cookie; it does not validate it for /api/ops routes. A request that carries the victim's session cookies can force a logged-in staff user to retry a failed or bounced customer email.

## Recommendation

Validate the CSRF token at the start of the POST handler before parsing or mutating, and update the client path to send the existing x-csrf-token header, preferably by using the shared fetchJson helper.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-25)
