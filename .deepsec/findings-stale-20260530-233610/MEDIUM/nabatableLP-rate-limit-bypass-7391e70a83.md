# [MEDIUM] CSV import has no request size, row count, or rate limit

**File:** [`src/app/api/ops/restaurants/[id]/drinks/import/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/drinks/import/route.ts#L26-L65) (lines 26, 40, 47, 65)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route reads uploaded files fully into memory with File.text(), parses all rows, and can apply large arrays to the database without any route-level size cap or consumeRateLimit call. An authenticated admin account, or a CSRF path if the CSRF issue is unfixed, can repeatedly submit very large CSVs to consume server memory/CPU and database capacity.

## Recommendation

Add per-user/restaurant rate limiting, enforce maximum Content-Length/file sizes before reading text, cap CSV rows/cells, and fail early with 413/429. Consider streaming parsing for large imports.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-18)
