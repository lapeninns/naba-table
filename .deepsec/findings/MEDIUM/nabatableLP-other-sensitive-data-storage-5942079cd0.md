# [MEDIUM] Password signup persists the plaintext password in sessionStorage

**File:** [`src/app/onboarding/page.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/onboarding/page.tsx#L12) (lines 12)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-sensitive-data-storage`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

This page renders OnboardingWizard. In the imported AccountStep, password signup values include `password` and are passed directly to `setAccount(values)`. OnboardingProvider then persists the full onboarding state to `window.sessionStorage` via `JSON.stringify(persistedState)`, leaving the user's plaintext password readable by any same-origin script in that tab until the draft is cleared or the tab session ends.

## Recommendation

Never store password fields in onboarding state or sessionStorage. After signup, persist only non-sensitive account metadata such as email and mode, clear the password immediately, and explicitly redact `account.password` in the persistence layer.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2025-12-02)

**Verdict:** fixed

The shared onboarding persistence layer strips `account.password` before state storage and during draft restore, so both `/onboarding` and `/auth/signup` surfaces that render `OnboardingWizard` inherit the same password-redaction behavior.

Validation: `pnpm exec vitest run tests/components/OnboardingContextPersistence.test.tsx tests/scripts/destructive-script-atomicity.test.ts tests/server/data-retention-security-source.test.ts`
