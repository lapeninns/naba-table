# [BUG] Duplicate focus query parameters can crash the customers page

**File:** [`src/app/app/(app)/customers/page.tsx`](<https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/app/(app)/customers/page.tsx#L13-L18>) (lines 13, 16, 18)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-parameter-pollution-dos`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The page types searchParams as Record<string, string> and forwards resolvedSearchParams.focus directly to OpsCustomersClient. In Next App Router, duplicate query parameters can be represented as string arrays. A URL such as /customers?focus=a&focus=b can therefore pass an array into the client path, where the imported focus logic calls focusCustomerId.toLowerCase() once rows are loaded. This is not an auth bypass or data exposure, but it lets an authenticated user or malicious internal link trigger a client-side page crash.

## Recommendation

Type searchParams as Record<string, string | string[] | undefined>, normalize with a first-string helper before use, and optionally validate focus as a UUID/email before passing it to the client.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-06)
