# [HIGH_BUG] Context booking lookup fails open to no conflicts

**File:** [`server/capacity/table-assignment/supabase.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/capacity/table-assignment/supabase.ts#L379-L432) (lines 379, 430, 432)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-fail-open`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

loadContextBookings returns an empty array on any Supabase query error. Callers use that result to build busy maps and decide whether tables are free. If the lookup fails because of schema, RLS, timeout, or service-client issues, assignment and quoting flows continue as though there are no conflicting bookings, which can allow overbooking.

## Recommendation

Fail closed for context booking lookup errors in assignment/quote paths. Throw a typed error and have callers return a retryable 503/409 instead of treating the restaurant as conflict-free.

## Revalidation

**Verdict:** fixed

`loadContextBookings` no longer returns an empty conflict set on Supabase errors. It throws `ManualSelectionInputError` with code `CONTEXT_BOOKINGS_LOOKUP_FAILED` and status 503, so quote/manual/direct-assignment callers fail closed instead of building busy maps from missing data. Focused evidence: `tests/server/capacity/table-assignment-guards.test.ts` asserts lookup errors reject with the typed fail-closed error; focused Vitest, targeted ESLint, and Prettier checks passed on 2026-05-16.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)
