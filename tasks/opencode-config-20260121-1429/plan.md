---
task: opencode-config
timestamp_utc: 2026-01-21T14:30:35Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Opencode Config Max Out

## Objective

We will update Opencode configuration to “max out” all supported settings (including remote management and WS auth) without committing secrets.

## Success Criteria

- [ ] `config/agent.config.yaml` reflects maximized settings.
- [ ] `config/agent.config.example.yaml` reflects maximized settings.
- [ ] No secrets or real API keys are committed.

## Architecture & Components

- `config/agent.config.yaml`: primary config to update.
- `config/agent.config.example.yaml`: example config to keep in sync.

## Data Flow & API Contracts

- N/A (configuration-only change).

## UI/UX States

- N/A.

## Edge Cases

- Remote management enabled with placeholder secrets requires out-of-band key setup.

## Testing Strategy

- Config validation is manual (ensure YAML remains valid).

## Rollout

- Direct change in config; no flags.

## DB Change Plan (if applicable)

- N/A.
