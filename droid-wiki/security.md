# Security

Security-sensitive boundaries include `src/proxy.ts`, `server/supabase.ts`, `server/auth/**`, `server/team/access.ts`, `lib/security/csrf.ts`, `server/security/**`, provider webhooks, service-role usage, cron routes, and `server/google-business-profile/crypto.ts`.

## Current guardrails

- Secrets never belong in source, logs, or task artifacts.
- Supabase is remote-only and staging-first.
- Public `NEXT_PUBLIC_*` environment variables are blocked from secret-looking names unless explicitly allowlisted in `config/env.schema.ts`.
- Direct ops APIs are guarded by `src/proxy.ts` and `server/auth/ops-guard.ts`; inbound trusted headers are stripped before being re-created from validated sessions.
- Service-role and RPC hardening is covered by `scripts/security/check-service-role-routes.mjs`, `pnpm run security:regression`, and recent migrations such as `20260527111100_harden_service_only_rpc_privileges.sql`.
- Auth, proxy, tenant, Supabase, and secret-handling changes are high-risk under `docs/sdlc/risk-tier-workflow.md`.

Related: [Supabase and auth](systems/supabase-auth.md), [Host routing](systems/host-routing.md).
