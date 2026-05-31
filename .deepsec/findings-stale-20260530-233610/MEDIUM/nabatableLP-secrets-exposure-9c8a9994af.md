# [MEDIUM] Onboarding password is persisted in sessionStorage

**File:** [`src/app/onboarding/review/page.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/onboarding/review/page.tsx#L12) (lines 12)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `secrets-exposure`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

Line 12 renders OnboardingWizard. In the imported wizard, password sign-up stores the full submitted account object, including password, via setAccount(values), and OnboardingProvider serializes the entire onboarding state into sessionStorage under nabatable:onboarding:draft:v1. A user who chooses password sign-up and continues to review leaves their plaintext password readable to any same-origin script for the lifetime of the tab/session. Evidence: src/components/features/onboarding/OnboardingWizard.tsx:156-168 and src/components/features/onboarding/context/OnboardingContext.tsx:157-162.

## Recommendation

Never store password fields in React state that is persisted. Store only non-sensitive account metadata such as email and mode, or redact account.password before calling setAccount and before writing persisted onboarding state.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2025-12-02)
