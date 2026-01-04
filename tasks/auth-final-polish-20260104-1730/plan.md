# Implementation Plan: Auth Final Polish & Verification

## Objective

Ensure the "Nab a Table" authentication flow is seamless, brand-consistent, and robust across all user roles and subdomains.

## Success Criteria

- [ ] Unauthenticated users hitting protected routes are correctly sent to `/auth`.
- [ ] `/auth` role selection persists the `redirectedFrom` parameter.
- [ ] Sign-in pages correctly handle redirection and cross-subdomain links.
- [ ] Post-login redirection (including implicit flow) works for all roles.
- [ ] Branding is consistent and no legacy paths exist.

## Architecture & Components

- **Auth Hub (`/auth`):** Entry point for all unauthenticated users.
- **Guest Sign-in (`/auth/signin`):** Public-facing sign-in for diners.
- **Owner Sign-in (`app.nabatable.com/auth/signin`):** Operation console sign-in.
- **ImplicitAuthHandler:** Handles client-side token exchange and redirection.

## Data Flow & API Contracts

- **URL Parameter:** `redirectedFrom` carries the target path through the auth flow.

## UI/UX States

- **Role Selection:** Clear choice between Guest and Restaurant Owner.
- **Loading:** Handled by Supabase and Next.js navigation.

## Edge Cases

- User hits guest sign-in but wants to access operations (handled by CTA link and auto-redirect).
- User hits operations sign-in but wants to access guest account (handled by similar CTA/links).

## Testing Strategy

- **Manual QA:** Verify redirects using Chrome DevTools.
- **Scenario 1:** Visit `/app/settings` (unauthenticated) -> `/auth` -> "Owner" -> `/app/auth/signin` -> Sign in -> `/app/settings`.
- **Scenario 2:** Visit `/guest/dashboard` (unauthenticated) -> `/auth` -> "Guest" -> `/auth/signin` -> Sign in -> `/guest/dashboard`.

## Rollout

- This is a final polish and verification step.

## DB Change Plan (if applicable)

- N/A
