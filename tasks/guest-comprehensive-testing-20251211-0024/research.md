---
task: guest-comprehensive-testing
timestamp_utc: 2025-12-11T00:24:00Z
owner: github:@maintainers
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Research: Guest Comprehensive Testing

## Requirements

- Functional:
  - Execute full CRUD lifecycle for Guest (Profile & Booking).
  - Run comprehensive Chrome DevTools tests for guest-facing routes.
- Non-functional:
  - Capture artifacts (screenshots, logs).

## Existing Patterns & Reuse

- Workflow: `.agent/workflows/guest_crud_testing.md`
- Workflow: `.agent/workflows/guest_ui_testing.md`

## Recommended Direction

- Use `browser_subagent` to execute the steps defined in the workflows.
- Ensure the local server is running on port 3000.
