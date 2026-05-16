# [HIGH_BUG] Dry run can create a confirmed production auth user

**File:** [`scripts/grant-production-restaurant-access.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/grant-production-restaurant-access.ts#L159-L291) (lines 159, 192, 278, 291)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-dry-run-side-effect`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

main() calls ensureAuthUser(userEmail) before checking apply. ensureAuthUser() falls through to supabase.auth.admin.createUser() when the user is not found, and that call creates an email-confirmed auth user with a generated password. As a result, running the script without APPLY=true can still mutate production auth state even though the later dry-run branch returns before profile and membership writes.

## Recommendation

Split read-only planning from mutating auth operations. In dry-run mode, only resolve existing users via read-only lookups and report what would be created. Gate generateLink/createUser/profile upserts/membership upserts behind apply plus the production confirmation.

## Revalidation

**Verdict:** true-positive

The current `main()` still calls `ensureAuthUser(userEmail)` before it checks `if (!apply) return`. `CONFIRM_PRODUCTION=true` is only required when `apply` is true, so the default dry-run path can reach `ensureAuthUser` without the production confirmation gate. If profile, admin-list, DB, and generated-link lookups do not return an existing user, `ensureAuthUser` calls `supabase.auth.admin.createUser` with `email_confirm: true` and a generated password. That is a real production auth-state mutation before the script reaches the dry-run return. The script does validate the Supabase URL against an expected project ref, but that only confirms the target project; it does not make dry-run read-only. A concrete failure mode is an operator running the script without `APPLY=true` for a new email and unexpectedly creating a confirmed production auth user.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-16)
