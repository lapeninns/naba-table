# [MEDIUM] FoodMenus mutation endpoints rely on session cookies without server-side CSRF validation

**File:** [`src/components/features/restaurant-settings/dual-sync/FoodMenusImportReviewPanel.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/restaurant-settings/dual-sync/FoodMenusImportReviewPanel.tsx#L290-L367) (lines 290, 367)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The panel triggers state-changing POSTs for Google menu refresh and review decisions at lines 290 and 367. Tracing those calls shows the route handlers only perform session/admin checks and do not call validateCsrfToken; fetchJson adds an x-csrf-token header, but the backend never validates it. A credentialed cross-site or same-site attacker could trigger menu refreshes or known review decisions with the victim admin's cookies.

## Recommendation

Require validateCsrfToken on the FoodMenus refresh and decision POST route handlers before parsing or applying the request body.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-03)
