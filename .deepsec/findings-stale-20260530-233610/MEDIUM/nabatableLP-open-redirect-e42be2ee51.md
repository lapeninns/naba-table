# [MEDIUM] Forwarded host headers control OAuth callback redirect origin

**File:** [`src/app/api/ops/google-business-profile/_origin.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/ops/google-business-profile/_origin.ts#L34-L41) (lines 34, 35, 38, 40, 41)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `open-redirect`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

getRequestOrigin() prefers x-forwarded-host and x-forwarded-proto from the incoming request without validating them against the configured Nabatable app/root domains. The Google Business Profile callback routes use this helper as the base for NextResponse.redirect(). An attacker who can supply these headers can hit a public callback path such as /api/ops/google-business-profile/callback?error=access_denied and force a redirect to an attacker-controlled origin with the trusted Nabatable callback path and query string.

## Recommendation

Do not derive redirect origins from request Host or X-Forwarded-\* headers unless they are validated against an explicit allowlist. Prefer getTrustedAppOrigin() for OAuth callback redirects, or validate the resolved hostname is exactly the configured app/root host before using it.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
