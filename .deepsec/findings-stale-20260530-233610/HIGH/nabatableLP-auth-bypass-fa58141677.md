# [HIGH] Safe-method guard trusts spoofable x-ops-user-id before backend session validation

**File:** [`server/auth/guards.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/auth/guards.ts#L35-L266) (lines 35, 36, 37, 261, 262, 263, 264, 265, 266)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** medium • **Slug:** `auth-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

getOpsUserIdFromHeader accepts any UUID-shaped x-ops-user-id request header, and withOpsMutation uses it on safe methods to synthesize an authenticated User before calling requireSession. The only thing making that header trustworthy is src/proxy.ts stripping and re-adding it, but that is a Next.js proxy/middleware-layer assumption rather than a backend guard around the handler. If an ops safe-method route is reached without the proxy applying, or if a matcher/rewrite/deployment gap lets a client-supplied x-ops-user-id through, the backend auth helper treats the request as the supplied user ID. Downstream helpers such as withBookingAuthorization then run authorization logic using that spoofed user identity before service-role reads return booking or assignment data.

## Recommendation

Do not let route handlers treat x-ops-user-id as authentication proof. Always resolve the Supabase session in withOpsMutation, then optionally compare a forwarded header to the resolved user.id for consistency/performance telemetry. If the fast path must remain, replace the raw header with a signed internal assertion that clients cannot forge and fail closed unless its signature and freshness verify.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-06)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)
