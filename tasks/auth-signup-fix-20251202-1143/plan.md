---
task: auth-signup-fix
timestamp_utc: 2025-12-02T11:43:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Auth Signup Flow Stability

## Objective

We will verify and stabilize the auth signup flow so new users can successfully create accounts and reach the expected post-signup state without errors.

## Success Criteria

- [ ] All existing signup-related tests pass (unit/E2E) with no regressions.
- [ ] Manual signup flow completes with correct redirects and emails as applicable.
- [ ] No a11y violations (axe critical/serious) on signup form.

## Architecture & Components

- `src/app/(public)/auth/signup/page.tsx`: server page ensuring CSRF cookie and rendering `OwnerSignupForm`.
- `components/auth/OwnerSignupForm.tsx`: client form (RHF + zod) toggling magic-link/password, posts to API, handles status.
- `src/app/api/auth/signup/route.ts`: API handler for password/magic-link signups, CSRF + rate limit, Supabase signup/OTP, redirect sanitization.
- `src/app/api/auth/callback/route.ts`: exchanges Supabase code for session, redirects to sanitized target (used after signup magic links too).

## Data Flow & API Contracts

- POST `/api/auth/signup`
  - Body: `{ mode: "password"|"magic_link", email, password?, redirectedFrom? }`
  - Headers: `x-csrf-token` required; rate-limit headers returned.
  - Responses: `200 { status:"ok", redirectTo }` for password; `202 { status:"magic_link_sent", redirectTo }`; 4xx on validation/CSRF; 429 with Retry-After.
- GET `/api/auth/callback`
  - Query: `code`, `redirectedFrom`.
  - Behavior: exchange code for session; redirect to sanitized target or fallback; logs warning when missing/invalid.

## UI/UX States

- Signup form states: idle, submitting, success (redirect or magic-link confirmation), error with accessible status. Tabs switch modes; password field only in password mode.
- Page fallback when feature flag disabled shows invite-only message.

## Edge Cases

- Missing/invalid CSRF → 403.
- Weak/missing password in password mode → 400 with field details.
- Duplicate email/Supabase errors → surface friendly message.
- Invalid `redirectedFrom` or hostile URLs → sanitize to `/onboarding/profile`.
- Supabase exchange returning no data or mocks without `getUser` should not throw.

## Testing Strategy

- Targeted vitest: `src/app/api/auth/callback/route.test.ts` (and any signup route tests if added).
- Manual: exercise /auth/signup (password + magic-link) in browser/devtools; capture HAR + Lighthouse.
- Accessibility: check focus/aria on form; axe via DevTools MCP.

## Rollout

- No feature flag expected; changes should be backward compatible.
- Monitoring: rely on existing logging/error surfaces; note if additional needed.
- Kill-switch: revert changes if issues arise; ensure commits are small.

## DB Change Plan (if applicable)

- No DB schema changes expected; Supabase remote-only if needed.
