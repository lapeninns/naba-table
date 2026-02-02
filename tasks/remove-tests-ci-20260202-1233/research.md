---
task: remove-tests-ci
timestamp_utc: 2026-02-02T12:33:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Remove tests/CI and related items

## Requirements

- Functional: remove tests, CI workflows, and related configs/scripts per request.
- Non-functional (a11y, perf, security, privacy, i18n): no direct impact expected; avoid breaking build/install.

## Existing Patterns & Reuse

- TBD after codebase exploration.

## External Resources

- N/A

## Constraints & Risks

- Removing CI/test scripts can reduce safety checks and may affect downstream automation.
- Must not remove unrelated functionality or production safeguards.

## Open Questions (owner, due)

- Q: Scope of "many other" beyond tests/CI? A: Assume related configs/docs.

## Recommended Direction (with rationale)

- Remove CI workflows and test-related configs/scripts; update package scripts/docs to avoid referencing removed items.
