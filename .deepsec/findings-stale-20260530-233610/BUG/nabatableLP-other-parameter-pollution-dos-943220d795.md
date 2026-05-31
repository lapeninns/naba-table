# [BUG] Duplicate email-delivery query parameters can crash server rendering

**File:** [`src/app/app/(app)/email-delivery/page.tsx`](<https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/app/(app)/email-delivery/page.tsx#L40-L117>) (lines 40, 63, 80, 95, 117)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-parameter-pollution-dos`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The page assumes every search parameter is a string, but Next App Router can provide string arrays for duplicate parameters. Several parser helpers call string-only methods such as raw.trim() and raw.split() without checking Array.isArray. URLs such as /email-delivery?status=sent&status=failed or duplicate restaurantId/fixture/messageId parameters can throw during the server component render and produce a 500 for an authenticated ops user.

## Recommendation

Change the searchParams type to Record<string, string | string[] | undefined> and normalize each value through a helper that selects the first string or rejects arrays before calling trim/split.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-24)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-06)
