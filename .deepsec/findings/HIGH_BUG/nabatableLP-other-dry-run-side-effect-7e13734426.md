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

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-25)

**Verdict:** fixed

The dry-run path now resolves only existing auth users with `resolveExistingAuthUser(userEmail)` and returns on `!apply` before the mutating `ensureAuthUser(userEmail)` path. Missing users are reported as `wouldCreateAuthUser` during dry run; confirmed auth user creation can only occur after apply mode and the production confirmation gate.

Evidence: `pnpm exec vitest run tests/scripts/db-safety.test.ts` passed on 2026-05-16. The regression coverage verifies dry-run auth resolution remains read-only and that `ensureAuthUser(userEmail)` is ordered after the `if (!apply)` return.
