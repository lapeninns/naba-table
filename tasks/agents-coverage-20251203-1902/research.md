---
task: agents-coverage
timestamp_utc: 2025-12-03T19:02:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: AGENTS coverage gaps

## Requirements

- Functional: add missing subproject `AGENTS.md` files for policy compliance.
- Non-functional: follow root AGENTS rules (frontmatter, scope, extends, profiles); keep changes scoped; no secrets.

## Existing Patterns & Reuse

- Root `AGENTS.md` provides baseline; existing subproject files in `src/app`, `src/components`, `src/hooks`, `src/services/ops` show preferred structure (frontmatter + overview + rules + links).

## External Resources

- N/A (internal policy only).

## Constraints & Risks

- Must not relax non-overridable rules; path casing must be exact `AGENTS.md`.
- Ensure correct relative `extends` path for each directory.

## Open Questions (owner, due)

- None identified.

## Recommended Direction (with rationale)

- Create six new subproject `AGENTS.md` files (reserve, server, lib, components/, hooks/, libs/) mirroring existing pattern, tailored to each domain.
- Document build/test commands and domain-specific guardrails.
