---
task: login-magic-link-expiry
timestamp_utc: 2025-11-27T00:32:57Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Login magic link session expiry

## Objective

Restore production login so users can request and complete magic-link authentication without seeing "Session expired" or failed email sends.

## Success Criteria

- [ ] Magic link request API responds 200/expected success in production.
- [ ] No "Session expired" blocking login at `/app/login`.
- [ ] Manual QA: user receives email and can log in.

## Architecture & Components

- Auth/login page/component: identify form submission handler.
- API route `/api/auth/signin` sends magic link or password sign-in; expects CSRF header + cookie.
- CSRF helper `ensureCsrfCookie` exists but is currently not invoked anywhere.
- Login UI (`components/auth/SignInForm`) surfaces 403 as “Session expired. Refresh and try again.”

## Data Flow & API Contracts

- POST `/api/auth/signin` body: `{ mode: 'password' | 'magic_link', email, password?, redirectedFrom? }`
- Requires header `x-csrf-token` matching `sr-csrf-token` cookie; returns 202 (magic link) or 200 (password) with `redirectTo`.

## UI/UX States

- Loading when sending magic link.
- Success confirmation and error surfaces.
- Session-expired redirect behavior.

## Edge Cases

- Invalid/expired session cookie on login page.
- Email provider failures.
- Redirect back to intended path.
- CSRF cookie not set when secure flag blocks HTTP on `app.localhost`.

## Testing Strategy

- Unit/Integration: cover magic link send handler and session validation if feasible.
- Manual QA via Chrome DevTools MCP: verify console/network; email flow end-to-end.
- Accessibility: focus order, labels on login form.

## Rollout

- Set CSRF cookie on login render for both ops (`/app/login`) and guest (`/auth/signin`); verify cookie + header present before POST.
- Deploy fix behind existing authentication deployment; monitor logs.

## DB Change Plan (if applicable)

- None anticipated.
