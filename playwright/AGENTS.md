---
agents_version: 5.3
scope: subproject
extends: ../AGENTS.md
last_updated: 2025-12-10
owner: github:@qa
profile: playwright
---

# AGENTS.md — Playwright Auth & Assets (`playwright/`)

> Inherits root `/AGENTS.md`. Governs Playwright-specific artifacts (auth state, storage state, download targets) stored under `playwright/**`.

## Overview

- `.auth/` holds Playwright storage/auth state JSON used by `playwright.config.ts` and `tests/e2e/**`.
- Additional subfolders may include trace archives, screenshots, or temporary downloads referenced during CI runs.

## Guidelines

1. **Secrets Hygiene**
   - Auth files must never contain real user credentials. Use **non-prod** service accounts and rotate regularly.
   - If tokens expire or get regenerated, update `.auth` via `pnpm run test:e2e -- --update-snapshots` (or equivalent script) and document commands executed in the task folder.
2. **Version Control**
   - Only commit deterministic auth/state fixtures that CI requires. Large binary traces belong in `test-results/` or external storage referenced in artifacts, not here.
   - Keep `.gitignore` aligned to exclude transient downloads.
3. **Regeneration Workflow**
   - Use Playwright's `global-setup` to sign in and refresh storage state; do **not** edit JSON manually.
   - Validate new state by running a smoke spec locally before pushing.
4. **Environment Alignment**
   - Ensure auth profiles match the environment under test (staging vs preview). Mismatched URLs cause flaky tests.
   - Store environment metadata (base URL, feature flags) with the generated state when possible for troubleshooting.

## Testing & Artifacts

- Whenever auth state changes, attach the generation log/output to `tasks/<slug>/artifacts/playwright-auth-refresh.txt`.
- Run targeted login smoke tests (`pnpm run test:e2e -- --grep @auth`) after updating `.auth`.

## Links

- Root AGENTS: `/AGENTS.md`
- Test suites: `tests/e2e/**`
- Config: `playwright.config.ts`, `tests/e2e/README.md`
