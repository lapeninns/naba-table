# [BUG] Duplicate code query parameter can crash recovery error page

**File:** [`src/app/(public)/bookings/recover/error/page.tsx`](<https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/(public)/bookings/recover/error/page.tsx#L26-L151>) (lines 26, 74, 151)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-parameter-pollution-crash`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The page types searchParams.code as a string, but Next.js App Router can provide string[] for duplicated query parameters. A request such as /bookings/recover/error?code=A&code=B makes code an array; copyByCode[code] falls back safely, but line 151 calls code.replaceAll(...), which throws because arrays do not have replaceAll. This produces a user-triggerable 500 on a public error route. React rendering of the value is escaped, so this is not XSS.

## Recommendation

Type searchParams as Record<string, string | string[] | undefined> and normalize code with a helper that selects the first string value before using string methods.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-09)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-25)
