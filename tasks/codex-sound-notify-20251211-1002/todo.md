---
task: codex-sound-notify
timestamp_utc: 2025-12-11T10:02:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Locate active Codex CLI config.toml
- [x] Confirm current notify behaviour and logs

## Core

- [x] Create wrapper script for `afplay` (ignores JSON arg)
- [x] Update notify command to use wrapper (absolute paths)

## Tests

- [x] Manual test: invoke wrapper directly
- [ ] CLI test: run task and verify sound plays

## Notes

- Assumptions: macOS available with `afplay` and system sounds.
- Deviations: None yet.

## Batched Questions

- None.
