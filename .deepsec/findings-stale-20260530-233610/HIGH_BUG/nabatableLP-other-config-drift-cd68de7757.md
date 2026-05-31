# [HIGH_BUG] Production rate limiting can fail at request time after passing env validation

**File:** [`server/security/rate-limit.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/security/rate-limit.ts#L58-L162) (lines 58, 60, 61, 71, 73, 139, 140, 141, 160, 162)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** medium • **Slug:** `other-config-drift`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

consumeRateLimit treats Cloudflare gateway credentials as mandatory in production and throws when they are missing; if a configured gateway request fails, it then attempts the memory fallback, which also throws in production. The related env schema keeps CLOUDFLARE_EMAIL_QUEUE_GATEWAY_URL and CLOUDFLARE_EMAIL_QUEUE_GATEWAY_TOKEN optional, and the production env template does not define them while documenting ALLOW_MEMORY_RATE_LIMIT_IN_PROD, which this file never reads. A production deploy can therefore pass startup validation and then return 503/500 from every route that calls consumeRateLimit, including auth and booking endpoints.

## Recommendation

Make the Cloudflare gateway URL/token required in the production env schema and production template, or implement a deliberate documented production fallback controlled by an env flag. Prefer failing during startup/config validation rather than on the first user request.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-23)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-11)
