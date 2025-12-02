---
task: restaurant-onboarding-fix
timestamp_utc: 2025-12-02T12:31:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Restaurant Onboarding Flow Fix

## Requirements

- Functional:
  - Identify and resolve issues preventing completion of restaurant onboarding flow (signup → profile → hours → dashboard).
- Non-functional (a11y, perf, security, privacy, i18n):
  - Maintain existing a11y patterns; avoid regressions in onboarding.
  - Keep API responses and error handling consistent; no secrets logged.

## Existing Patterns & Reuse

- Onboarding screens reuse ops primitives:
  - `OperatingHoursSection` + `useOpsOperatingHours` from `src/components/features/restaurant-settings/` and `src/hooks/ops`.
  - Ops restaurant service (`src/services/ops/restaurants.ts`) shared across onboarding and management flows.
  - API surface for ops lives under `/api/ops/restaurants/*` (e.g., `src/app/api/ops/restaurants/[id]/hours/route.ts`).

## Findings so far

- `useOpsOperatingHours` calls `/api/restaurants/:id/hours` via the ops restaurant service.
- On localhost, middleware does **not** rewrite `/api/restaurants/*` to `/api/ops/restaurants/*`, so hours GET/PUT requests hit a missing route and return **404** during onboarding.
- Correct hours endpoints exist at `/api/ops/restaurants/:id/hours` and enforce admin membership (expected for the newly created restaurant).
- Ops occasions service also targeted `/api/occasions` which 404s in dev; correct endpoint is `/api/ops/occasions`.
- Tables step failed because payload omitted `id` (null PK) and `table_inventory` FK requires matching `allowed_capacities` rows; onboarding flow was missing that insert.

## External Resources

- None yet.

## Constraints & Risks

- Must follow root AGENTS SDLC and a11y/perf rules.
- Onboarding touches auth and restaurant services; potential data dependencies.
- Need to keep public `/api/restaurants` endpoints (schedule/calendar) intact while fixing ops calls.

## Open Questions (owner, due)

- Do any other ops hooks still point to the public `/api/restaurants` path? (owner: us)
- Is there seed/setup data required for hours creation? (owner: us)

## Recommended Direction (with rationale)

- Investigate onboarding routes/components and API handlers for hours setup to reproduce the 404 and fix underlying data creation or routing issues.
