# [MEDIUM] Full customer PII export has no abuse throttling

**File:** [`src/app/api/ops/customers/export/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/customers/export/route.ts#L56-L136) (lines 56, 93, 105, 115, 121, 136)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

After session and restaurant-membership checks, the route creates a service-role Supabase client and exports all matching customer history to CSV. There is no per-user/per-restaurant rate limit, export size cap, or async job/audit gate around this bulk PII endpoint. A compromised or low-privilege restaurant account can repeatedly scrape the guest list and force repeated full export queries.

## Recommendation

Add `consumeRateLimit` keyed by user and restaurant, record export audit events, consider requiring admin membership for bulk exports, and enforce a maximum export size or background job flow for large datasets.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-29)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-06)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
