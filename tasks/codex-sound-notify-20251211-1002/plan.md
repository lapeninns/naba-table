---
task: codex-sound-notify
timestamp_utc: 2025-12-11T10:02:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Codex CLI sound notification

## Objective

Ensure Codex CLI triggers an audible sound on task completion by configuring a notify command that handles the appended JSON argument correctly.

## Success Criteria

- [ ] Running a sample task in Codex CLI plays the selected macOS system sound.
- [ ] Notify command exits successfully without errors in logs.

## Architecture & Components

- Config: `~/.config/codex/config.toml` (or repo-level override if present).
- Notify command: wrapper script using `afplay` to play `/System/Library/Sounds/Ping.aiff`.

## Data Flow & API Contracts

- Codex CLI executes `notify` command with a JSON string argument describing the event.
- Wrapper script ignores the JSON argument (or optionally uses it) and calls `afplay` once.

## UI/UX States

- Not applicable (CLI); focus on audible feedback.

## Edge Cases

- `afplay` binary not on PATH.
- Sound file path missing or permission denied.
- Multiple rapid notifications should still play; script must exit fast.

## Testing Strategy

- Manual: run `echo '{}' | <notify command>` to confirm sound.
- CLI: run a small task to trigger notification and observe sound.

## Rollout

- No feature flags; update config and validate locally.

## DB Change Plan

- Not applicable.
