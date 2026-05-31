# [MEDIUM] Availability rate limits can be bypassed by spoofing trusted IP headers

**File:** [`src/app/api/availability/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/availability/route.ts#L83-L123) (lines 83, 123)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The endpoint relies on requireApiRateLimit at lines 83 and 123, which builds its bucket from extractClientIp. The traced helper in server/security/request.ts trusts cf-connecting-ip, true-client-ip, and x-vercel-forwarded-for whenever req.ip is absent, while src/proxy.ts only strips x-ops-user-id and does not remove these IP headers. If the deployment path does not overwrite or strip those headers, an attacker can rotate a forged cf-connecting-ip value to get fresh availability:public and availability:tenant buckets, allowing high-volume capacity probing and scraping despite the intended limits.

## Recommendation

Only accept client IP headers from a verified trusted proxy/CDN boundary. Strip these headers at the app proxy before route handlers, prefer platform-provided request IP when available, or configure an allowlist of trusted forwarding hops before using forwarded IP values in rate-limit identifiers.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-26)
