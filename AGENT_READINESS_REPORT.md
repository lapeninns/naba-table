# Agent Readiness Report

**Repository:** https://github.com/LapenInns/nabatable.git  
**Generated:** 2026-01-30  
**Report ID:** ae880d16-ea55-41ab-869f-4414225a901f

---

## Level

**Level 3** (47.7% pass rate)

---

## Applications

1. **. (root)** - Next.js 16 reservation and capacity management platform with React 19, Supabase backend, supporting restaurant booking flows, ops dashboard, and capacity management

---

## Criteria

### Style & Validation

| Criterion                     | Score | Rationale                                                                 |
| ----------------------------- | ----- | ------------------------------------------------------------------------- |
| lint_config                   | 1/1   | ESLint configured with TypeScript, import ordering, and React hooks rules |
| formatter                     | 1/1   | Prettier configured                                                       |
| pre_commit_hooks              | 1/1   | Husky + lint-staged + secret scanning                                     |
| naming_consistency            | 1/1   | ESLint enforces naming conventions                                        |
| type_check                    | 1/1   | TypeScript with typecheck script in CI                                    |
| strict_typing                 | 0/1   | TypeScript strict mode disabled (strict: false)                           |
| cyclomatic_complexity         | 0/1   | No complexity analysis tools configured                                   |
| dead_code_detection           | 0/1   | No dead code detection tools                                              |
| duplicate_code_detection      | 0/1   | No duplication detection tools                                            |
| unused_dependencies_detection | 0/1   | No unused dependency detection                                            |

### Build System & Development

| Criterion                    | Score | Rationale                           |
| ---------------------------- | ----- | ----------------------------------- |
| build_cmd_doc                | 1/1   | Build commands documented in README |
| deps_pinned                  | 1/1   | pnpm-lock.yaml committed            |
| single_command_setup         | 1/1   | pnpm install && pnpm dev documented |
| vcs_cli_tools                | 1/1   | gh CLI authenticated                |
| large_file_detection         | 0/1   | No file size detection configured   |
| tech_debt_tracking           | 0/1   | No TODO/FIXME tracking              |
| release_notes_automation     | 0/1   | No changelog generation             |
| release_automation           | 0/1   | No automated releases               |
| dependency_update_automation | 0/1   | No Dependabot/Renovate              |

### Testing

| Criterion                 | Score | Rationale                              |
| ------------------------- | ----- | -------------------------------------- |
| unit_tests_exist          | 0/1   | All test files deleted from repository |
| integration_tests_exist   | 0/1   | All E2E tests deleted                  |
| unit_tests_runnable       | 0/1   | Test command exists but no tests       |
| test_performance_tracking | 1/1   | CI tracks test timing                  |
| test_coverage_thresholds  | 0/1   | No coverage thresholds configured      |
| test_naming_conventions   | 0/1   | No tests exist                         |
| test_isolation            | 0/1   | No tests exist                         |

### Documentation

| Criterion                | Score | Rationale                              |
| ------------------------ | ----- | -------------------------------------- |
| agents_md                | 1/1   | Comprehensive AGENTS.md at root (38KB) |
| readme                   | 1/1   | README with setup instructions         |
| documentation_freshness  | 1/1   | AGENTS.md updated within 180 days      |
| api_schema_docs          | 1/1   | openapi.yaml exists                    |
| database_schema          | 1/1   | Supabase migrations + TypeScript types |
| service_flow_documented  | 0/1   | No architecture diagrams               |
| automated_doc_generation | 0/1   | No doc generation tools                |
| agents_md_validation     | 0/1   | No AGENTS.md validation                |
| skills                   | 0/1   | No skills directory configured         |
| runbooks_documented      | 0/1   | No formal runbooks                     |

### Dev Environment

| Criterion               | Score | Rationale                                        |
| ----------------------- | ----- | ------------------------------------------------ |
| devcontainer            | 0/1   | No devcontainer configuration                    |
| env_template            | 1/1   | .env.example exists                              |
| gitignore_comprehensive | 1/1   | Proper .env\*, node_modules, artifacts exclusion |

### Debugging & Observability

| Criterion                         | Score | Rationale                                    |
| --------------------------------- | ----- | -------------------------------------------- |
| structured_logging                | 1/1   | Custom logger with JSON output and scrubbing |
| log_scrubbing                     | 1/1   | Logger redacts sensitive keys                |
| distributed_tracing               | 0/1   | No trace ID propagation                      |
| metrics_collection                | 0/1   | No metrics instrumentation                   |
| error_tracking_contextualized     | 1/1   | Sentry configured                            |
| alerting_configured               | 0/1   | No alerting system                           |
| health_checks                     | 1/1   | /api/health endpoint with database probe     |
| deployment_observability          | 0/1   | No dashboard links                           |
| product_analytics_instrumentation | 1/1   | PostHog + Plausible configured               |
| error_to_insight_pipeline         | 0/1   | No Sentry-GitHub integration                 |

### Security

| Criterion                 | Score | Rationale                                            |
| ------------------------- | ----- | ---------------------------------------------------- |
| branch_protection         | 0/1   | No branch protection rules configured                |
| secret_scanning           | 1/1   | GitHub secret scanning + gitleaks + trufflehog in CI |
| codeowners                | 0/1   | No CODEOWNERS file                                   |
| automated_security_review | 1/1   | Code scanning enabled (30 alerts)                    |
| secrets_management        | 1/1   | Secure .env pattern with validation                  |

### Workflow & Collaboration

| Criterion                   | Score | Rationale                              |
| --------------------------- | ----- | -------------------------------------- |
| issue_templates             | 0/1   | No issue templates                     |
| pr_templates                | 0/1   | No PR template                         |
| issue_labeling_system       | 0/1   | No open issues to evaluate             |
| automated_pr_review         | 0/1   | No automated review generation         |
| agentic_development         | 0/1   | No AI agent co-authorship detected     |
| feature_flag_infrastructure | 1/1   | Custom feature flag system             |
| code_quality_metrics        | 1/1   | Code scanning provides quality metrics |

---

## Action Items

1. **Re-establish test suite**: All test files were deleted. Add unit tests (jest/vitest), integration tests (Playwright), and configure coverage thresholds to prevent regressions.

2. **Enable branch protection**: Configure rulesets or legacy branch protection on main branch to require PR reviews, status checks, and prevent force pushes.

3. **Add CODEOWNERS + templates**: Create CODEOWNERS file for code review assignments, plus issue/PR templates to standardize contributions and guide agents.

---

## Full Report

View the full interactive report: https://app.factory.ai/analytics/readiness/https%253A%252F%252Fgithub.com%252Flapeninns%252Fnabatable
