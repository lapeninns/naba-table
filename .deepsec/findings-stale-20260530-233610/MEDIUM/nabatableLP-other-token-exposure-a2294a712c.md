# [MEDIUM] Secret route tokens can be forwarded to analytics providers

**File:** [`lib/analytics.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/lib/analytics.ts#L108-L122) (lines 108, 112, 122)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-token-exposure`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

track() sanitizes props through sanitizeAnalyticsProps(), then forwards them to Plausible and PostHog. The imported sanitizer strips query strings from path-like props, but it does not redact secret path segments. This is exploitable through the global client error reporter, which calls track('client_error_reported', { path }) for the current route. Public invitation URLs use /invite/[token], and that token is a lookup secret for invitation details; a client error on that page would send /invite/<token> to analytics providers.

## Recommendation

Add route-aware redaction before analytics dispatch, replacing sensitive path segments such as /invite/<token> and /api/team/invitations/<token> with stable placeholders. Prefer a shared URL sanitizer used by both analytics and logging.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-10)
