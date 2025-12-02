---
task: lint-warnings-fix
timestamp_utc: 2025-12-02T14:15:09Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Resolve ESLint unused-variable warnings

## Objective

Ensure lint passes with zero warnings by removing unused bindings in API route handlers without changing behavior.

## Success Criteria

- [ ] `pnpm lint` (or eslint via hook) runs without warnings.
- [ ] No functional changes to auth signup or onboarding zone creation flows.

## Architecture & Components

- `src/app/api/auth/signup/route.ts`: drop unused import.
- `src/app/api/onboarding/restaurant/[id]/zones/route.ts`: remove unused variable/comment alignment.
- `src/app/api/onboarding/restaurant/route.ts`: remove unused import.

## Data Flow & API Contracts

- No contract changes; only code cleanup.

## UI/UX States

- Not applicable (API-only change).

## Edge Cases

- None; ensure CSRF/auth/rate limiting remain untouched.

## Testing Strategy

- Run eslint (`pnpm lint` or equivalent hook) to confirm zero warnings.

## Rollout

- No feature flags; immediate.

## DB Change Plan

- Not applicable.
