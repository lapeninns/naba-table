---
task: fix-service-policy-arg
timestamp_utc: 2025-11-30T17:55:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix loadServicePolicy call

## Objective

Ensure `computeSummary` uses `loadServicePolicy` with the required `client` argument so the Next.js build passes.

## Success Criteria

- [ ] TypeScript build completes without errors.
- [ ] No runtime behavior change beyond correct client usage.

## Architecture & Components

- `server/ops/tables.ts`: Update `Promise.all` call in `computeSummary` to supply `client` to `loadServicePolicy`.

## Data Flow & API Contracts

- Unchanged; `loadServicePolicy` continues to query `service_policy` table via the provided Supabase client.

## UI/UX States

- N/A (server-side computation only).

## Edge Cases

- Ensure there are no other call sites lacking `client` argument (search confirms only one).

## Testing Strategy

- Run `pnpm run build` to confirm TypeScript compilation passes.

## Rollout

- No flags; fix is safe for immediate release.

## DB Change Plan (if applicable)

- None.
