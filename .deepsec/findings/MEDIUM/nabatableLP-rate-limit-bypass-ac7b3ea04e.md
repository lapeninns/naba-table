# [MEDIUM] Auth throttles and guest captcha gating trust spoofable request headers

**File:** [`src/app/api/auth/signin/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/auth/signin/route.ts#L109-L285) (lines 109, 110, 111, 112, 175, 201, 202, 203, 240, 242, 243, 285)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

Password attempts are rate-limited with buildPasswordRateLimitId using x-real-ip or the first x-forwarded-for value, and magic-link throttling uses extractClientIp(req) with the same header trust pattern. The magic-link Turnstile requirement is also conditional on classifySigninSurface(hostname, rootDomain), where hostname comes from request headers. A direct client can set Origin or X-Forwarded-Host to the app host to be classified as app_ops and avoid the public_guest captcha, and can rotate x-real-ip or x-forwarded-for to create new rate-limit identifiers. CSRF does not protect this because an unauthenticated attacker can obtain their own CSRF cookie/header pair.

## Recommendation

Derive client IP and surface only from trusted platform metadata or a trusted-proxy parser that strips untrusted hops. Add email/account-level throttles for password attempts and magic links, and base Turnstile decisions on the configured route/surface rather than request-supplied host headers.

## Revalidation

**Verdict:** true-positive

The current code uses spoofable request metadata for both abuse-control identity and surface classification. Password throttling reads x-real-ip and x-forwarded-for directly in buildPasswordRateLimitId, while magic-link throttling reads x-forwarded-for through extractClientIp when req.ip is unavailable. A client can rotate those header values to evade per-IP counters, and the password path has no separate account-scoped limiter. The Turnstile decision is based on classifySigninSurface(hostname, rootDomain), where hostname comes from parseHostname(req). Because parseHostname prioritizes x-forwarded-host and x-original-host, a request to the public shared /api/auth/signin endpoint can claim x-forwarded-host: app.nabatable.com and be classified as app_ops, skipping the public_guest CAPTCHA branch. CSRF does not prevent this because the endpoint is public and attackers can mint their own double-submit cookie/header pair. src/proxy.ts does not sanitize those forwarded headers for shared auth APIs before the route handles them. The global magic-link limiter is only a partial backstop and does not fix the spoofed per-IP or spoofed surface decision.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-23)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-19)
