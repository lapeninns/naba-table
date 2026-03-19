---
task: grant-oldcrown-staging-access
timestamp_utc: 2026-03-19T00:25:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Test Outcomes

- [x] Grant script
- [x] Membership verification query

## Findings

- Target project ref: `ndxmivcrehsacuerwxtm` (linked staging).
- Restaurant: `The Old Crown Girton` (`the-old-crown-girton`) -> `a050d1ad-1ee0-4ea0-abc2-22c3778aa52c`.
- Auth user: `oldcrown@lapeninns.com` -> `e6654029-3f52-4095-ba20-e2433a7c33dd`.
- Grant script result: `Membership created.`
- Verified memberships for the user:
  - `The Old Crown Girton` (`the-old-crown-girton`) role `owner`.
- No additional restaurant memberships were returned for that user in staging.

## Artifacts

- `artifacts/grant.txt`
- `artifacts/membership.txt`
- `artifacts/user-memberships.txt`
