# [BUG] Duplicate bookings query parameters can crash server render

**File:** [`src/app/app/(app)/bookings/page.tsx`](<https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/app/(app)/bookings/page.tsx#L16-L98>) (lines 16, 90, 92, 94, 97, 98)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-parameter-pollution-crash`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The ops bookings page declares all search parameters as strings, but duplicated App Router query parameters can arrive as string[]. Several values are then passed into string-only code paths: query.trim(), parseStatuses(...).split(','), tableLabel.trim(), and sanitizeTimeParam(...).trim(). An authenticated user or crafted staff link with repeated query parameters such as ?query=a&query=b or ?statuses=pending&statuses=confirmed can trigger a server-render 500. The restaurantId flow is otherwise mitigated by OpsSessionProvider membership checks and the downstream ops APIs re-check membership before tenant data access.

## Recommendation

Use the real App Router type for searchParams values, normalize each parameter to a single string before parsing, and keep the existing validation helpers after normalization.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-06)

**Verdict:** fixed

`src/app/app/(app)/bookings/page.tsx` now uses the real App Router search param
shape and normalizes duplicated values before calling `.trim()`, `.split()`,
date, time, table, and window parsers.

Evidence:

- `tests/server/ops-bookings-page-query-params.test.tsx` covers duplicated
  bookings query params and verifies normalized props passed to the real client
  boundary.
- `pnpm exec vitest run tests/server/ops-bookings-page-query-params.test.tsx`
