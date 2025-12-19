---
task: run-guest-e2e
timestamp_utc: 2025-12-19T11:14:11Z
owner: github:@amankumarshrestha
reviewers: [github:@qa]
risk: low
flags: []
related_tickets: []
---

# Research: Run guest-facing E2E suite

## Requirements

- Execute Playwright guest E2E tests for guest routes/pages.
- Capture output logs for verification.

## Existing Patterns & Reuse

- `pnpm run test:e2e:guest` runs Playwright guest specs on Chromium.

## External Resources

- None.

## Constraints & Risks

- Requires Playwright dependencies and test env vars configured.

## Recommended Direction

- Run `pnpm run test:e2e:guest` and save logs to task artifacts.
