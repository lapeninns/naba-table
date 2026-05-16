# [BUG] Duplicate bookings query parameters can crash the ops bookings page

**File:** [`src/app/app/(app)/bookings/page.tsx`](<https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/app/(app)/bookings/page.tsx#L16-L98>) (lines 16, 48, 51, 90, 92, 94, 97, 98)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-parameter-pollution-crash`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The page types searchParams values as strings, but Next.js can provide string[] for repeated query parameters. Duplicate values such as ?statuses=pending&statuses=confirmed reach parseStatuses(), which calls raw.split(), and ?query=a&query=b or ?tableLabel=a&tableLabel=b call .trim() on an array. This causes an authenticated server-render failure before the client-side membership guard can run.

## Recommendation

Change the search param type to string | string[] | undefined and normalize every parameter through a firstString()/firstStringArray-safe helper before parsing or calling string methods.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-06)

**Verdict:** fixed

`src/app/app/(app)/bookings/page.tsx` now normalizes all App Router search params
through `firstString` or `stringArray` before calling string-only parsers.

Evidence:

- `tests/server/ops-bookings-page-query-params.test.tsx` covers duplicated
  filter/query/status/date/table/time/window params and verifies normalized
  client props.
- `pnpm exec vitest run tests/server/ops-bookings-page-query-params.test.tsx`
