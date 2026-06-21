# [MEDIUM] Public booking rate limits depend on spoofable forwarded IP headers

**File:** [`src/app/api/bookings/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/bookings/route.ts#L13-L37) (lines 13, 37)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

Both GET and POST pass extractClientIp(req) into downstream rate-limited booking lookup/create flows. The traced extractor unconditionally trusts cf-connecting-ip, true-client-ip, and x-vercel-forwarded-for before falling back to unknown. If the deployment path does not overwrite or strip these request headers, an attacker can rotate one of them to get a fresh bookings:lookup or bookings:create rate-limit bucket.

## Recommendation

Only trust forwarding headers after verifying the request came through the expected proxy/CDN, or use a platform-provided immutable client IP. At minimum, have the edge overwrite these headers and reject direct origin traffic that can supply them.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-24)
