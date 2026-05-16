# [MEDIUM] KV cache can keep revoked short links active until expiry

**File:** [`cloudflare/booking-short-links/src/storage.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/cloudflare/booking-short-links/src/storage.ts#L81-L114) (lines 81, 83, 89, 90, 91, 92, 93, 111, 114)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `other-revocation-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

Short-link records are cached in KV with a TTL based only on expires_at, and getLinkByToken returns a cached record before consulting D1. If a booking recovery short link is later revoked by setting revoked_at in D1, an already cached record with revokedAt null will continue to be returned and resolved as active until the original expiry TTL elapses. Because these links wrap booking recovery access tokens, a compromised link can remain usable after revocation whenever the KV binding is enabled.

## Recommendation

Either do not cache revocable short-link records, purge/update the KV entry whenever revoked_at changes, or re-check revoked_at from D1 before redirecting. Add a cache-hit revocation test so a revoked D1 row cannot still redirect.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-11)
