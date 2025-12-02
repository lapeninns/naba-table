---
task: magic-link-otp-signup-error
timestamp_utc: 2025-12-02T15:49:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Magic link sign-in returning "Signups not allowed for otp"

## Objective

We will enable users to sign in via magic link without encountering the "Signups not allowed for otp" error when signups are disabled, while keeping signup flows intentional.

## Success Criteria

- [ ] Magic link sign-in for existing users succeeds when signups are disabled.
- [ ] New users are directed to signup flow instead of failing silently.
- [ ] Error messaging is clear and does not expose internal errors.

## Architecture & Components

- API route: `src/app/api/auth/signin/route.ts`
  - Keep password path unchanged.
  - For magic-link path, attempt anon `signInWithOtp`; on signup-disabled error, fall back to service-role `signInWithOtp` with `shouldCreateUser: false`.
  - Normalize errors to user-friendly responses.

Supporting modules: `server/supabase.ts` (service client), tests in `src/app/api/auth/signin/route.test.ts`.

## Data Flow & API Contracts

Endpoint: POST /api/auth/signin
Request: { mode: "magic_link", email, redirectedFrom? }
Response: { status, redirectTo } or { message }
Errors: structured JSON with message and HTTP status.

## UI/UX States

- Loading / Error / Success for auth forms

## Edge Cases

- Signup disabled but user exists → fallback via service-role magic link succeeds.
- Signup disabled and user missing → respond with clear guidance to sign up (no user creation).
- Rate limit and CSRF failures remain unchanged.

## Testing Strategy

- Unit
- Integration
- E2E / accessibility (if UI affected)

## Rollout

- No feature flag expected; document if needed.
- Monitoring via server logs.
