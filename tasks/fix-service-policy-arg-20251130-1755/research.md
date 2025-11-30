---
task: fix-service-policy-arg
timestamp_utc: 2025-11-30T17:55:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Fix loadServicePolicy call in tables summary

## Requirements

- Functional: Resolve TypeScript build failure in `server/ops/tables.ts` caused by calling `loadServicePolicy` without required arguments; build must succeed.
- Non-functional: Keep change minimal; no behavior change beyond fix; maintain existing typing and error handling.

## Existing Patterns & Reuse

- `loadServicePolicy(client: PublicClient)` is defined in the same file and used to fetch service policy from Supabase.
- Other helper functions in this file pass the `client` explicitly when invoked inside `Promise.all`.

## External Resources

- N/A (issue fully contained in codebase).

## Constraints & Risks

- Low risk: Single argument omission; potential risk of overlooking additional call sites.

## Open Questions (owner, due)

- None identified.

## Recommended Direction (with rationale)

- Pass the existing `client` variable into `loadServicePolicy` within the `Promise.all` call to satisfy its signature and preserve data fetching context.
