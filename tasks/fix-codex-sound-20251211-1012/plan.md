---
task: fix-codex-sound
timestamp_utc: 2025-12-11T10:12:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Codex completion sound not playing

## Objective

Ensure the Codex CLI plays a macOS system sound when an agent turn completes by wiring the notify hook correctly.

## Success Criteria

- [ ] Running any task emits the Ping sound at completion.
- [ ] Notify hook exits 0 and fires only once per completion event.

## Architecture & Components

- Config: `~/.codex/config.toml` top-level `notify` pointing to `~/.codex/hooks/play-ping.sh`.
- Hook: `play-ping.sh` ignores JSON payload, filters event type, and calls `/usr/bin/afplay` on `/System/Library/Sounds/Ping.aiff`.

## Data Flow & API Contracts

- Codex CLI appends a JSON payload to the notify command; script swallows payload and triggers sound asynchronously.

## UI/UX States

- CLI-only; audible cue only.

## Edge Cases

- CLI session may need restart to pick new config.
- `afplay` or the sound file missing → script no-ops quietly.

## Testing Strategy

- Manual: invoke hook directly with a sample payload; expect sound + exit 0.
- Integration: run a small Codex task; expect sound on completion.

## Rollout

- Local only; restart Codex CLI session after config change.

## DB Change Plan (if applicable)

- Not applicable.
