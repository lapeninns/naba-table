---
task: merge-restaurant-guest-frontends
timestamp_utc: 2025-12-19T10:40:01Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Merge Restaurant-Side + Guest-Side Frontends

## Objective

We will merge Restaurant-side-frontend and Guest-Side-Frontend into the agreed target frontend branch so that both surfaces are integrated consistently.

## Success Criteria

- [ ] All merge conflicts resolved with intended behavior preserved.
- [ ] Build/tests pass for the merged branch.
- [ ] Manual UI QA completed for both guest and restaurant surfaces.

## Architecture & Components

- Maintain existing route group separation and middleware host logic.

## Data Flow & API Contracts

- No API contract changes expected; verify ops vs guest routing remains intact.

## UI/UX States

- Validate core guest flows and restaurant ops flows after merge.

## Edge Cases

- Conflicting route rewrites or layout composition between guest and ops.

## Testing Strategy

- Unit / Integration / E2E / Accessibility as applicable.

## Rollout

- N/A (branch merge only).

## DB Change Plan (if applicable)

- N/A
