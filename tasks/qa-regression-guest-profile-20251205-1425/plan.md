---
task: qa-regression-guest-profile
timestamp_utc: 2025-12-05T14:25:12Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Guest Booking & Profile Regression

## Objective

Validate guest-facing booking flow and profile CRUD after the recent accessibility fix, ensuring Playwright E2E suite passes using production build.

## Success Criteria

- `pnpm build` then `pnpm start --port 3001` running with `E2E_TEST_TOKEN=local-dev-token`.
- `pnpm test:e2e:guest` completes with zero failures.
- ProfileManageForm labels are found by Playwright (no label-related assertion failures).
- e2e-login auth bypass authenticates guest user without manual input.

## Approach / Steps

1. Confirm Playwright baseURL expects port 3001; adjust env if needed.
2. Build the app (`pnpm build`) in production mode.
3. Launch server: `E2E_TEST_TOKEN=local-dev-token PORT=3001 pnpm start` (background task).
4. Run E2E suite: `pnpm test:e2e:guest`.
5. On failures, collect Playwright output (traces, screenshots, logs) into `test-results/`.
6. Summarize outcomes in `verification.md` with key evidence.

## Dependencies / Data

- Existing Playwright config and test accounts/fixtures.
- Port 3001 availability.

## Edge Cases & Checks

- Auth bypass token mismatch → login failures.
- Label queries in ProfileManageForm; watch for aria-label/name regressions.
- Booking flow flaky due to external data; rerun selectively if needed with cached server still up.

## Testing Strategy

- Full Playwright guest suite (chromium). Rely on built-in traces on failure; ensure artifacts copied to `test-results/`.

## Rollout / Impact

- No code changes or feature flags. Outcome is test report only.
