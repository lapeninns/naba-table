# [MEDIUM] Public lead throttling can be bypassed with spoofed client IP headers

**File:** [`src/app/api/lead/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/lead/route.ts#L33) (lines 33)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The unauthenticated lead endpoint relies on requireApiRateLimit at lines 33-39 before inserting into the leads table. That limiter derives its bucket from extractClientIp, which trusts cf-connecting-ip, true-client-ip, and x-vercel-forwarded-for when req.ip is absent. src/proxy.ts only strips x-ops-user-id and does not strip or verify these IP headers. If the deployment path does not overwrite all of those headers, an attacker can rotate a forged trusted IP header to get a fresh lead:create bucket and submit high-volume junk leads despite the intended 5/minute limit.

## Recommendation

Only trust proxy IP headers that are guaranteed to be set by the deployment edge, strip client-supplied IP headers before app code, and consider using a secondary limiter keyed by normalized email or other abuse signals for this public endpoint.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-10-26)
