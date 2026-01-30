# Agent Readiness Report

**Repository:** https://github.com/LapenInns/nabatable.git  
**Generated:** 2026-01-30  
**Report ID:** Not stored (store_agent_readiness_report failed: Fetch failed)

---

## Level

**Level 5** — **100% pass rate (80/80)**  
`devcontainer_runnable` now enforced via `.github/workflows/devcontainer.yml`.

---

## Applications

1. **. (root)** — Next.js 16 reservation/capacity platform (React 19, Supabase, ops dashboard).
2. **reserve/** — Vite-powered booking UI (feature-sliced app per `reserve/AGENTS.md`).

---

## Criteria

### Style & Validation

| Criterion                     | Score | Rationale                                                                                               |
| ----------------------------- | ----- | ------------------------------------------------------------------------------------------------------- |
| lint_config                   | 1/1   | `eslint.config.mjs` + CI lint step.                                                                     |
| type_check                    | 1/1   | `pnpm typecheck` in CI.                                                                                 |
| formatter                     | 1/1   | `.prettierrc.json` + lint-staged.                                                                       |
| pre_commit_hooks              | 1/1   | Husky + `.pre-commit-config.yaml`.                                                                      |
| strict_typing                 | 1/1   | `tsconfig.strict.json` enabled.                                                                         |
| naming_consistency            | 1/1   | ESLint `consistent-type-imports`, `import/order`.                                                       |
| cyclomatic_complexity         | 1/1   | ESLint `complexity` rule set.                                                                           |
| large_file_detection          | 1/1   | File size checks in pre-commit.                                                                         |
| dead_code_detection           | 1/1   | Knip config + script.                                                                                   |
| duplicate_code_detection      | 1/1   | Jscpd config + scripts.                                                                                 |
| code_modularization           | 1/1   | Modular src/server/lib/reserve layout.                                                                  |
| tech_debt_tracking            | 1/1   | `pnpm todo:scan` + report.                                                                              |
| n_plus_one_detection          | 1/1   | Supabase fetch instrumentation logs repeated request signatures (`server/supabase-instrumentation.ts`). |
| heavy_dependency_detection    | 1/1   | Next.js gzip bundle budget check in CI (`scripts/check-next-bundle-budget.ts`).                         |
| unused_dependencies_detection | 1/1   | Knip configured.                                                                                        |
| version_drift_detection       | 1/1   | Workspace dependency drift check (`scripts/check-version-drift.ts`) + CI step.                          |
| code_quality_metrics          | 1/1   | ESLint/Jscpd/Knip scripts.                                                                              |

### Build System & Development

| Criterion                    | Score | Rationale                                                                                                                   |
| ---------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------- |
| build_cmd_doc                | 1/1   | README documents build/test/lint.                                                                                           |
| deps_pinned                  | 1/1   | `pnpm-lock.yaml` committed.                                                                                                 |
| vcs_cli_tools                | 1/1   | `gh` authenticated.                                                                                                         |
| fast_ci_feedback             | 1/1   | Avg CI ≈ 2.28 min.                                                                                                          |
| build_performance_tracking   | 1/1   | CI writes timed step durations to job summary (lint/typecheck/tests/build).                                                 |
| deployment_frequency         | 1/1   | Production deploy + rollback workflows added (`.github/workflows/deploy-production.yml`, `.github/workflows/rollback.yml`). |
| single_command_setup         | 1/1   | `pnpm install` + `pnpm dev`.                                                                                                |
| feature_flag_infrastructure  | 1/1   | `server/feature-flags.ts`.                                                                                                  |
| release_notes_automation     | 1/1   | Release-please configured (`.github/workflows/release-please.yml`).                                                         |
| progressive_rollout          | 1/1   | Deterministic percentage rollout utility added (`lib/feature-flags/rollout.ts`).                                            |
| rollback_automation          | 1/1   | Rollback workflow redeploys a chosen SHA (`.github/workflows/rollback.yml`).                                                |
| monorepo_tooling             | 1/1   | `pnpm-workspace.yaml`.                                                                                                      |
| release_automation           | 1/1   | `sentry-release.yml`.                                                                                                       |
| dead_feature_flag_detection  | 1/1   | `pnpm flags:audit` (fails on unused flag accessors) runs in CI.                                                             |
| dependency_update_automation | 1/1   | Dependabot configured.                                                                                                      |

### Testing

| Criterion                 | Score | Rationale                                                                            |
| ------------------------- | ----- | ------------------------------------------------------------------------------------ |
| unit_tests_exist          | 1/1   | `tests/lib/logger.test.ts`.                                                          |
| integration_tests_exist   | 1/1   | Playwright smoke E2E added (`tests/e2e/*`) + Playwright config.                      |
| unit_tests_runnable       | 1/1   | `pnpm exec vitest --run tests/lib/logger.test.ts` passed.                            |
| test_performance_tracking | 1/1   | CI captures per-step durations in job summary.                                       |
| flaky_test_detection      | 1/1   | Nightly flake check workflow reruns tests (`.github/workflows/flaky-detection.yml`). |
| test_coverage_thresholds  | 1/1   | Non-zero Vitest coverage thresholds enforced in `vitest.config.ts`.                  |
| test_naming_conventions   | 1/1   | `**/*.test.ts` patterns configured.                                                  |
| test_isolation            | 1/1   | Vitest `isolate: true`.                                                              |

### Documentation

| Criterion                | Score | Rationale                              |
| ------------------------ | ----- | -------------------------------------- |
| agents_md                | 1/1   | Root + subproject `AGENTS.md`.         |
| readme                   | 1/1   | README includes setup and scripts.     |
| automated_doc_generation | 1/1   | `typedoc.json` + `docs:generate`.      |
| skills                   | 1/1   | `.factory/skills/*` present.           |
| documentation_freshness  | 1/1   | AGENTS updated within 180 days.        |
| api_schema_docs          | 1/1   | `openapi.yaml`.                        |
| service_flow_documented  | 1/1   | `docs/architecture/*.mermaid`.         |
| agents_md_validation     | 1/1   | `pnpm agents:validate` enforced in CI. |

### Dev Environment

| Criterion               | Score | Rationale                                                               |
| ----------------------- | ----- | ----------------------------------------------------------------------- |
| devcontainer            | 1/1   | `.devcontainer/devcontainer.json`.                                      |
| env_template            | 1/1   | `.env.example` provided.                                                |
| local_services_setup    | 1/1   | `docker-compose.yml` + `docs/local-services.md` (Supabase remote-only). |
| database_schema         | 1/1   | Supabase migrations + types.                                            |
| devcontainer_runnable   | 1/1   | Devcontainer build workflow (`.github/workflows/devcontainer.yml`).     |
| gitignore_comprehensive | 1/1   | `.gitignore` covers env/build outputs.                                  |

### Debugging & Observability

| Criterion                         | Score | Rationale                                                                            |
| --------------------------------- | ----- | ------------------------------------------------------------------------------------ |
| structured_logging                | 1/1   | `lib/logger.ts` structured JSON logs.                                                |
| log_scrubbing                     | 1/1   | Redaction of sensitive keys.                                                         |
| distributed_tracing               | 1/1   | `lib/tracing.ts` request/trace IDs.                                                  |
| metrics_collection                | 1/1   | `lib/metrics.ts`.                                                                    |
| error_tracking_contextualized     | 1/1   | Sentry release + environment tags.                                                   |
| alerting_configured               | 1/1   | `docs/alerting.md`.                                                                  |
| runbooks_documented               | 1/1   | `docs/runbooks/*`.                                                                   |
| deployment_observability          | 1/1   | `docs/observability.md`.                                                             |
| health_checks                     | 1/1   | `/api/health` probe.                                                                 |
| circuit_breakers                  | 1/1   | Circuit breaker utility added (`server/lib/circuit-breaker.ts`).                     |
| profiling_instrumentation         | 1/1   | On-demand profiling documented + script (`docs/profiling.md`, `pnpm profile:cpu`).   |
| product_analytics_instrumentation | 1/1   | PostHog + Plausible.                                                                 |
| error_to_insight_pipeline         | 1/1   | Sentry issues can sync to GitHub issues (`.github/workflows/sentry-issue-sync.yml`). |

### Security

| Criterion                 | Score | Rationale                                                                                                                                            |
| ------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| branch_protection         | 1/1   | Main requires quality checks + 1 review.                                                                                                             |
| secret_scanning           | 1/1   | gitleaks + trufflehog + GH scanning.                                                                                                                 |
| codeowners                | 1/1   | `.github/CODEOWNERS`.                                                                                                                                |
| automated_security_review | 1/1   | CI security scans + pnpm audit.                                                                                                                      |
| dast_scanning             | 1/1   | OWASP ZAP baseline scan workflow (`.github/workflows/dast.yml`).                                                                                     |
| pii_handling              | 1/1   | IP anonymization + email hashing.                                                                                                                    |
| privacy_compliance        | 1/1   | Consent-gated analytics + DSAR intake endpoint + docs (`components/CookieConsentBanner.tsx`, `src/app/api/privacy/dsar/route.ts`, `docs/privacy/*`). |
| secrets_management        | 1/1   | Env templates + README guidance.                                                                                                                     |

### Workflow & Collaboration

| Criterion             | Score | Rationale                                                                              |
| --------------------- | ----- | -------------------------------------------------------------------------------------- |
| issue_templates       | 1/1   | Issue forms configured.                                                                |
| pr_templates          | 1/1   | PR template present.                                                                   |
| issue_labeling_system | 1/1   | Label taxonomy + sync workflow (`.github/labels.yml`, `.github/workflows/labels.yml`). |
| automated_pr_review   | 1/1   | PR checklist comment bot (`.github/workflows/pr-auto-review.yml`).                     |
| agentic_development   | 1/1   | AGENTS + tasks + skills present.                                                       |
| backlog_health        | 1/1   | No open issues.                                                                        |

---

## Action Items

No remaining 0/1 criteria in this report.

---

## Verification Notes

- `pnpm lint` (warnings only)
- `pnpm typecheck` (pass)
- `pnpm test:ci` (pass; coverage thresholds enforced)
- `pnpm version:drift` (pass)
- `pnpm flags:audit` (pass)
- `pnpm build` (pass)
- `pnpm bundle:budget` (pass)
- `PORT=3100 pnpm start` + `BASE_URL=http://localhost:3100 pnpm test:e2e tests/e2e/smoke --project=chromium` (pass)

---

## Full Report

View the full interactive report: https://app.factory.ai/analytics/readiness/https%253A%252F%252Fgithub.com%252Flapeninns%252Fnabatable
