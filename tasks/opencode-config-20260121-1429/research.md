---
task: opencode-config
timestamp_utc: 2026-01-21T14:30:35Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Opencode Config Max Out

## Requirements

- Functional:
  - Maximize Opencode configuration settings in `config/agent.config.yaml` per user request.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Do not commit secrets; keep placeholders or env-based values only.

## Existing Patterns & Reuse

- `config/agent.config.yaml` and `config/agent.config.example.yaml` define supported config options.

## External Resources

- None referenced in repo.

## Constraints & Risks

- Secrets must not be committed.
- Enabling remote management and WebSocket auth requires strong secrets supplied out of band.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Max out all supported settings, enable remote management and WS auth, and populate provider/payload sections with placeholders to avoid committing secrets.
