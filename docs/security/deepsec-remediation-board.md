# DeepSec Remediation Board

Generated from .deepsec/findings on 2026-05-05T12:30:58.507Z.

## Labels

- security-critical
- account-takeover
- tenant-isolation
- service-role
- xss
- csrf
- cron-auth
- secrets
- rate-limit
- data-integrity
- high-bug
- needs-regression
- needs-migration
- needs-prod-config

## Freeze Rules

- No new service-role route additions without a route-level authorization guard.
- No new public/session-cookie mutation route without CSRF validation.
- No new URL fields using only z.string().url() or new URL() without scheme/host policy.
- No cron route may run if CRON_SECRET or equivalent job auth is absent.
- No auth callback, invite, recovery, or token URL may log raw query strings.

## Definition Of Fixed

- The root-cause epic is fixed, not only one reported file.
- Middleware/proxy auth is not sufficient for resource-level authorization.
- Service-role work happens only after route-level auth and tenant/resource checks, or the exception is written and reviewed.
- Session-cookie mutations validate CSRF before parsing or mutating state.
- URL inputs have an explicit allowlist for scheme, host, path class, and redirect target semantics.
- Cron/job entrypoints fail closed when their secret/signature config is absent.
- Raw query strings, tokens, invites, recovery links, and callbacks are redacted in logs and artifacts.
- A regression test covers the negative path that produced the finding.
- Production config or migration requirements are recorded and verified before rollout.

## Root-Cause Tracker

| Epic                                                    | Owner                   | Sprint   | Labels                                                              | Critical | High | High Bug | Medium | Bug | Total |
| ------------------------------------------------------- | ----------------------- | -------- | ------------------------------------------------------------------- | -------: | ---: | -------: | -----: | --: | ----: |
| SEC-001 Account takeover and auth-token exposure        | Auth owner              | Sprint 1 | security-critical, account-takeover, secrets, needs-regression      |        5 |   18 |        3 |     18 |   7 |    51 |
| SEC-002 Service-role before tenant authorization        | Platform/API owner      | Sprint 1 | security-critical, tenant-isolation, service-role, needs-regression |        0 |   72 |       21 |     87 |  11 |   191 |
| SEC-003 Cron and job routes fail open                   | Jobs/infra owner        | Sprint 1 | security-critical, cron-auth, service-role, needs-prod-config       |        0 |    0 |       10 |      6 |   4 |    20 |
| SEC-004 Production data scripts lack target safety      | Data operations owner   | Sprint 1 | high-bug, service-role, data-integrity, needs-prod-config           |        0 |    5 |        9 |     12 |   7 |    33 |
| SEC-005 Missing CSRF on session-cookie mutations        | Web/API owner           | Sprint 2 | csrf, needs-regression                                              |        0 |    0 |        0 |     40 |   0 |    40 |
| SEC-006 Generic URL validation and redirect policy gaps | Web/API owner           | Sprint 2 | xss, data-integrity, needs-regression                               |        0 |   17 |        3 |     20 |   5 |    45 |
| SEC-007 Stored/reflected XSS and output encoding        | Frontend/platform owner | Sprint 2 | xss, needs-regression                                               |        0 |   16 |        0 |     11 |   1 |    28 |
| SEC-008 Secrets in logs, generated artifacts, or config | Infra/security owner    | Sprint 2 | secrets, needs-prod-config, needs-regression                        |        0 |    0 |        2 |     14 |   0 |    16 |
| SEC-009 Rate limiting and abuse controls                | Platform/API owner      | Sprint 2 | rate-limit, needs-regression                                        |        0 |    0 |        0 |     16 |   0 |    16 |
| SEC-010 Data integrity, races, and idempotency          | Domain workflow owner   | Sprint 3 | data-integrity, high-bug, needs-regression                          |        0 |    0 |       37 |      6 |  27 |    70 |
| SEC-011 Schema, migration, and contract drift           | Data/platform owner     | Sprint 3 | data-integrity, needs-migration, needs-regression                   |        0 |    0 |       11 |      2 |   9 |    22 |
| SEC-012 Security-adjacent correctness backlog           | Feature owner           | Sprint 4 | high-bug, needs-regression                                          |        0 |    0 |        2 |      4 |  20 |    26 |

## Severity Override Policy

- Escalate to security-critical when exploitability crosses tenant boundaries, account ownership, service-role writes, cron/job mutations, or secrets.
- Do not downgrade critical/high findings because a proxy or middleware requires a logged-in session; resource-level authorization must be proven in the handler or service boundary.
- Downgrade only when the root-cause owner provides code evidence, a negative regression test, and rollout/config proof when applicable.
- Duplicate findings inherit the highest severity of the root cause until the shared fix and regression matrix pass.
- Bugs that can mutate production data, grant privileges, corrupt availability, or trigger customer communication are treated as high-bug even when not directly exploitable over HTTP.

## Regression-Test Matrix

| Epic    | Required regression coverage                                                                                                                 |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-001 | Auth callback/invite/recovery tests prove tokens are redacted, replay is blocked, and account binding cannot be switched.                    |
| SEC-002 | API negative tests prove same-session cross-tenant IDs are rejected before service-role reads or writes.                                     |
| SEC-003 | Cron route tests prove missing secret returns 401/503 and no job runner is called.                                                           |
| SEC-004 | Script tests or dry-run harnesses prove production targets require explicit env/project confirmation before service-role writes.             |
| SEC-005 | Mutation route tests prove missing/invalid CSRF fails before request body parsing and before writes.                                         |
| SEC-006 | URL schema tests prove disallowed schemes, hosts, encoded redirects, and relative target escapes are rejected.                               |
| SEC-007 | Rendering/export tests prove stored text is encoded and CSV formula payloads are neutralized.                                                |
| SEC-008 | Log snapshot tests prove secrets, query strings, callback params, and tokens are redacted.                                                   |
| SEC-009 | Abuse tests prove unauthenticated or tenant-authenticated callers hit stable rate limits before expensive service-role or external API work. |
| SEC-010 | Concurrency/idempotency tests prove repeat requests and races do not duplicate side effects or lose state.                                   |
| SEC-011 | Migration/contract tests prove schema drift is detected and backfills are idempotent.                                                        |
| SEC-012 | Feature-level regression tests cover the correctness failure and its adjacent edge case.                                                     |

## Backlog Mapping

- Full versioned CSV mapping: docs/security/deepsec-backlog.csv
- Generated CSV copy: test-results/security/deepsec-backlog.csv
- Finding counts: CRITICAL=5, HIGH=128, HIGH_BUG=98, MEDIUM=236, BUG=91
- Every CRITICAL, HIGH, and HIGH_BUG finding is mapped to exactly one sprint and one root-cause epic in the CSV.
