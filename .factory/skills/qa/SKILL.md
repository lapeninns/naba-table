---
name: qa
description: >
  Run QA tests for nabatable-platform. Analyze git diff to select affected apps,
  execute diff-relevant functional flows with the configured personas, and write
  a concise QA report with evidence.
---

# QA Orchestrator

**SCOPE: This skill performs manual/functional QA only — verifying that the application actually works by interacting with it as a real user would (browser, API calls). Do NOT run or report on CI checks, linting, ESLint, typecheck, unit tests, or static analysis.**

## Step 1: Load Configuration

Read `.factory/skills/qa/config.yaml` for environments, auth expectations, personas, app mappings, integrations, cleanup rules, and failure-learning mode.

## Step 2: Determine Target Environment

Use `default_target` unless the user explicitly names another environment.
Respect every listed environment restriction.

**CRITICAL: Vercel preview deployments are development-like environments.**

- Use development/staging-safe flows against preview URLs.
- Use sandbox credentials and non-production data assumptions.
- Do **not** use production-only data or payment assumptions against preview URLs.

## Step 3: Analyze Git Diff

Run `git diff` and map changed files to apps using `apps.*.path_patterns` from `config.yaml`.

- A changed file may activate more than one app when it matches shared patterns.
- Files that match no app path patterns are out of scope for app flows.
- If no app is affected, report `INCONCLUSIVE`: `No app code changed -- QA not applicable for this diff.`

For each affected app:

- Load only that app’s module from `.factory/skills/qa-<app-name>/SKILL.md`
- Run only the diff-relevant flows plus adjacent integration checks
- Write ad-hoc checks when the diff changes behavior not covered by an existing flow

For apps not affected by the diff:

- Do not load their sub-skill
- Do not run their pre-flight checks
- Do not include them in the report

## Step 4: Pre-flight Checks

Run pre-flight checks only for affected apps.

- The repo does **not** currently contain a checked-in GitHub preview-deployment workflow.
- For web apps, default to local dev server startup unless the user explicitly provides a preview URL.
- For API-only checks, use the local Next.js server unless the user names a different target.
- For Cloudflare workers, use the configured deployed worker URLs only when the relevant env vars are present.

If a pre-flight check fails, report that app/flow as `BLOCKED` with remediation and continue with any other affected apps.

## Step 5: Execute Diff-Relevant Flows Only

Each app module contains a flow menu. Select the smallest meaningful set that proves the changed behavior:

1. Change-specific checks first
2. Adjacent integration checks second
3. At least one negative/error-path check when relevant
4. No unrelated smoke-test wandering

Do not run automated test suites.

## Step 6: Evidence Capture

Capture evidence after each meaningful assertion.

- For web apps: use text snapshots from the browser accessibility tree as the primary evidence; save screenshots into `./qa-results/$RUN_ID/`.
- For API flows: include the relevant request/response summary with status codes and trimmed payload excerpts.
- Reference screenshots as artifact filenames only; do not embed broken image links.

## Step 7: Test Quality Gate

Before marking QA complete, confirm:

1. At least half of the executed checks directly validate the changed behavior
2. Integration checks are relevant to that change
3. At least one negative/boundary check is present when applicable
4. No unrelated flows were run
5. If the change cannot be understood, report `INCONCLUSIVE`

## Step 8: Handle Failures

**Never silently skip a flow. If a flow cannot complete, report it as BLOCKED with what was tried and how the user can fix it.**

Continue with other relevant affected apps after a failure or block.

## Step 9: Generate Report

Write the final report to `./qa-results/report.md` using `.factory/skills/qa/REPORT-TEMPLATE.md`.

Rules:

- Start with `## QA Report`
- Use result values exactly as:
  - `:white_check_mark: PASS`
  - `:x: FAIL`
  - `:no_entry: BLOCKED`
  - `:warning: FLAKY`
  - `:grey_question: INCONCLUSIVE`
- Keep the report concise
- Put evidence inside a single collapsed `<details>` block

## Step 10: Suggest Skill Updates

Read `failure_learning` from `config.yaml`.

- If it is `suggest_in_report`, include a `Suggested Skill Updates` section only when a new environment/workflow insight was discovered from a `FAIL` or `BLOCKED` result.
- Do not suggest updates for selector bugs, typos, or expected product-copy changes.
- If no new environment insight was discovered, omit the section.

## App Routing Notes

- `qa-web`: guest/public and ops browser flows in the Next.js app
- `qa-backend`: Next.js API/server routes verified through HTTP requests
- `qa-reserve`: Vite reserve flows verified in a browser
- `qa-cloudflare-workers`: worker endpoints verified with HTTP requests when URLs are configured
