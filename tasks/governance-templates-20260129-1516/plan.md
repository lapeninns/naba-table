---
task: governance-templates
timestamp_utc: 2026-01-29T15:17:10Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Governance Templates

## Objective

Provide standardized GitHub issue and PR templates to close the governance templates readiness gap.

## Success Criteria

- [ ] `.github/PULL_REQUEST_TEMPLATE.md` exists and matches AGENTS.md appendix guidance.
- [ ] `.github/ISSUE_TEMPLATE` includes bug report and feature request templates.
- [ ] Validators pass (`pnpm lint`, `pnpm typecheck`, `pnpm test`).

## Architecture & Components

- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/ISSUE_TEMPLATE/bug_report.md`
- `.github/ISSUE_TEMPLATE/feature_request.md`
- `.github/ISSUE_TEMPLATE/config.yml`

## Data Flow & API Contracts

- None.

## UI/UX States

- None.

## Edge Cases

- Ensure templates are minimal and align with repo governance requirements.

## Testing Strategy

- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`.

## Rollout

- Immediate; templates are used for new GitHub issues/PRs.

## DB Change Plan (if applicable)

- Not applicable.
