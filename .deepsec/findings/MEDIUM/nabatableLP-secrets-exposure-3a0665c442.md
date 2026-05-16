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

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2025-12-02)

**Verdict:** fixed

`OnboardingWizard` now stores only account email and mode after signup, and `OnboardingProvider` redacts account passwords on reducer updates, sessionStorage persistence, and draft restoration. Covered by `tests/components/OnboardingContextPersistence.test.tsx`.
