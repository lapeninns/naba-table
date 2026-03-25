---
task: clone-old-school-house-production
timestamp_utc: 2026-03-25T16:08:31Z
owner: github:@openai
reviewers: [github:@openai]
risk: high
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

- Not applicable. No UI change was made.

## Test Outcomes

- Production clone executed successfully via `scripts/clone-restaurant-config.ts`.
- Verified target restaurant exists in production with:
  - slug `the-old-school-house-stony-stratford`
  - 7 weekly operating-hours rows
  - 14 service periods
  - 4 zones
  - 18 tables
  - 36 adjacency rows
  - 1 copied manager membership

## Artifacts

- Production clone summary: `artifacts/production-clone-summary.json`

## Known Issues

- None discovered after readback verification.

## Sign-off

- [x] Engineering
