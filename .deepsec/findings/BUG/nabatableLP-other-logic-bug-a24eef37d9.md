# [BUG] Midnight hour rollover makes current time one day too far ahead

**File:** [`server/bookings/pastTimeValidation.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/bookings/pastTimeValidation.ts#L14-L244) (lines 14, 115, 116, 233, 244)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-logic-bug`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The insecure-crypto scanner hit is a false positive, but the custom timezone conversion has a real logic bug. `getCurrentTimeInTimezone()` formats the current instant with `Intl.DateTimeFormat('en-CA', { hour12: false })`; in this runtime that formatter emits `hour: "24"` for local times like 00:30. `normalizeIsoLocal24HourRollover()` then treats `YYYY-MM-DDT24:30:00` as the next calendar day at 00:30. As a result, during the first local hour after midnight, `serverTime` becomes roughly 24 hours in the future, and `assertBookingNotInPast()` can reject valid same-day future bookings as if they were in the past.

## Recommendation

Replace the custom Intl/string/Date conversion with a timezone-aware library already present in the repo, such as Luxon `DateTime.now().setZone(timezone)` and `DateTime.fromISO(..., { zone: timezone })`, or force an `h23` hour cycle and treat `24:xx` formatter output as `00:xx` on the same date. Add regression tests for 00:xx local times and DST boundaries.

## Revalidation

**Verdict:** fixed

`server/bookings/pastTimeValidation.ts` now requests `hourCycle: 'h23'` from the local-time formatters and treats any Intl-produced `24:xx` value as `00:xx` on the same displayed local date instead of advancing the date. Same-day future bookings during the first local hour after midnight are no longer pushed roughly one day into the past.

Evidence: `pnpm exec vitest run tests/server/bookings/past-time-validation.test.ts` passed on 2026-05-16. `pnpm exec prettier --check server/bookings/pastTimeValidation.ts tests/server/bookings/past-time-validation.test.ts` also passed.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-25)
