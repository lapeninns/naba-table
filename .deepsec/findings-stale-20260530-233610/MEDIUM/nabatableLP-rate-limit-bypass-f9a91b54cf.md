# [MEDIUM] Failed cron authentication is logged before any rate limit

**File:** [`server/security/cron-auth.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/security/cron-auth.ts#L107-L117) (lines 107, 109, 116, 117)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

requireCronAuth calls logCronAuthFailure for missing or invalid bearer tokens and returns before consumeRateLimit is reached. logCronAuthFailure writes a security event through the observability pipeline, so unauthenticated attackers can repeatedly hit public cron routes with bad credentials and create unbounded log/database write amplification.

## Recommendation

Apply a cheap per-IP/per-job rate limit before recording failed cron authentication events, or aggregate/sample repeated failures. Keep the existing post-auth rate limit for valid cron executions.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
