# [MEDIUM] Sign-in rate limits rely on spoofable client IP headers

**File:** [`src/app/api/auth/signin/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/auth/signin/route.ts#L73-L276) (lines 73, 74, 75, 207, 210, 276)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

Password and magic-link throttles build their identifiers from extractClientIp. That imported helper trusts cf-connecting-ip, true-client-ip, and x-vercel-forwarded-for when req.ip is absent, without proving those headers were set by a trusted edge. If client-supplied versions reach the app, an attacker can rotate the header value to bypass the per-IP password throttle and the per-IP magic-link throttle; the magic-link flow still has a global cap, but the per-client control is ineffective.

## Recommendation

Only trust deployment-specific IP headers after the edge strips and reissues them, prefer a runtime-provided client IP, and ignore client-supplied CF/Vercel IP headers on untrusted paths.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-19)
