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

## Revalidation

**Verdict:** true-positive

The current wizard still calls `setAccount(values)` immediately after a successful password signup request, and `values` includes the plaintext `password`. The onboarding reducer stores the account object as-is. `OnboardingProvider` then writes the entire onboarding state to `sessionStorage` with key `nabatable:onboarding:draft:v1`, only replacing `loading` and `error`. No sanitizer removes `password` during persistence or during draft restoration. The form also uses `state.account?.password` as a default value, proving the password is intentionally retained in client state rather than discarded after submission. An attacker who achieves same-origin JavaScript execution during the onboarding session can read the persisted JSON and extract the password without needing to intercept the original signup request. The issue remains present in current code and the reported medium severity is appropriate.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-09)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-15)
