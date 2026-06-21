# [MEDIUM] Cookie-authenticated menu import mutation lacks CSRF validation

**File:** [`src/app/api/ops/restaurants/[id]/menu/import/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/menu/import/route.ts#L15-L65) (lines 15, 21, 26, 65)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The POST handler relies on the Supabase session cookie and admin membership, but it never validates the x-csrf-token/cookie pair before reading form data and potentially applying a menu import. A same-site forged multipart request from a victim admin session could submit attacker-controlled CSV content and mutate menu data.

## Recommendation

Validate CSRF before request.formData() and before preview/apply work. Update the raw fetch client for menu import to send the existing CSRF header.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-18)
