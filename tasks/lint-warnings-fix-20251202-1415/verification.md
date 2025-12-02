---
task: lint-warnings-fix
timestamp_utc: 2025-12-02T14:15:09Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

- Not applicable (API-only change; no UI surfaces touched).

## Test Outcomes

- [x] ESLint (`pnpm eslint --max-warnings=0 src/app/api/auth/signup/route.ts src/app/api/onboarding/restaurant/[id]/zones/route.ts src/app/api/onboarding/restaurant/route.ts`): pass

## Artifacts

- None needed for lint-only change.

## Known Issues

- None.

## Sign-off

- [ ] Engineering
