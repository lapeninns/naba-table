# Security

Security-sensitive boundaries include `src/proxy.ts`, `server/supabase.ts`, `server/auth/**`, `server/team/access.ts`, `lib/security/csrf.ts`, `server/security/**`, provider webhooks, and `server/google-business-profile/crypto.ts`. Auth, proxy, tenant, Supabase, and secret-handling changes should follow the high-risk expectations in `docs/sdlc/risk-tier-workflow.md`.

Related: [Supabase and auth](systems/supabase-auth.md), [Host routing](systems/host-routing.md).
