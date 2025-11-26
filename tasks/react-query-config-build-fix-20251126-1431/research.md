---
task: react-query-config-build-fix
timestamp_utc: 2025-11-26T14:31:00Z
owner: github:@amankumarshrestha
reviewers: [github:@amankumarshrestha]
risk: low
flags: []
related_tickets: []
---

# Research: React Query config build fix

## Requirements

- Functional: unblock `pnpm run build` by resolving TypeScript error in `src/app/providers.tsx` around `QueryClient` options (`gcTime` / `staleTime`).
- Non-functional: keep existing caching semantics intact; no API changes.

## Existing Patterns & Reuse

- React Query configuration is centralized in `src/app/providers.tsx`; uses helper functions `getQueryStaleTime` and `getQueryGcTime`.

## External Resources

- None yet; rely on project code.

## Constraints & Risks

- Must maintain desired cache timings; avoid regressions in query invalidation.
- Keep change minimal per AGENTS guidance.

## Open Questions (owner, due)

- None identified yet.

## Recommended Direction (with rationale)

- Inspect `getQueryStaleTime` / `getQueryGcTime` return types and update the `QueryClientConfig` to match React Query v5 expectations (numeric milliseconds), likely by invoking helpers directly instead of passing functions.
