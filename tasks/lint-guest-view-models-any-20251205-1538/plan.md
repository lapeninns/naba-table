---
task: lint-guest-view-models-any
timestamp_utc: 2025-12-05T15:38:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: ESLint `no-explicit-any` cleanup

## Objective

Ensure `tests/server/guest/view-models.test.ts` is free of `any` usages so `pnpm eslint --max-warnings=0` succeeds.

## Success Criteria

- [ ] The two `@typescript-eslint/no-explicit-any` warnings in the test file are eliminated.
- [ ] Targeted lint run on the file passes with `--max-warnings=0`.

## Architecture & Components

- Update test doubles within `tests/server/guest/view-models.test.ts` to use typed Supabase `User` and a typed `SupabaseClient<Database>` placeholder.

## Data Flow & API Contracts

- No runtime contract changes; only test-time stubs. Guest services contract remains unchanged.

## UI/UX States

- Not applicable (server-side test only).

## Edge Cases

- Ensure fake user matches required `User` fields to satisfy TypeScript without loosening types elsewhere.

## Testing Strategy

- Run `pnpm eslint tests/server/guest/view-models.test.ts --max-warnings=0` to confirm lint passes.

## Rollout

- No feature flags or rollout steps. Change is test-only.
