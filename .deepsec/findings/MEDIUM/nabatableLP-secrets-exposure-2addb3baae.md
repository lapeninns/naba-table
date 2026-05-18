# [MEDIUM] Password signup stores the plaintext password in onboarding sessionStorage

**File:** [`src/components/features/onboarding/OnboardingWizard.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/onboarding/OnboardingWizard.tsx#L147-L167) (lines 147, 152, 160, 167)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `secrets-exposure`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

After a password-mode signup, the handler calls setAccount(values), where values includes the plaintext password. The imported OnboardingProvider persists the full onboarding state to sessionStorage under nabatable:onboarding:draft:v1, so the password remains readable by any script running on the origin until the tab session is cleared.

## Recommendation

Never store the password in OnboardingState. Send it only in the signup request, then store only non-sensitive fields such as email and mode, and clear any existing persisted drafts that may contain password.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-15)
