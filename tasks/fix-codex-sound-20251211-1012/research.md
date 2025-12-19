---
task: fix-codex-sound
timestamp_utc: 2025-12-11T10:12:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Codex completion sound not playing

## Requirements

- Functional: Play an audible sound whenever Codex CLI emits a notification for a completed agent turn / task.
- Non-functional: Keep zero external dependencies (use built-in macOS tools), avoid blocking the CLI, and keep configuration minimal/reversible.

## Existing Patterns & Reuse

- Prior task `codex-sound-notify-20251211-1002` created `~/.codex/hooks/play-ping.sh` and pointed `notify` to it.
- Wrapper script already handles the appended JSON payload and filters non-completion events.

## External Resources

- Codex CLI config docs: `notify` must be a top-level command array; placing it inside `[tui]` is ignored.

## Constraints & Risks

- Current config has `notify` inside `[tui]`, so the hook never runs.
- Config reload may require restarting the Codex CLI session; otherwise new value won’t apply.
- If `afplay` or sound file is unavailable, the hook will silently no-op (by design).

## Open Questions (owner, due)

- Does Codex require a restart to pick up top-level `notify`? (owner: assistant, due: before verification)

## Recommended Direction (with rationale)

- Move `notify` to the top-level of `~/.codex/config.toml` while keeping `tui.notifications = true`.
- Reuse `play-ping.sh` (already executable) to swallow JSON payload and play `/System/Library/Sounds/Ping.aiff` via `/usr/bin/afplay`.
- Restart Codex CLI or confirm new config is loaded, then run a quick task to verify audible notification.
