---
task: qa-regression-guest-profile
timestamp_utc: 2025-12-05T14:25:12Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Ensure port 3001 free; confirm Playwright baseURL matches.
- [x] Build app: `pnpm build`.
- [x] Start server with `E2E_TEST_TOKEN=local-dev-token PORT=3001 pnpm start`.

## Core

- [x] Run `pnpm test:e2e:guest`.
- [x] Verify ProfileManageForm label queries succeed (no label-related failures).
- [x] Confirm e2e-login bypass authenticates guest.

## Artifacts

- [x] Capture Playwright results (traces/screenshots/logs) to `test-results/` for any failures.

## Notes

- Assumptions: Existing test data and Supabase backend available; Playwright config uses env `E2E_TEST_TOKEN` for bypass.
- Deviations: None yet.
- Batched Questions: None.
