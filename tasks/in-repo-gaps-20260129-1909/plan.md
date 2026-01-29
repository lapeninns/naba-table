---
task: in-repo-gaps-20260129-1909
timestamp_utc: 2026-01-29T19:09:00Z
owner: github:@droid
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix In-Repo Readiness Gaps

## Objective

Add missing in-repo infrastructure to improve agent readiness score from 56/81 to 61/81.

## Success Criteria

- [ ] `.devcontainer/devcontainer.json` created with Node.js + pnpm
- [ ] Test isolation policy documented in `docs/testing.md`
- [ ] `scripts/setup.sh` automates full setup in one command
- [ ] Documentation freshness workflow checks last-updated timestamps
- [ ] `.codex/skills/` directory structure created
- [ ] `agent-readiness-report.json` updated with evidence (61/81)

## Architecture & Components

1. **Devcontainer**: VS Code devcontainer with Node.js 20, pnpm, Docker Compose
2. **Test isolation docs**: New `docs/testing.md` section on isolation policy
3. **Setup script**: Bash script chaining `pnpm install → cp .env.example .env → pnpm validate:env → echo ready`
4. **Doc freshness**: CI workflow using grep to check `last_updated:` frontmatter
5. **Skills**: Directory structure with README explaining skill format

## Data Flow & API Contracts

N/A (local tooling only)

## UI/UX States

N/A (no UI changes)

## Edge Cases

- Setup script: handle existing `.env` file (don't overwrite)
- Devcontainer: document that Docker is optional
- Doc freshness: warn but don't fail build

## Testing Strategy

- Manual: run `scripts/setup.sh` on clean checkout
- Manual: open repo in VS Code with devcontainer extension
- Automated: validators (lint/typecheck/test) must pass

## Rollout

- Immediate; no feature flags needed

## DB Change Plan

N/A
