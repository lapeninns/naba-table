---
task: restaurant-production-fields
timestamp_utc: 2026-03-25T13:46:15Z
owner: github:@openai
reviewers: [github:@openai]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Production restaurant creation fields

## Objective

We will inspect the live repository contracts for restaurant creation and onboarding so the requester gets an exact list of required production fields.

## Success Criteria

- [x] Minimum required API fields are identified.
- [x] Additional onboarding-required fields are identified.
- [x] Recommended go-live operational fields are identified.
- [x] Final response references the relevant source files.

## Architecture & Components

- `src/app/api/ops/restaurants/schema.ts`: canonical create validation.
- `server/restaurants/create.ts`: server defaults and create-time invariants.
- `src/components/features/onboarding/OnboardingWizard.tsx`: UI-required onboarding fields and flow steps.
- `src/app/api/onboarding/restaurant/[id]/*`: follow-up onboarding setup contracts.

## Data Flow & API Contracts

- `POST /api/ops/restaurants`
- `POST /api/onboarding/restaurant`
- `PATCH /api/onboarding/restaurant/:id/hours`
- `PATCH /api/onboarding/restaurant/:id/service-periods`
- `POST /api/onboarding/restaurant/:id/zones`
- `POST /api/onboarding/restaurant/:id/tables`

## UI/UX States

- No UI change. Informational analysis only.

## Edge Cases

- `slug` omitted at API level: generated from restaurant name.
- Invalid `timezone`: rejected by schema/create service.
- Empty service periods are technically accepted by the onboarding API, but leave the restaurant operationally incomplete.

## Testing Strategy

- Static code inspection only. No runtime changes to verify.

## Rollout

- None. No code or data change.
