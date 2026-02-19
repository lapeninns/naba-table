---
task: harden-magic-link-signin
timestamp_utc: 2026-02-19T15:44:01Z
owner: github:@amankumarshrestha
reviewers: [github:@amankumarshrestha]
risk: high
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

- Route: `/auth/signin` (guest/public surface) on local dev server (`localhost:3001`).
- Verified widget and submit behavior:
  - Turnstile widget renders when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set.
  - Submit button remains disabled until CAPTCHA token is obtained.
  - Submit sends request with `captchaToken`.
- Verified response behavior:
  - Magic-link submit returns `202` with normalized success payload.
  - Missing CAPTCHA returns `403` (`CAPTCHA_REQUIRED`) with rate-limit headers.
  - Invalid verifier session returns `403` (`CAPTCHA_INVALID`).
  - Rate-limit breach returns `429` with `Retry-After` and `X-RateLimit-Scope`.
- Console:
  - No new guest-form console issues after explicit `htmlFor`/`id` fix on email input.
  - Existing analytics/debug logs remain expected in local dev.

## Test Outcomes

- `pnpm typecheck` -> pass
- `pnpm vitest tests/server/auth/magic-link-email.test.ts tests/server/auth/signin-route-magic-link-policy.test.ts tests/server/security/turnstile.test.ts tests/server/auth/signin-throttle.test.ts tests/components/auth/GuestSignInForm.test.tsx` -> pass
  - Test files: 5 passed
  - Tests: 13 passed

## Artifacts

- `tasks/harden-magic-link-signin-20260219-1544/artifacts/verification-evidence.txt`

## Known Issues

- No functional blockers discovered for this hardening scope.
- Local verifier checks used session-only Turnstile test keys and dev overrides for deterministic QA:
  - `ENABLE_RATE_LIMIT_IN_DEV=true` to exercise `429` path in development.
  - Invalid-secret session to exercise `CAPTCHA_INVALID`.

## Sign-off

- [x] Engineering
- [x] QA
