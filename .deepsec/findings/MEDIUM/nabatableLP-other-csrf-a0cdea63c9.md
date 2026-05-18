# [MEDIUM] Dual-sync mutation endpoints do not validate CSRF tokens server-side

**File:** [`src/components/features/restaurant-settings/dual-sync/DualSyncShell.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/restaurant-settings/dual-sync/DualSyncShell.tsx#L221-L276) (lines 221, 230, 276)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The shell triggers POST mutations for refresh, auto-export, and publish at lines 221, 230, and 276. The traced route handlers enforce admin membership but do not validate the CSRF cookie/header pair; the proxy only sets the cookie and fetchJson only sends the header. A forged credentialed POST can run sync operations for a victim admin if the request carries their session cookies.

## Recommendation

Add validateCsrfToken checks to the dual-sync refresh, publish, and auto-export POST handlers, returning 403/419 before any side effect.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-03)
