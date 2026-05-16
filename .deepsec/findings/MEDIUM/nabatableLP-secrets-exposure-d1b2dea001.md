# [MEDIUM] Onboarding password is persisted in sessionStorage

**File:** [`src/app/onboarding/services/page.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/onboarding/services/page.tsx#L12) (lines 12)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `secrets-exposure`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

Line 12 renders OnboardingWizard. In password sign-up mode, the imported wizard stores the full submitted account object, including password, and OnboardingProvider serializes it into sessionStorage. The password remains readable to same-origin JavaScript while the user continues through service setup. Evidence: src/components/features/onboarding/OnboardingWizard.tsx:156-168 and src/components/features/onboarding/context/OnboardingContext.tsx:157-162.

## Recommendation

Redact password before persisting onboarding state, or avoid persisting account details entirely after the signup request is sent.

## Revalidation

**Verdict:** true-positive

The services page renders the same `OnboardingWizard`, so it participates in the wizard-wide persisted onboarding state. In `AccountStep`, password signup submits `values` to `/api/auth/signup`, and then calls `setAccount(values)` after the request succeeds. The account form defaults also read `state.account?.password`, so the password is treated as part of reusable client state. `OnboardingProvider` writes the full `state` object to `window.sessionStorage` under `nabatable:onboarding:draft:v1` on every state change, only clearing `loading` and `error`. `sanitizePersistedState` spreads the stored object back into state and does not redact `account.password`. A concrete attack is any same-origin script execution after signup, such as an XSS in this origin or compromised first-party script, reading `sessionStorage.getItem('nabatable:onboarding:draft:v1')` while the user continues onboarding. CSRF, server auth, and route membership checks do not mitigate this client-side plaintext password persistence.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2025-12-02)
