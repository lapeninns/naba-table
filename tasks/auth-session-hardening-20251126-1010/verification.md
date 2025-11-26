---
task: auth-session-hardening
timestamp_utc: 2025-11-26T10:10:00Z
status: in_progress
summary: Auth hardening implemented; route tests passing; manual QA pending.
---

# Verification Plan

## Manual QA — Chrome DevTools

- [ ] Password sign-in success path (network/console clean).
- [ ] Magic-link request path (verify 202 + email send log; no console errors).
- [ ] CSRF failure returns 403 (can be simulated by removing token header).
- [ ] Rate limit returns 429 after threshold.

## Automated Tests

- [x] /api/auth/signin route tests (happy path, CSRF fail, rate limit fail) — `pnpm vitest src/app/api/auth/signin/route.test.ts`.

## Artifacts

- [ ] Add screenshots/logs/Lighthouse if UI regressions detected.
