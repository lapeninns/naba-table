---
task: fix-codex-sound
timestamp_utc: 2025-12-11T10:12:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Review existing Codex notify configuration and hooks

## Core

- [x] Move `notify` to top-level in `~/.codex/config.toml`
- [ ] Restart Codex CLI session to reload config
- [ ] Re-run a task to confirm sound plays on completion

## Tests

- [x] Manual: run `play-ping.sh` with payload and confirm exit 0 + sound
- [ ] Integration: run small task and confirm notification sound

## Notes

- Assumptions:
- Deviations: Created new task folder to document fix following AGENTS policy.

## Batched Questions

-
