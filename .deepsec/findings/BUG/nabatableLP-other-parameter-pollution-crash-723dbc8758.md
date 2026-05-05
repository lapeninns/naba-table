# [BUG] Duplicate tab query parameters can crash the authenticated bookings page

**File:** [`src/app/guest/bookings/page.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/guest/bookings/page.tsx#L15-L20) (lines 15, 20)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-parameter-pollution-crash`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The page types searchParams.tab as a single string and passes it through to buildGuestBookingsViewModel. In the App Router, duplicate query parameters can be delivered as string[], and normalizeBookingsTab later calls raw.toLowerCase(). An authenticated request such as /guest/bookings?tab=past&tab=upcoming can therefore throw a TypeError and render the route error state. This does not bypass auth or expose data because requireUser runs before the tab normalization, but it is a user-triggerable availability/UX bug.

## Recommendation

Type tab as string | string[] | undefined and normalize arrays before calling normalizeBookingsTab, for example by taking the first value or rejecting duplicated tab parameters.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-05)
