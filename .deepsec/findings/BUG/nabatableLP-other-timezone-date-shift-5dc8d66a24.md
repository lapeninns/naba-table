# [BUG] Date-only reservations can render as the previous day in western timezones

**File:** [`reserve/shared/formatting/booking.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/reserve/shared/formatting/booking.ts#L76-L244) (lines 76, 108, 244)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-timezone-date-shift`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The date-only formatters construct an instant at midnight UTC with new Date(`${date}T00:00:00Z`) and then format that instant in the requested venue timezone. For valid IANA timezones west of UTC, midnight UTC is still the previous local calendar day. For example, formatting `2026-05-05` with `America/New_York` renders `Mon, 04 May 2026`. The restaurant timezone validators allow arbitrary valid IANA zones, so non-London venues can display incorrect reservation dates in customer-facing or ops-facing labels.

## Recommendation

Treat reservation date strings as local calendar dates, not UTC instants. Parse the `YYYY-MM-DD` parts and format them timezone-independently, use a PlainDate-style helper, or format a UTC date with `timeZone: 'UTC'` for date-only display while keeping timezone-aware formatting only for actual instants.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-27)

**Verdict:** fixed

`reserve/shared/formatting/booking.ts` now parses `YYYY-MM-DD` reservation dates as calendar dates and formats date-only labels with a fixed UTC formatter. Date-only labels no longer shift to the previous local day for western venue timezones; timezone-aware formatting remains in the `Date`/instant-based helpers.

Evidence: `pnpm exec vitest run tests/reserve/useCreateOpsReservation.test.ts tests/reserve/booking-formatting.test.ts` passed on 2026-05-16. `pnpm exec prettier --check reserve/shared/formatting/booking.ts tests/reserve/booking-formatting.test.ts tests/reserve/useCreateOpsReservation.test.ts` also passed.
