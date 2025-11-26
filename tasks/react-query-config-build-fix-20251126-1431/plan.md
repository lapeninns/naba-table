---
task: react-query-config-build-fix
timestamp_utc: 2025-11-26T14:31:00Z
owner: github:@amankumarshrestha
reviewers: [github:@amankumarshrestha]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: React Query config build fix

## Objective

Ensure `next build` succeeds by aligning `QueryClient` configuration with React Query v5 types without changing intended cache behavior.

## Success Criteria

- [ ] `pnpm run build` completes without TypeScript errors.
- [ ] Cache timing semantics remain unchanged.

## Architecture & Components

- `src/app/providers.tsx`: adjust `queryClientConfig` values for `staleTime` and `gcTime`.
- Helpers `getQueryStaleTime` / `getQueryGcTime`: confirm return signatures.

## Data Flow & API Contracts

- No API changes; only client-side cache config.

## UI/UX States

- N/A (config only).

## Edge Cases

- Ensure undefined/null handling mirrors previous behavior (if helper already covers).

## Testing Strategy

- Build command (`pnpm run build`).
- Spot-check `pnpm run lint` if fast.

## Rollout

- No flags; immediate.
