---
agents_version: 5.3
scope: subproject
extends: ../AGENTS.md
last_updated: 2025-12-10
owner: github:@qa
profile: qa-suite
---

# AGENTS.md — Automated Tests (`tests/`)

> Inherits root `/AGENTS.md`. Covers integration/unit scaffolding, shared fixtures, and Playwright/Vitest configs located under `tests/**`.

## Overview

- `global-setup.ts` / `global-teardown.ts` — orchestrate cross-suite fixtures (auth, Supabase session seeding, feature flags).
- `vitest.setup.ts` — shared matchers/polyfills for component + hook tests.
- `server/` — server-focused integration helpers/mocks.
- `e2e/` — Playwright suites (`accessibility/`, `guest/`, `visual/`) plus fixtures and docs for E2E coverage.

## Build & Test Commands

- `pnpm run test` — runs Vitest suites (unit/integration); required before submitting changes touching test helpers.
- `pnpm run test:watch --filter <pattern>` — iterate locally on affected tests.
- `pnpm run test:e2e` or `pnpm run test:e2e -- --grep <tag>` — execute Playwright specs; mandate for UI-impacting work per root policy.
- `pnpm run lint` — ensure TypeScript definitions stay accurate.

## Guidelines

1. **Deterministic Fixtures**
   - Keep fixtures idempotent; reset data in `global-setup.ts`/`teardown.ts` to avoid cross-test pollution.
   - Prefer factories/helpers over inline literals; store shared data under `tests/e2e/fixtures`.
2. **Environment Safety**
   - Never point tests at production; rely on staging/test databases with isolated credentials via env vars.
   - Sanitize secrets before committing recorded traces/screenshots (store only anonymized data in `test-results/`).
3. **Tagging & Coverage**
   - Tag Playwright specs (`@guest`, `@ops`, `@smoke`, `@a11y`) so CI can shard; document tag usage in task `plan.md` when adding new flows.
   - Keep accessibility tests (`tests/e2e/accessibility`) updated alongside UI changes; fail fast on critical/serious Axe findings.
4. **Artifacts & Reporting**
   - Upload Playwright traces/videos/screenshots to `test-results/` or task artifacts referenced in `verification.md`.
   - For flaky tests, open a task and mark spec with `test.skip` plus rationale until fixed; never leave TODOs without owner.
5. **Shared Utilities**
   - Place reusable assertions/matchers in `tests/server` or `tests/e2e/fixtures` rather than duplicating logic.
   - Keep helpers framework-agnostic when possible (e.g., fetch wrappers that can support Vitest + Playwright).

## QA Expectations

- Every UI/UX change must pair automated coverage updates with manual Chrome DevTools MCP evidence.
- Record executed commands and links to `test_output*.log` in the task folder’s `verification.md`.
- Coordinate with @qa for new high-risk flows before merging.

## Links

- Root AGENTS: `/AGENTS.md`
- Playwright config: `playwright.config.ts`, `playwright.component.config.ts`
- App source: `src/app/**`, `src/components/**`
