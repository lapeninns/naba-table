# [MEDIUM] Rate limit key can be reset with spoofed forwarded IP headers

**File:** [`src/app/api/ops/bookings/status-summary/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/ops/bookings/status-summary/route.ts#L104) (lines 104)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route relies on requireApiRateLimit, but that helper builds a single bucket key from userId, tenantId, and extractClientIp. extractClientIp trusts cf-connecting-ip, true-client-ip, and x-vercel-forwarded-for without validating that the request came through a trusted proxy. On a client-reachable deployment, an authenticated caller can vary those headers and get a fresh bucket for the same user and restaurant.

## Recommendation

Do not include untrusted forwarded headers in authenticated user limit keys. Prefer a stable user/tenant bucket, and only use proxy-provided IPs after platform-specific trust validation or as a separate secondary bucket.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)
