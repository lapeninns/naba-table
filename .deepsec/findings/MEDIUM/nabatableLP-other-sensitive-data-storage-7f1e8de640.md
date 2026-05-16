# [MEDIUM] Password signup stores the plaintext password in persisted onboarding state

**File:** [`src/components/features/onboarding/OnboardingWizard.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/onboarding/OnboardingWizard.tsx#L150-L167) (lines 150, 152, 167)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-sensitive-data-storage`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

For password signup, the submitted values object includes password and is passed to setAccount(values). The imported OnboardingProvider persists the full onboarding state to sessionStorage, and the form also restores state.account.password as a default value. This leaves the user's plaintext password readable by any same-origin script until the session storage entry is cleared.

## Recommendation

Never persist password fields. Store only non-sensitive account metadata such as email and mode, clear the password immediately after the signup request, and redact password in the onboarding state sanitizer/persistence layer.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-15)

**Verdict:** fixed

`OnboardingWizard` no longer passes submitted password values into onboarding state and initializes the password field as blank. `OnboardingProvider` also strips any existing `account.password` values from reducer state, sessionStorage writes, and restored drafts.

Validation: `pnpm exec vitest run tests/components/OnboardingContextPersistence.test.tsx tests/scripts/destructive-script-atomicity.test.ts tests/server/data-retention-security-source.test.ts`
