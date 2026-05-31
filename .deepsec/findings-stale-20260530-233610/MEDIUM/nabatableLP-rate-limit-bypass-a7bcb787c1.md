# [MEDIUM] Confirmation token rate limit can be bypassed by spoofing trusted IP headers

**File:** [`src/app/api/bookings/confirm/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/bookings/confirm/route.ts#L35-L38) (lines 35, 38)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The token brute-force guard derives clientIp with extractClientIp at line 35 and uses anonymizeIp(clientIp) in the consumeRateLimit identifier at lines 38-42. The imported extractor trusts cf-connecting-ip, true-client-ip, and x-vercel-forwarded-for without this route or src/proxy.ts proving those headers came from a trusted edge. A caller who can supply those headers can rotate the apparent IP and avoid the 20 requests/minute bucket for confirmation token attempts.

## Recommendation

Use a client IP source that cannot be supplied by the caller, or strip/overwrite forwarding headers at the trusted edge before they reach Next.js. Keep the confirmation limiter keyed on that trusted IP source.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-24)
