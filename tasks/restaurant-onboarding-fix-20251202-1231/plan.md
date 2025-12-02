---
task: restaurant-onboarding-fix
timestamp_utc: 2025-12-02T12:31:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Restaurant Onboarding Flow Fix

## Objective

Ensure restaurant onboarding (signup → profile → hours) completes successfully without 404s or blocked steps.

## Success Criteria

- [ ] Completing onboarding creates restaurant and hours without API errors.
- [ ] `/api/ops/restaurants/:id/hours` responds 200 with persisted data after onboarding hours step.
- [ ] UI shows success and navigates to expected destination.

## Architecture & Components

- Onboarding routes under `src/app/(onboarding)/onboarding/**`.
- Shared components/hooks: `OperatingHoursSection`, `ServicePeriodsSection`, `useOpsOperatingHours`, `useOpsServicePeriods`.
- Ops restaurant service (`src/services/ops/restaurants.ts`) used by these hooks.
- Tables step posts to `/api/onboarding/restaurant/:id/{zones|tables}`; tables payload must carry `id` and capacities must exist in `allowed_capacities`.

## Data Flow & API Contracts

- Align ops service calls with `/api/ops/restaurants/*` endpoints (hours, profile, service periods, logo upload) to avoid missing-route 404s.
- Ensure hours API writes/reads data for the created restaurant.
- Seed/sync `allowed_capacities` before table inserts to satisfy FK.

## UI/UX States

- Loading/submit states for onboarding steps should remain functional.
- Error surfaces should present meaningful messages if failures occur.

## Edge Cases

- Duplicate submissions; navigating back/forward during onboarding.
- Missing initial hours causing 404.
- Local dev host (localhost) lacking middleware rewrite for ops endpoints.

## Testing Strategy

- Manual end-to-end onboarding flow with Chrome DevTools MCP (mobile + desktop).
- Add/update unit/integration coverage around ops restaurant service base URL if feasible.

## Rollout

- No feature flags identified; changes should be backward-compatible.

## DB Change Plan (if applicable)

- None anticipated; if required, follow remote-only Supabase rules.
