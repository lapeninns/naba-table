---
task: auth-final-verification
timestamp_utc: 2026-01-04T16:30:00Z
owner: github:@opencode
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Research: Auth Final Verification

## Requirements

- Functional:
  - Unauthenticated users redirected to `/auth`.
  - `/auth` preserves `redirectedFrom` parameter.
  - Role selection passes parameters to sign-in pages.
  - `ImplicitAuthHandler.tsx` uses `redirectedFrom` for post-login redirect.
- Non-functional:
  - No legacy logo paths in the codebase.
  - Documentation matches reality.

## Existing Patterns & Reuse

- `BrandIcon.tsx` for logo paths.
- `useSearchParams` for parameter extraction.

## External Resources

- N/A

## Constraints & Risks

- Ensure token exchange completes before redirection.

## Open Questions (owner, due)

- Q: Does `ImplicitAuthHandler.tsx` currently support `redirectedFrom`?
  A: UNCONFIRMED.

## Recommended Direction (with rationale)

- Inspect `ImplicitAuthHandler.tsx`.
- Update if necessary.
- Perform a global grep for legacy SVG path.
