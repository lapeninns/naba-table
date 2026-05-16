# [MEDIUM] Logo uploads can be abused for storage exhaustion

**File:** [`src/app/api/ops/restaurants/[id]/logo/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/logo/route.ts#L125-L141) (lines 125, 133, 136, 141)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route accepts a fresh 2 MB upload on every request, creates or uses a public bucket with a service-role client, and writes each file to a unique path. There is no consumeRateLimit call, per-restaurant quota, or cleanup of superseded logos, so a malicious or compromised restaurant admin can repeatedly upload files and consume storage/CDN resources.

## Recommendation

Add per-user and per-restaurant upload rate limits, enforce storage quotas, and delete or expire replaced logo objects.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-27)
