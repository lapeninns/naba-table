# [BUG] Duplicate tab query parameter can crash the bookings page

**File:** [`src/app/guest/bookings/page.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/guest/bookings/page.tsx#L15-L20) (lines 15, 20)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-logic-bug`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The page types searchParams.tab as a string and passes it directly into buildGuestBookingsViewModel. In Next.js App Router, duplicate query parameters can be delivered as string arrays, e.g. /guest/bookings?tab=upcoming&tab=past. The downstream normalizeBookingsTab helper calls raw.toLowerCase(), which will throw if raw is an array. Auth is enforced before this normalization, so this is not an auth bypass, but an authenticated request with duplicated tab parameters can produce a server render error.

## Recommendation

Type searchParams as string | string[] | undefined and normalize defensively before passing tab onward, or update normalizeBookingsTab to accept unknown input and choose the first string value when an array is received.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-05)
