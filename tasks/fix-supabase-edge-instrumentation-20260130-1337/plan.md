---
task: fix-supabase-edge-instrumentation
timestamp_utc: 2026-01-30T13:37:33Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Edge-safe Supabase instrumentation

## Objective

We will make Supabase fetch instrumentation Edge-safe so middleware auth/rewrites can run without Node-only modules.

## Success Criteria

- [ ] Edge middleware bundle no longer depends on `node:crypto`.
- [ ] `instrumentedSupabaseFetch` continues to record signatures without throwing.

## Architecture & Components

- `server/supabase-instrumentation.ts`: replace Node crypto hashing with a deterministic Edge-safe hash.
- `server/supabase.ts`: no functional changes expected; uses the same exported fetch hook.

## Data Flow & API Contracts

- No API changes; internal-only instrumentation.

## UI/UX States

- Not applicable (no UI changes).

## Edge Cases

- Non-string request bodies (leave hash empty).
- Empty body or very large body (cap sample to 2048 chars).

## Testing Strategy

- Unit: optional; consider adding a small test for hash determinism if a local pattern exists.
- Integration/E2E: not required for internal instrumentation change.

## Rollout

- No feature flag; change is safe and internal-only.

## DB Change Plan (if applicable)

- Not applicable.
