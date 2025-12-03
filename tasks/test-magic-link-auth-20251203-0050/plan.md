---
task: test-magic-link-auth
timestamp_utc: 2025-12-03T00:50:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Magic Link Authentication Test

## Objective

Validate that magic link authentication works end-to-end using the current production-style configuration (`NEXT_PUBLIC_ROOT_DOMAIN=nabatable.com`), confirming successful email dispatch, callback handling, and session persistence.

## Success Criteria

- [ ] Magic link request succeeds via `/api/auth/signin` (or UI form) and returns the expected “magic_link_sent” style response without errors.
- [ ] Supabase OTP email send completes (no signup-disabled or domain errors) using a controlled test mailbox.
- [ ] Callback flow produces a valid session and redirects to the intended path (dashboard), with cookies scoped to `.nabatable.com`.
- [ ] No regressions in existing auth route tests.

## Approach & Steps

- Environment prep: confirm `.env.local` has `NEXT_PUBLIC_ROOT_DOMAIN=nabatable.com`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, and pick a safe test email (prefer `NEXT_PUBLIC_SUPPORT_EMAIL`).
- Automated checks: run targeted auth route tests (`src/app/api/auth/signin/route.test.ts`, `src/app/api/auth/signup/route.test.ts`) to ensure recent fixes stay green.
- Live send validation: run `node test-magic-link.mjs <test-email>` to request a magic link through Supabase; capture output as artifact.
- Optional callback validation: if inbox access is available, follow the received link to confirm session + redirect; otherwise note limitation and rely on send confirmation and server logs.

## Edge Cases / Considerations

- Signup-disabled scenarios: ensure the chosen email already exists to avoid “signups not allowed” failures (or expect the service-role fallback to handle it).
- Redirect validation: callbacks should preserve allowed paths only; watch for 400/redirect rejection if an unexpected host appears.
- CSRF/rate limiting: if the UI path is used, ensure CSRF cookie/token are set; CLI helper bypasses UI CSRF but uses Supabase direct call.

## Testing Strategy

- Unit/integration: run targeted Vitest suites for auth routes mentioned above.
- Manual/CLI: capture console output from `test-magic-link.mjs` as evidence of successful send.
- (If inbox reachable) Browser/DevTools: complete callback and verify cookies set for `.nabatable.com`.

## Rollout

- No code changes or feature flags planned; this is validation only. Document findings in `verification.md` with artifacts.
