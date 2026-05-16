# [MEDIUM] Password and magic-link throttles trust spoofable client IP headers

**File:** [`src/app/api/auth/signin/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/auth/signin/route.ts#L109-L243) (lines 109, 110, 111, 112, 113, 202, 203, 240, 243)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The password limiter key is built from x-real-ip or the first x-forwarded-for value, both read directly from the request headers. The magic-link path also uses extractClientIp(), which falls back to x-forwarded-for. If the edge platform does not overwrite these headers before the route sees them, an attacker can rotate header values while targeting the same email to bypass the 5-attempt password window and the per-IP magic-link throttle. The magic-link global limiter still provides a partial backstop, but the password path has no comparable global limiter in this handler.

## Recommendation

Use a trusted proxy-provided client IP source that strips inbound spoofed forwarding headers, or centralize IP extraction behind a helper that only trusts configured proxy headers. Add a secondary email/account-scoped limiter for password attempts so IP rotation cannot remove the cap.

## Revalidation

**Verdict:** true-positive

The password limiter key is built by buildPasswordRateLimitId from x-real-ip, then the first x-forwarded-for value, then unknown. A direct attacker can rotate those headers to produce distinct identifiers like auth:password:1.2.3.4:victim@example.com and auth:password:5.6.7.8:victim@example.com, bypassing the route's 5-attempt window if the deployment does not overwrite those headers before Next sees them. There is no email-only password limiter in this handler to preserve a cap when IP identity changes. The magic-link path calls extractClientIp(req), which uses req.ip if present but otherwise trusts the first x-forwarded-for value. consumeMagicLinkSigninThrottle has an IP bucket and a global bucket; rotating x-forwarded-for bypasses the IP bucket, leaving only the coarse global limit of 120 per 10 minutes. CSRF is not a real barrier for this abuse because an unauthenticated client can obtain its own CSRF cookie/header pair and call the public endpoint directly. src/proxy.ts passes shared auth APIs through and does not canonicalize these IP headers. This is therefore a real application-level rate-limit bypass, with exploitability depending only on whether the outer edge strips or overwrites spoofed forwarding headers.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-23)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-19)
