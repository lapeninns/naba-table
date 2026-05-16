# [BUG] Midnight hour normalization advances current time by one day

**File:** [`server/bookings/pastTimeValidation.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/bookings/pastTimeValidation.ts#L14-L244) (lines 14, 28, 115, 116, 244)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-logic-bug`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The scanner's insecure-crypto hit is a false positive, but the custom timezone conversion has a real edge-case bug. `Intl.DateTimeFormat(..., hour12: false)` can emit hour `24` for the first hour after local midnight, e.g. `2026-05-05T24:30:00`. `normalizeIsoLocal24HourRollover` converts that to `2026-05-06T00:30:00` by incrementing the date. `getCurrentTimeInTimezone` then returns a server time roughly 24 hours in the future, and `assertBookingNotInPast` can reject valid same-day future bookings as past during that midnight window.

## Recommendation

Avoid generating `24:xx` by setting `hourCycle: "h23"`, or normalize Intl-produced `24:xx` to `00:xx` on the same displayed date. Add regression tests for 00:00-00:59 across UTC and representative restaurant timezones.

## Revalidation

**Verdict:** fixed

`server/bookings/pastTimeValidation.ts` now uses `hourCycle: 'h23'` and normalizes fallback `24:xx` formatter output to `00:xx` without incrementing the local date. Regression coverage fixes the midnight-window path for `Europe/London` and verifies current-time conversion does not roll forward by a day.

Evidence: `pnpm exec vitest run tests/server/bookings/past-time-validation.test.ts` passed on 2026-05-16. `pnpm exec prettier --check server/bookings/pastTimeValidation.ts tests/server/bookings/past-time-validation.test.ts` also passed.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-25)
