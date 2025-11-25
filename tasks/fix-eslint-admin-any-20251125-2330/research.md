---
task: fix-eslint-admin-any
timestamp_utc: 2025-11-25T23:30:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Resolve ESLint any in server/occasions/admin.ts

## Requirements

- Functional: eliminate the `@typescript-eslint/no-explicit-any` warning at server/occasions/admin.ts:90 without altering runtime behavior.
- Non-functional: maintain TypeScript correctness, keep existing API signatures stable, no regressions to occasion admin workflows; no new a11y/perf/security impact expected.

## Existing Patterns & Reuse

- server codebase uses typed request/response helpers for occasions; existing types likely available in `types` or `server/occasions` modules.
- ESLint configured with `no-explicit-any`; similar handlers use typed request bodies or generics.

## External Resources

- None needed beyond in-repo types.

## Constraints & Risks

- Must avoid changing public API shape for admin occasions.
- Risk: choosing incorrect type could hide bug; prefer deriving from existing interfaces.

## Open Questions (owner, due)

- None identified; scope is narrow.

## Recommended Direction (with rationale)

- Inspect the offending `any`, infer intended data shape from surrounding code or shared types (e.g., request payload/response for admin occasion listings), and replace with the precise existing type. Keeps lint clean and type safety consistent.
