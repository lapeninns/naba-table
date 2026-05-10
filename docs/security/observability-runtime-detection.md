# Security Observability And Runtime Detection

Last updated: 2026-05-05.

Security events are stored through `server/observability.ts` in `observability_events`. The security wrapper in `server/security/events.ts` prefixes event types with `security.` and redacts context keys that look like tokens, secrets, cookies, authorization headers, passwords, session values, or raw keys before writing.

## Event Contract

| Runtime condition          | Event type                            | Source                                                          | Severity                | Current emitter                                                 |
| -------------------------- | ------------------------------------- | --------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------- |
| Denied cross-tenant access | `security.cross_tenant_access_denied` | Route or guard denying access                                   | `warning` or `critical` | Contract defined; route integration pending per denied boundary |
| CSRF failure               | `security.csrf_failure`               | `server.security.csrf`                                          | `warning`               | `server/security/csrf.ts`                                       |
| Cron auth failure          | `security.cron_auth_failure`          | `server.security.cron-auth`                                     | `warning` or `error`    | `server/security/cron-auth.ts`                                  |
| Unsafe URL rejected        | `security.unsafe_url_rejected`        | URL write boundary                                              | `warning`               | Contract defined; write-boundary integration pending            |
| Invite acceptance rejected | `security.invite_acceptance_rejected` | Invite accept route/service                                     | `warning`               | Contract defined; invite integration pending                    |
| Rate limit exceeded        | `security.rate_limit_exceeded`        | `server.security.api-rate-limit` or `server.security.cron-auth` | `warning`               | API and cron rate-limit helpers                                 |
| Token/redaction detection  | `security.token_redaction_detected`   | Log or artifact scanner                                         | `error`                 | Contract defined; detector integration pending                  |

## Dashboard Queries

Use redacted aggregate queries only. Do not include raw request URLs, headers, tokens, invite links, or customer contact fields in dashboard dimensions.

| Dashboard panel                 | Source query shape                                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 401/403 by route                | Route logs or access logs grouped by sanitized path template and status                                            |
| Cron invocations                | `observability_events` grouped by `source`, `event_type`, and minute/hour bucket                                   |
| Provider API calls              | Provider integration events grouped by provider, operation, restaurant id, and status                              |
| Route error rates               | Route logs grouped by sanitized path template, status class, and deployment                                        |
| Email preview rejected payloads | `security.unsafe_url_rejected`, schema validation failures, and preview rejection counters grouped by template key |

## Alert Rules

| Alert                            | Trigger                                                                                  | Owner              |
| -------------------------------- | ---------------------------------------------------------------------------------------- | ------------------ |
| Cron called without valid auth   | Any `security.cron_auth_failure` where reason is `missing_secret` or `unauthorized`      | Jobs/infra owner   |
| Spike in 403 cross-tenant probes | `security.cross_tenant_access_denied` count exceeds baseline for one route or restaurant | Platform/API owner |
| Service-role route errors        | 5xx on service-role-backed routes after auth success                                     | Platform/API owner |
| Unsafe public URL cleanup count  | `security.unsafe_url_rejected` exceeds baseline at write boundaries                      | Web/API owner      |
| Rate-limit exceeded spike        | `security.rate_limit_exceeded` exceeds route or scope baseline                           | Platform/API owner |

## Closure Notes

- Owner routing is defined above, but external alert delivery was not provisioned in this repo change.
- Before/after risk reduction must be taken from a scanner rerun or production monitoring window, not inferred from local tests.
