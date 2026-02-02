---
task: remove-tests-ci
timestamp_utc: 2026-02-02T12:33:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Remove tests/CI and related items

## Objective

We will remove test suites, CI workflows, and associated configs so that the repo no longer runs tests/CI by default.

## Success Criteria

- [ ] CI workflow files removed.
- [ ] Test configs and scripts removed or disabled.
- [ ] Package scripts/docs updated to avoid references to removed items.

## Architecture & Components

- No new components; remove/adjust existing configs.

## Data Flow & API Contracts

- N/A

## UI/UX States

- N/A

## Edge Cases

- Ensure build/dev commands still work after removing test/CI references.

## Testing Strategy

- Verify build/typecheck as applicable after removals.

## Rollout

- Remove CI configs in-repo; no deployment changes.

## DB Change Plan (if applicable)

- N/A
