---
task: in-repo-gaps-20260129-1909
timestamp_utc: 2026-01-29T19:09:00Z
owner: github:@droid
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create task folder and artifacts

## Core

- [ ] Add `.devcontainer/devcontainer.json`
- [ ] Add test isolation section to `docs/testing.md`
- [ ] Create `scripts/setup.sh`
- [ ] Add `.github/workflows/doc-freshness.yml`
- [ ] Create `.codex/skills/README.md`

## Updates

- [ ] Update `agent-readiness-report.json` with evidence (5 criteria)
- [ ] Update `CONTINUITY.md`

## Validation

- [ ] Run `pnpm lint`
- [ ] Run `pnpm typecheck`
- [ ] Run `pnpm test`
- [ ] Test `scripts/setup.sh` manually

## Notes

- Assumptions: Docker optional; .env already exists in most cases
- Deviations: None
