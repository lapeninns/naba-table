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
