# [MEDIUM] Password signup stores the plaintext password in sessionStorage

**File:** [`src/app/auth/signup/page.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/auth/signup/page.tsx#L12) (lines 12)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-sensitive-data-storage`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

OnboardingWizard accepts password signups and then stores the submitted form values in onboarding state. OnboardingContext persists the full onboarding state to sessionStorage, including account.password. The password remains readable by any same-origin script running in that tab until the draft is cleared or the tab session ends.

## Recommendation

Never persist password fields. After successful signup, store only non-secret account metadata such as email and mode, and explicitly omit account.password when writing onboarding state to sessionStorage.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2025-12-02)

**Verdict:** fixed

`OnboardingContext` redacts account passwords in the reducer, persisted state writer, and persisted draft restore path. `OnboardingWizard` now stores only `{ email, mode }` after signup and no longer restores password defaults from onboarding state.

Validation: `pnpm exec vitest run tests/components/OnboardingContextPersistence.test.tsx tests/scripts/destructive-script-atomicity.test.ts tests/server/data-retention-security-source.test.ts`
