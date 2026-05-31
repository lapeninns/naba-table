# [MEDIUM] Google Business Profile callback redirects using an untrusted request origin

**File:** [`src/app/api/ops/google-business-profile/callback/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/ops/google-business-profile/callback/route.ts#L20-L89) (lines 20, 41, 47, 53, 64, 74, 76, 89)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `open-redirect`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The callback builds redirect URLs with `getRequestOrigin(req)` at both the error path and success path. That helper trusts `x-forwarded-host`, `host`, and `x-forwarded-proto` without checking them against the configured app origin. Because this callback is intentionally public in the proxy, an attacker can hit the callback error paths without authentication and, in deployments where those headers are forwarded from the client, force a `Location` header such as `https://attacker.example/app/settings/restaurant/google-business-profile?gbp=error...`. `sanitizeGoogleBusinessProfileReturnPath()` only constrains the path; it does not constrain the origin selected by `getRequestOrigin(req)`.

## Recommendation

Use a trusted configured origin, such as `getTrustedAppOrigin()`, for production callback redirects. Only honor request-derived origins for explicit localhost development cases, or validate `host`/`x-forwarded-host` against an allowlist derived from `NEXT_PUBLIC_ROOT_DOMAIN` and the app host.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
