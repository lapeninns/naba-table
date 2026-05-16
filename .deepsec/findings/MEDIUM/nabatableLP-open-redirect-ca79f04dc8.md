# [MEDIUM] OAuth callback redirects using unvalidated request origin

**File:** [`src/app/api/ops/google-business-profile/callback/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/google-business-profile/callback/route.ts#L12-L45) (lines 12, 43, 45)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `open-redirect`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The callback builds redirect destinations from getRequestOrigin(req) and from result.returnPath without validating the host. getRequestOrigin trusts x-forwarded-host, x-forwarded-proto, and Host headers. The error paths call buildRedirect before any state validation, and the success path redirects to new URL(result.returnPath || DEFAULT_RETURN_PATH, getRequestOrigin(req)). If the deployment forwards attacker-controlled Host/X-Forwarded-Host values, the public callback can emit a Location header for an attacker-controlled origin; the same helper is also used when creating the stored OAuth returnPath in the connect route.

## Recommendation

Build callback redirects from a configured app origin or an allowlisted root/app host, prefer relative redirects for DEFAULT_RETURN_PATH, and validate stored returnPath with the existing redirect sanitization logic before redirecting.

## Revalidation

**Verdict:** true-positive

The callback still builds redirect URLs from getRequestOrigin(req). That helper trusts x-forwarded-host first, then Host, and there is no allowlist against NEXT_PUBLIC_ROOT_DOMAIN or the app host. The error paths call buildRedirect before any state validation, so any request that reaches the app with an attacker-controlled forwarded host can produce a Location header for that origin. The success path also redirects with new URL(result.returnPath || DEFAULT_RETURN_PATH, getRequestOrigin(req)). The connect routes store returnPath as an absolute URL built from the same unvalidated origin helper, and the callback does not pass result.returnPath through the existing sanitizeRedirect helper. A deployment-level host allowlist could mitigate this, but I found no such mitigation in src/proxy.ts, next.config.js, or this callback flow.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-23)
