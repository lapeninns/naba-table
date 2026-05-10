# Security Closure Matrix

Last updated: 2026-05-05.

Status values:

- `verified`: local regression and scanner/deploy evidence are attached.
- `regression-covered`: local regression exists, but scanner/deploy evidence is still pending.
- `pending`: remediation or evidence is incomplete.
- `accepted-risk`: signed risk acceptance exists outside this file.

| Finding title                                                               | Root-cause epic | PR      | Test                                                                                                                                             | Migration                                                                     | Deploy date | Validation result  |
| --------------------------------------------------------------------------- | --------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ----------- | ------------------ |
| Team invite creation leaks bearer invite tokens enabling account takeover   | SEC-001         | Pending | `tests/server/team-invitations-security.test.ts`                                                                                                 | `supabase/migrations/20260505134500_accept_restaurant_invite_atomically.sql`  | Pending     | regression-covered |
| Invitation acceptance can reset or take over an existing user's account     | SEC-001         | Pending | `tests/server/team-invitations-security.test.ts`                                                                                                 | `supabase/migrations/20260505134500_accept_restaurant_invite_atomically.sql`  | Pending     | regression-covered |
| Auth callback host/header poisoning can redirect tokens to attacker origins | SEC-001         | Pending | `tests/server/auth/callback-route-security.test.ts`, `tests/server/auth/signin-route-magic-link-policy.test.ts`                                  | Not applicable                                                                | Pending     | regression-covered |
| Service-role route is reachable before tenant authorization                 | SEC-002         | Pending | `tests/server/tenant-authorization-sprint2.test.ts`, `tests/server/email-processing-security.test.ts`, `pnpm run security:guard:service-role`    | `supabase/migrations/20260505141000_restrict_capacity_settings_mutations.sql` | Pending     | regression-covered |
| Missing CSRF on session-cookie mutations                                    | SEC-005         | Pending | `tests/server/csrf-protected-mutations.test.ts`                                                                                                  | Not applicable                                                                | Pending     | regression-covered |
| Unsafe URL scheme or host accepted at write boundary                        | SEC-006         | Pending | `tests/lib/security/safe-url.test.ts`, `tests/server/restaurant-security-schema.test.ts`                                                         | Not applicable                                                                | Pending     | regression-covered |
| XSS serialization escapes can break out of script contexts                  | SEC-007         | Pending | `tests/lib/security/script-json.test.ts`, `tests/server/restaurant-security-schema.test.ts`                                                      | Not applicable                                                                | Pending     | regression-covered |
| Cron route can run without valid auth                                       | SEC-003         | Pending | `tests/server/cron-routes-auth.test.ts`, `pnpm run security:guard:service-role`                                                                  | Not applicable                                                                | Pending     | regression-covered |
| Recovery token flow permits contact mismatch                                | SEC-001         | Pending | `tests/server/security/session-recovery-access-token.test.ts`                                                                                    | Not applicable                                                                | Pending     | regression-covered |
| CSV export permits formula execution                                        | SEC-007         | Pending | `tests/lib/csv-export.test.ts`                                                                                                                   | Not applicable                                                                | Pending     | regression-covered |
| Duplicate query parameters cause auth or tenant parameter pollution         | SEC-009         | Pending | `tests/lib/query-params.test.ts`                                                                                                                 | Not applicable                                                                | Pending     | regression-covered |
| Rate limits are bypassed before expensive auth/provider work                | SEC-009         | Pending | `tests/server/auth/signin-throttle.test.ts`, `tests/server/auth/signin-route-magic-link-policy.test.ts`, `tests/server/cron-routes-auth.test.ts` | Not applicable                                                                | Pending     | regression-covered |
| Dual-sync publish side effects run after stale local/provider state         | SEC-010         | Pending | `tests/server/dual-sync-publish-orchestrator.test.ts`                                                                                            | Not applicable                                                                | Pending     | regression-covered |
| Security events leak tokens or raw credentials in context                   | SEC-008         | Pending | `tests/server/security-events.test.ts`                                                                                                           | Not applicable                                                                | Pending     | regression-covered |

## Scanner Closure Gate

The scanner was not rerun by this document update. To close the scan:

1. Run the scanner with the same profile that produced `docs/security/deepsec-backlog.csv`.
2. Attach the scanner output to the remediation task or PR.
3. Compare counts:
   - Critical must be `0`.
   - High account takeover must be `0`.
   - Cross-tenant high must be `0`, unless an `accepted-risk` row links to a signed compensating control.
   - XSS high must be `0` for known sinks.
   - Missing-auth cron high must be `0`.
4. Keep this matrix in `regression-covered` until PR, deploy date, and scanner validation are filled from real evidence.
