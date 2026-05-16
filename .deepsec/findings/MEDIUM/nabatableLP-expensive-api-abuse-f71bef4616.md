# [MEDIUM] Test email sender lacks throttling and CSRF validation

**File:** [`src/app/api/ops/restaurants/[id]/email-templates/[templateKey]/test-send/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/email-templates/[templateKey]/test-send/route.ts#L10-L42) (lines 10, 21, 33, 39, 42)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `expensive-api-abuse`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

After the owner/manager check, the handler accepts an arbitrary toEmail and sends through the configured email provider without any consumeRateLimit call or CSRF token validation. The Resend idempotency key only covers the template key and recipient, so an attacker with an admin session, or a same-site CSRF primitive, can vary recipients and repeatedly send provider-backed test emails.

## Recommendation

Validate the ops CSRF token, add per-user/restaurant/IP rate limiting, and consider restricting test recipients to the signed-in user or verified team emails unless explicitly allowed.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-04)
