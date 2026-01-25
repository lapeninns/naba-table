---
task: fix-realtime-floorplan-env
timestamp_utc: 2026-01-25T13:06:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix production env validation for realtime floorplan

## Objective

We will ensure production builds pass by providing a valid boolean string for `NEXT_PUBLIC_FEATURE_REALTIME_FLOORPLAN` or by safely defaulting it in validation.

## Success Criteria

- [ ] Vercel production build passes env validation.
- [ ] No secrets are committed; env values are managed in Vercel or safe defaults are documented.

## Architecture & Components

- Env validation script (`scripts/validate-env.ts`) enforces boolean values.

## Data Flow & API Contracts

- N/A (build-time env validation only).

## UI/UX States

- N/A (no UI changes).

## Edge Cases

- Env var missing in production but present in preview; ensure production has explicit value.

## Testing Strategy

- Build validation via `pnpm run build` (if requested).

## Rollout

- If adjusting code: merge to main then set/verify Vercel env and rebuild.
- If env-only: set production env var to "true" or "false" and redeploy.

## DB Change Plan (if applicable)

- N/A.
