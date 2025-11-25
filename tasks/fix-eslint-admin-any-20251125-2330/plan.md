---
task: fix-eslint-admin-any
timestamp_utc: 2025-11-25T23:30:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Resolve ESLint any in admin occasions

## Objective

Remove the `no-explicit-any` violation in `server/occasions/admin.ts` by replacing `any` with an appropriate type while keeping behavior unchanged.

## Success Criteria

- [ ] ESLint passes for `server/occasions/admin.ts` with `--max-warnings=0`.
- [ ] No API/logic regressions to admin occasion handling.

## Architecture & Components

- File: `server/occasions/admin.ts` (server-side helper/controller).
- Likely types: reuse existing occasion/admin DTO interfaces.

## Data Flow & API Contracts

- Preserve existing input/output shapes; only tighten TypeScript annotation.

## UI/UX States

- N/A (server-side lint fix only).

## Edge Cases

- Type chosen must cover all fields used in code path to avoid narrowing bugs.

## Testing Strategy

- Run targeted ESLint on the file or project to confirm warning resolved.
- Rely on existing tests if present; no new runtime behavior introduced.

## Rollout

- No feature flags; immediate.

## DB Change Plan

- N/A.
