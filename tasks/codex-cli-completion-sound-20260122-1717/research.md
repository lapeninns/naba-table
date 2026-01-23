---
task: codex-cli-completion-sound
timestamp_utc: 2026-01-22T17:17:00Z
owner: github:@unassigned
reviewers: [github:@unassigned]
risk: low
flags: []
related_tickets: []
---

# Research: Codex CLI Completion Sound

## Requirements

- Functional:
  - Task completion triggers an audible sound in Codex CLI.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No UI changes expected.
  - No new secrets or external network calls.

## Existing Patterns & Reuse

- TBD after codebase search.

## External Resources

- TBD if OS-level audio APIs or node libraries are used.

## Constraints & Risks

- Sound behavior may be OS-specific.
- CLI might rely on terminal bell or OS notification settings.

## Open Questions (owner, due)

- Q: Which OS and Codex CLI version are in use? (owner: github:@unassigned)
- Q: Should sound be configurable or always on? (owner: github:@unassigned)

## Recommended Direction (with rationale)

- Locate existing completion notification handling and fix sound trigger using the same mechanism for consistency.
