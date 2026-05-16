# [MEDIUM] Table and zone mutations do not enforce CSRF validation

**File:** [`src/app/app/(app)/settings/restaurant/tables/page.tsx`](<https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/app/(app)/settings/restaurant/tables/page.tsx#L12>) (lines 12)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The table settings client performs cookie-authenticated POST/PATCH/DELETE requests to table and zone APIs. Those mutating handlers do not call validateCsrfToken; the client helper adds a CSRF header, but the server accepts requests without verifying it. If an authenticated staff browser can be induced to send same-site requests, seating layout and capacity can be changed without user intent.

## Recommendation

Add validateCsrfToken checks to all mutating /api/ops/tables and /api/ops/zones handlers before reading the body or performing writes.

## Revalidation

**Verdict:** fixed

The current table and zone mutation handlers all call `withCsrfProtectedMutation` before executing their write logic. That wrapper calls `validateCsrfProtectedMutation`, requires an unsafe HTTP method, and compares the CSRF header with the CSRF cookie using `timingSafeEqual`. `POST /api/ops/tables`, `PATCH` and `DELETE /api/ops/tables/[id]`, `POST /api/ops/zones`, and `PATCH` and `DELETE /api/ops/zones/[id]` are all wrapped. The client helper adding a CSRF header is no longer the only protection because the server now rejects missing or invalid tokens with 403. The described same-site forged mutation path is therefore patched.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)
