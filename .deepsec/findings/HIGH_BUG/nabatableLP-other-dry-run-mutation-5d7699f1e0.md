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

## Revalidation

**Verdict:** true-positive

The dry-run side effect still exists in the current script. `main()` resolves or creates the auth user first, then loads memberships, logs the before state, and only then returns when `apply` is false. The creation branch calls `supabase.auth.admin.createUser` with `email_confirm: true`, so a missing email can become a confirmed production auth account during a nominal dry run. The expected-project-ref guard and production URL selection reduce wrong-project risk but do not prevent this mutation. This is not web-remote RCE or unauthenticated exploitation; it is an operator-safety bug in a production administration script. The finding is real and exploitable by normal script invocation with a new target email.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-16)
