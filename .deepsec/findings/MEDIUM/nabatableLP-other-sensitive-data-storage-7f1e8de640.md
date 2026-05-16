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

## Revalidation

**Verdict:** true-positive

The password-mode account schema allows a `password` field, and `AccountStep` initializes the form from `state.account?.password`. On submit, the component sends `values` to `/api/auth/signup` and then calls `setAccount(values)`, so the plaintext password becomes part of the onboarding context state. `OnboardingContext.tsx` persists the full `state` object to `window.sessionStorage` under `nabatable:onboarding:draft:v1` after every state change. The persistence layer only normalizes step, loading, and error; it does not strip `account.password`. The password can remain available while the user moves through profile, hours, services, tables, and review, and it can be restored into the password form if the draft is reloaded in the same tab session. A concrete exploitation path is same-origin script execution reading the sessionStorage entry after signup. This is not mitigated by HTTPS, CSRF, or server-side auth checks because the secret is already stored in browser-accessible client storage.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-09)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-15)
