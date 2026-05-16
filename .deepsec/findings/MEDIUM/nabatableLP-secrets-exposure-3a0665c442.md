# [MEDIUM] Onboarding password is persisted in sessionStorage

**File:** [`src/app/onboarding/tables/page.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/onboarding/tables/page.tsx#L12) (lines 12)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `secrets-exposure`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

Line 12 renders OnboardingWizard. In password sign-up mode, the imported wizard stores the full submitted account object, including password, and OnboardingProvider serializes it into sessionStorage. The password remains readable to same-origin JavaScript while the user continues through table setup. Evidence: src/components/features/onboarding/OnboardingWizard.tsx:156-168 and src/components/features/onboarding/context/OnboardingContext.tsx:157-162.

## Recommendation

Redact password before persisting onboarding state, or avoid persisting account details entirely after the signup request is sent.

## Revalidation

**Verdict:** true-positive

The tables page renders `OnboardingWizard`, which uses the same `OnboardingProvider` and sessionStorage draft as the account and service steps. In password mode, `AccountStep` receives a `values` object that includes `password`, posts it to `/api/auth/signup`, and then stores the same object through `setAccount(values)`. The reducer stores that object verbatim as `state.account`. The provider serializes the full onboarding state to `sessionStorage` under `nabatable:onboarding:draft:v1`, without any password redaction. The persisted state is also restored into form defaults via `state.account?.password`, extending the exposure beyond the initial submit. A same-origin script running later in the onboarding flow can read the stored JSON and recover the plaintext password. I found no current mitigation in the provider, sanitizer, route layer, or proxy that removes the password after signup.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2025-12-02)
