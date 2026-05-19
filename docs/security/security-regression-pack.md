# Security Regression Pack

Last updated: 2026-05-05.

Run locally with:

```bash
pnpm run security:regression
```

Sprint QA entrypoint:

```bash
pnpm run qa:security-regression
```

The QA entrypoint runs the regression pack and then `pnpm run security:guard:service-role` so
new service-role route handlers remain blocked unless they have a detected route-level guard or a
reviewed baseline exception.

CI runs the pack from `.github/workflows/security-guards.yml` on pull requests touching route handlers, auth/security helpers, server helpers, migrations, schemas, security scripts, or the security docs.

## Pack Coverage

| Sprint 10 pack                         | Regression files                                                                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Account takeover and invite tests      | `tests/server/team-invitations-security.test.ts`, `tests/server/auth/signin-route-magic-link-policy.test.ts`                                     |
| Auth callback host poisoning tests     | `tests/server/auth/callback-route-security.test.ts`                                                                                              |
| Service-role-before-auth tests         | `tests/server/tenant-authorization-sprint2.test.ts`, `tests/server/email-processing-security.test.ts`, `pnpm run security:guard:service-role`    |
| Cross-tenant negative tests            | `tests/server/tenant-authorization-sprint2.test.ts`, `tests/server/email-processing-security.test.ts`                                            |
| CSRF negative tests                    | `tests/server/csrf-protected-mutations.test.ts`                                                                                                  |
| XSS serialization and URL scheme tests | `tests/lib/security/script-json.test.ts`, `tests/lib/security/safe-url.test.ts`, `tests/server/restaurant-security-schema.test.ts`               |
| Cron auth tests                        | `tests/server/cron-routes-auth.test.ts`                                                                                                          |
| Recovery token flow tests              | `tests/server/security/session-recovery-access-token.test.ts`                                                                                    |
| CSV formula tests                      | `tests/lib/csv-export.test.ts`                                                                                                                   |
| Parameter pollution tests              | `tests/lib/query-params.test.ts`                                                                                                                 |
| Rate-limit tests                       | `tests/server/auth/signin-throttle.test.ts`, `tests/server/auth/signin-route-magic-link-policy.test.ts`, `tests/server/cron-routes-auth.test.ts` |
| Dual-sync side-effect ordering tests   | `tests/server/dual-sync-publish-orchestrator.test.ts`                                                                                            |
| Security event redaction tests         | `tests/server/security-events.test.ts`                                                                                                           |

## Evidence Rules

- A pack row is reproducible only when the named test file is committed and included in `security:regression`.
- Historical "failing before fix" evidence belongs in the remediation PR or task harness for the root-cause epic.
- Do not mark a scanner finding closed from this pack alone. Closure requires scanner rerun evidence or an explicit signed risk acceptance.
