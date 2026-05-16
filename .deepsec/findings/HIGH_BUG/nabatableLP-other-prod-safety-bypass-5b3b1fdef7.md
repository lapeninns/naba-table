# [HIGH_BUG] Import script can reset production staff passwords if staging env points at production

**File:** [`scripts/staging/import-prod-staff.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/staging/import-prod-staff.ts#L193-L299) (lines 193, 194, 202, 208, 210, 152, 179, 299)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-prod-safety-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The script reads production staff memberships from `.env.vercel-production`, but the destination `staging` client is built from `.env.local` without checking that it is actually a distinct staging project. If `.env.local` contains production Supabase values, `ensureStagingUser` will run against production: existing staff users are found and updated with newly generated passwords, profiles and memberships are upserted, and the generated credentials are written locally.

## Recommendation

Before any auth/admin mutation, parse both production and destination project refs and hard-fail if they match or if the destination is not the approved staging ref. Reuse central env validation and require an explicit staging project ref confirmation.

## Revalidation

**Verdict:** true-positive

The current script loads destination Supabase credentials from `.env.local` into `stagingUrl` and `stagingServiceKey`, but it never parses or compares the destination project ref against the production ref. `parseSupabaseProjectRefFromUrl` is only used for `prodUrl`, not for `stagingUrl`. The script creates the Supabase admin client before any destination safety check and uses that client to list restaurants, create users, update existing users, upsert profiles, and upsert memberships. If `.env.local` or inherited process env points at the production Supabase project, `ensureStagingUser` will call `auth.admin.updateUserById` for existing production staff and replace their passwords with generated values. The restaurant filtering does not protect production because, when the destination is production, `stagingRestaurantIds` is populated from production restaurants. This is directly exploitable by an operator running the staging import with a mispointed environment and would mutate production auth state.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)
