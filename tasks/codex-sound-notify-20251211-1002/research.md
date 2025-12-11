---
task: codex-sound-notify
timestamp_utc: 2025-12-11T10:02:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Codex CLI sound notification not playing

## Requirements

- Functional: Ensure Codex CLI plays an audible sound when a task completes (agent-turn complete event).
- Non-functional: Solution should be reliable on macOS, avoid extra dependencies, and stay within Codex CLI notify contract.

## Existing Patterns & Reuse

- Need to inspect Codex CLI notify hook usage; no repository code found so far referencing CLI sound notifications.

## External Resources

- Codex CLI issue thread explaining `notify` receives a JSON payload argument and must be a command array, not a shell string — relevant to why bare `afplay` fails when extra args are appended.
- Community gist showing a wrapper script that plays `afplay` and ignores the JSON payload — confirms need for a shim rather than calling `afplay` directly.

## Constraints & Risks

- Notify command receives JSON argument appended; some executables may reject extra args.
- Path to `afplay` or sound file might differ across macOS versions; sandboxed execution could restrict audio.

## Open Questions (owner, due)

- Does `notify` append a JSON argument that breaks `afplay`? (owner: assistant, due: before fix)
- Is config location/loading correct for Codex CLI? (owner: assistant, due: before fix)

## Recommended Direction (with rationale)

- Validate notify contract and adapt to `afplay` by wrapping in a small script that ignores extra args, or use `bash -lc` pattern to swallow appended JSON.
- Confirm config file path and reload behaviour.
