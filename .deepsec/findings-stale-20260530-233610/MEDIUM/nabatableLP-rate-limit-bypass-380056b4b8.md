# [MEDIUM] Bulk customer export throttle can be bypassed by spoofing client IP

**File:** [`src/app/api/ops/customers/export/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/ops/customers/export/route.ts#L128) (lines 128)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The export endpoint correctly attempts to limit bulk PII exports to 6 per minute, but the shared limiter key includes extractClientIp. That helper trusts caller-controlled forwarded IP headers before any trusted-proxy validation, so an authenticated restaurant member can rotate cf-connecting-ip/true-client-ip/x-vercel-forwarded-for values and bypass the intended per-user export limit.

## Recommendation

Key this endpoint primarily on userId and restaurantId, or enforce separate user and IP buckets. Only accept forwarded IP headers from a verified proxy path and ignore client-supplied variants.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-06)
