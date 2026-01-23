---
task: codex-cli-completion-sound
timestamp_utc: 2026-01-22T17:17:00Z
owner: github:@unassigned
reviewers: [github:@unassigned]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm config path and notify usage
- [x] Enable TUI notifications

## Core

- [x] Update notify sound command
- [ ] Verify sound in local terminal

## Tests

- [ ] Add/update tests if existing notification tests exist

## Notes

- Assumptions:
  - Sound should be enabled by default unless configured off.
- Deviations:
  - None

## Batched Questions

- Which OS and Codex CLI version are you on?
- Is macOS `afplay` acceptable, or should we use another command?
