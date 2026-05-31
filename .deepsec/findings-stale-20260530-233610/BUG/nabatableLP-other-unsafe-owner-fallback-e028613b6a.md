# [BUG] Seeded restaurant ownership falls back to the first auth user

**File:** [`scripts/seed-restaurant.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/seed-restaurant.ts#L74-L122) (lines 74, 80, 95, 100, 105, 116, 122)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-unsafe-owner-fallback`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

If OWNER_USER_ID and OWNER_EMAIL are not set, the script lists auth users and assigns the new restaurant's owner membership to the first returned user. That makes ownership depend on Supabase list ordering rather than an explicit operator choice, and can grant the generated tenant to the wrong account when run against shared staging or production.

## Recommendation

Require OWNER_USER_ID or OWNER_EMAIL for any write, or restrict the fallback to a clearly marked local/dev-only mode with target environment validation.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)
