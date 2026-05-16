# [HIGH_BUG] Dry run can create production auth users

**File:** [`scripts/grant-production-restaurant-access.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/grant-production-restaurant-access.ts#L187-L291) (lines 187, 192, 195, 278, 291)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-dry-run-mutation`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

main() calls ensureAuthUser before checking apply. ensureAuthUser can call generateLink and then createUser for a missing email, so running the script without APPLY can still mutate production auth state by creating a confirmed user with a random password. The script only skips profile and membership writes after the dry-run check, which is too late.

## Recommendation

Make dry-run resolution strictly read-only. Only call generateLink/createUser after apply and CONFIRM_PRODUCTION are true, or split ensureAuthUser into a non-mutating lookup phase and an apply-only creation phase.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-25)

**Verdict:** fixed

`main()` now performs dry-run planning with `resolveExistingAuthUser(userEmail)` only, reports `wouldCreateAuthUser`, and returns on `!apply` before calling `ensureAuthUser(userEmail)`. The mutating `generateLink`/`createUser` path is only reached after apply mode and the existing production confirmation gate.

Evidence: `pnpm exec vitest run tests/scripts/db-safety.test.ts` passed on 2026-05-16. The regression coverage verifies the dry-run branch appears before `ensureAuthUser(userEmail)` and that the script reports what would be created without creating an auth user.
