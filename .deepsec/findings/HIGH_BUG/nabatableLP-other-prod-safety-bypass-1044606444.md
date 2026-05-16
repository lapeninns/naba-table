# [HIGH_BUG] Import script can reset production staff passwords if destination env is production

**File:** [`scripts/staging/import-prod-staff.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/staging/import-prod-staff.ts#L155-L316) (lines 155, 184, 198, 199, 208, 217, 219, 273, 288, 316)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-prod-safety-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The script reads production memberships from .env.vercel-production, but the destination client named staging is built directly from .env.local without checking that it is a distinct staging project. If .env.local points at production, ensureStagingUser will run against production and update existing staff users with newly generated passwords, then upsert profiles and memberships.

## Recommendation

Parse both production and destination project refs before any admin mutation. Hard-fail if they match or if the destination is not the approved staging ref, and require an explicit staging confirmation.

## Revalidation

**Verdict:** true-positive

This is the same production-safety issue under a duplicate title, and it remains present. The script reads production data from `.env.vercel-production`, but the destination admin client is built directly from `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` loaded from `.env.local` or the process environment. There is no hard fail if the destination project ref equals `prodRef`, and there is no approved staging ref confirmation before admin mutations. Once the destination client is created, `ensureStagingUser` updates existing users' passwords and metadata, and the main loop upserts profile and membership rows. If the destination environment is production, those operations run against production.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)
