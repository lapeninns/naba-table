---
task: update-env-local
timestamp_utc: 2026-02-08T12:00:00Z
owner: github:@copilot
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Update .env.local values

## Objective

We will update local environment variables for Clarity and Supabase so the app points at the provided Supabase project and Clarity config.

## Success Criteria

- [ ] .env.local values updated for Clarity + Supabase.
- [ ] No secrets are written into task docs or responses.

## Architecture & Components

- .env.local only; no code changes.

## Data Flow & API Contracts

- Not applicable.

## UI/UX States

- Not applicable.

## Edge Cases

- Ensure Supabase URL and keys align with the same project.

## Testing Strategy

- None required for local env changes.

## Rollout

- Local-only change; no rollout.
