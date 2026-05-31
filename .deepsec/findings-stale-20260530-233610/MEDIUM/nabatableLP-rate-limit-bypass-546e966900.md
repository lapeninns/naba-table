# [MEDIUM] Client-controllable IP headers can drive rate-limit identity

**File:** [`server/security/request.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/security/request.ts#L3-L56) (lines 3, 27, 48, 49, 55, 56)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

extractClientIp unconditionally trusts cf-connecting-ip, true-client-ip, and x-vercel-forwarded-for before optionally trusting x-forwarded-for. src/proxy.ts only strips x-ops-user-id, not these IP headers. If any request path reaches the app without a front proxy overwriting or stripping those names, a caller can send a forged cf-connecting-ip value and control the returned client IP. That IP feeds consumeRateLimit identifiers in auth signin/signup, availability, booking lookup/create/confirm, and shared API rate-limit helpers, allowing header rotation to create fresh buckets for brute force or abuse flows. The optional TRUST_FORWARDED_IP_HEADERS path has the same issue for x-forwarded-for when enabled, because it takes the first comma-separated value.

## Recommendation

Trust only a deployment-guaranteed client IP source, or strip all inbound client IP headers at the edge/proxy before setting a single internal header. If x-forwarded-for is needed, parse it against a configured trusted proxy chain and take the first untrusted hop instead of the first value.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-10-12)
