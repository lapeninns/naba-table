---
task: merge-restaurant-guest-frontends
timestamp_utc: 2025-12-19T10:40:01Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Merge Restaurant-Side + Guest-Side Frontends

## Requirements

- Functional:
  - Identify merge conflicts between Restaurant-side-frontend and Guest-Side-Frontend.
  - Merge both branches into the target frontend branch.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve existing accessibility and routing separation between guest and restaurant surfaces.

## Existing Patterns & Reuse

- Follow established host-based routing and route group separation (guest vs ops).

## External Resources

- N/A

## Constraints & Risks

- Conflicts may involve shared layout, routing, or middleware that affect both guest and ops surfaces.
- Must adhere to task/branch policy and verification requirements.

## Open Questions (owner, due)

- Q: What is the exact target branch name ("Frontend-2025-Dec 19" vs another existing branch)?
  A: TBD
- Q: Who should be listed as reviewers for this task?
  A: TBD

## Recommended Direction (with rationale)

- Determine conflicts via merge analysis, then resolve in a dedicated task branch before merging into the target branch.
