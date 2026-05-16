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

## Revalidation

**Verdict:** true-positive

The signup page renders `OnboardingWizard`, whose account step includes a password field for password signups. After a successful `/api/auth/signup` call, the component calls `setAccount(values)`, and `values` includes the plaintext `password` when the selected mode is `password`. `OnboardingContext` persists the entire onboarding state to `window.sessionStorage` on every state change. The persistence code spreads `...state` into `persistedState` and does not remove `state.account.password`. `sanitizePersistedState` also spreads persisted data back into state without dropping password. A same-origin script running in that tab can read `sessionStorage['nabatable:onboarding:draft:v1']` and recover the submitted password until the tab/session data is cleared.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2025-12-02)
