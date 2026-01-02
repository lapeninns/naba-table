---
task: b2b-landing-content
timestamp_utc: 2026-01-02T21:15:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: B2B Landing Content Extraction

## Objective

We will generate a code-verified B2B marketing JSON so operators can map real features to landing page sections.

## Success Criteria

- [ ] JSON sections (hero, features, workflow, integrations/data, FAQ) are complete and code-backed.
- [ ] JSON file saved in repo root.
- [ ] Lint, typecheck, and tests pass.

## Architecture & Components

- No app changes; output is a standalone JSON file.

## Data Flow & API Contracts

- Source of truth: `src/app/api/bookings/route.ts`, `server/capacity/*`, `src/components/features/*`, `src/types/*`.

## UI/UX States

- Not applicable (no UI changes).

## Edge Cases

- Avoid claiming features that exist only in docs but not in code paths.

## Testing Strategy

- Run `pnpm run lint`, `pnpm run typecheck`, `pnpm run test`.

## Rollout

- Not applicable.

## DB Change Plan (if applicable)

- Not applicable.
