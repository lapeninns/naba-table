# [BUG] Duplicate code query parameter can crash the public recovery error page

**File:** [`src/app/(public)/bookings/recover/error/page.tsx`](<https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/(public)/bookings/recover/error/page.tsx#L26-L151>) (lines 26, 74, 75, 151)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-parameter-pollution-crash`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

Next.js searchParams can provide string[] when a query parameter is repeated, but this page types code as string only. A URL such as /bookings/recover/error?code=A&code=B makes code an array; the lookup at line 75 coerces it, but line 151 calls code.replaceAll(), which arrays do not implement, causing a server-render error on a public route.

## Recommendation

Type search params as string | string[] and normalize code with a helper that selects the first string value or falls back to INVALID_ACCESS_TOKEN before using string methods.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-24)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-25)

**Verdict:** fixed

`src/app/(public)/bookings/recover/error/page.tsx` now normalizes duplicated
`code` params with `firstString` before lookup and `replaceAll` rendering.

Evidence:

- `tests/guest/public-booking-message-pages.test.tsx` covers duplicated recovery
  `code` params and verifies the reason details render without crashing.
- `pnpm exec vitest run tests/guest/public-booking-message-pages.test.tsx`
