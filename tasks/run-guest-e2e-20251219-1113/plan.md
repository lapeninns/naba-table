---
task: run-guest-e2e
timestamp_utc: 2025-12-19T11:14:11Z
owner: github:@amankumarshrestha
reviewers: [github:@qa]
risk: low
flags: []
related_tickets: []
---

# Plan: Run guest-facing E2E suite

## Steps

1. Run Playwright guest suite via `pnpm run test:e2e:guest`.
2. Capture logs into task artifacts.
3. Record results in `verification.md`.
