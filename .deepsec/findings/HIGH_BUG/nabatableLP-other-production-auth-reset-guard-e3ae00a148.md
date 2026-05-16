# [HIGH_BUG] Auth user reset script lacks production and project confirmation

**File:** [`scripts/ensure-auth-user.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/ensure-auth-user.ts#L18-L150) (lines 18, 19, 21, 22, 23, 99, 114, 130, 150)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-production-auth-reset-guard`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The script reads Supabase URL, service-role key, USER_EMAIL, USER_PASSWORD, and optional USER_ID directly from the environment, then can update any supplied user id, update a matched email account, or create a confirmed user. Unlike the production data scripts, it has no CONFIRM_PRODUCTION gate, EXPECTED_PROJECT_REF check, APP_ENV/DB_TARGET_ENV safety check, or validation that USER_ID belongs to USER_EMAIL. A mistaken production env can reset a real user's password and mark email confirmed with one command.

## Recommendation

Require explicit production confirmation and an exact project-ref check before any auth mutation, run repo env validation first, default to staging-only operation, and verify a supplied USER_ID's current email matches USER_EMAIL before changing the password.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)

**Verdict:** fixed

`scripts/ensure-auth-user.ts` now runs `assertAuthUserScriptSafety()` before constructing the Supabase admin client. Production mode verifies the Supabase API ref and optional DB ref against the expected production ref and requires `CONFIRM_PRODUCTION_AUTH_RESET=true`; non-production mode delegates to `assertStagingScriptSafety` with `CONFIRM_STAGING_AUTH_RESET=true`. Focused script-safety tests assert the guard and exact-ref checks run before admin client use.
