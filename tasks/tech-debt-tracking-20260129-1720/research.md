---
task: tech-debt-tracking
timestamp_utc: 2026-01-29T17:20:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Tech-Debt Tracking

## Requirements

- Functional:
  - Add a GitHub issue template for tech-debt tracking.
  - Add an in-repo tech-debt ledger with a consistent schema.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No runtime or UI changes.

## Existing Patterns & Reuse

- Issue templates live under `.github/ISSUE_TEMPLATE/` (bug + feature).
- Task artifacts follow the SDLC templates in `AGENTS.md`.

## External Resources

- None required.

## Constraints & Risks

- Follow AGENTS.md SDLC requirements and run validators after changes.
- Keep the ledger and template minimal to avoid process drift.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Add a tech-debt issue template mirroring existing issue template style.
- Add a single ledger file in-repo to track tech-debt items with status and links to issues.
