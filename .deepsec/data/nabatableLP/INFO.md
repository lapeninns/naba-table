# nabatableLP

Next.js 16 (App Router) + React 19 + TypeScript + Supabase (Postgres/Auth/Storage,
remote-only) restaurant reservations & capacity platform ("Nab a Table" by
Lapen Inns). pnpm workspaces; sibling packages: `reserve/` (Vite/Storybook),
`server/` (server-only helpers under `@/server/*`), `cloudflare/` (Workers).

## What this codebase does

Two shipped surfaces split by host in `src/proxy.ts`:

- **Ops** on `app.<root>` → `src/app/app/**` and `src/app/api/ops/**`. Restaurant
  staff (owner/manager/host/server) manage bookings, customers, tables, etc.
- **Guest/public** on root host → `src/app/(public)/**`, `src/app/guest/**`,
  guest booking flow under `src/app/api/bookings/**`, marketing/lead capture.

Multi-tenant by `restaurant_id`. Side-effects (emails/SMS/short-links) flow
through Resend, Twilio, and Cloudflare Workers (`cloudflare/email-queue-gateway`,
`sms-summary-gateway`, `booking-short-links`).

## Auth shape

- `requireOpsAuth` (`server/auth/ops-guard.ts`) — middleware-tier guard used
  by `src/proxy.ts` for `/app/**` and `/api/ops/**`. Asserts a Supabase user
  AND at least one row in `restaurant_memberships`. Does NOT check the role
  or that the user has access to the _specific_ restaurant in the URL.
- `requireMembershipForRestaurant` / `requireAdminMembership` /
  `fetchUserMemberships` (`server/team/access.ts`) — per-restaurant +
  role-aware checks; route handlers must call these even after `requireOpsAuth`.
- Roles in `lib/owner/auth/roles.ts`: `owner`, `manager`, `host`, `server`.
  Admin = `owner|manager` (`isRestaurantAdminRole`, `RESTAURANT_ADMIN_ROLES`).
- Supabase client factories in `server/supabase.ts`:
  `getRouteHandlerSupabaseClient` (cookie-bound, RLS), `getMiddlewareSupabaseClient`,
  `getServiceSupabaseClient` (service role — bypasses RLS).
- CSRF: `server/security/csrf.ts` (double-submit cookie + `timingSafeEqual`,
  `CSRF_COOKIE_NAME` / `CSRF_HEADER_NAME`). Turnstile: `server/security/turnstile.ts`.
  Rate limit: `consumeRateLimit` in `server/security/rate-limit.ts`.

## Threat model

Highest impact: cross-tenant data access (one restaurant reading/mutating
another's bookings/customers/team) via missing per-restaurant membership
checks or service-role misuse. Next: unauthenticated booking-flow abuse
(spam, PII scraping via guest endpoints, stored XSS in customer fields
rendered to staff). Then: webhook/cron forgery (Resend, Twilio, internal
cron secret) leading to forged delivery state or job execution. Lowest but
present: production-DB writes from non-prod via misconfigured `APP_ENV` /
service-role keys.

## Project-specific patterns to flag

- **Ops route handler that skips `requireMembershipForRestaurant` /
  `requireAdminMembership`** despite touching a `restaurant_id` from
  request input. `requireOpsAuth` only proves _some_ membership exists.
- **`getServiceSupabaseClient()` used inside a request handler with a
  user-supplied `restaurant_id` / `booking_id`** without first verifying
  membership — bypasses RLS and silently enables cross-tenant access.
- **Cron route accepting requests when `CRON_SECRET` is unset** (see
  `src/app/api/cron/auto-complete-bookings/route.ts` — it `console.warn`s
  and proceeds). New cron routes must hard-fail when the secret is missing.
- **Webhook handler that doesn't verify signature when its secret env is
  missing/empty** (`RESEND_WEBHOOK_SECRET`, Twilio signature). Treat
  missing-secret as 401, never as "skip verification".
- **Direct `process.env.*` reads instead of `@/lib/env`** — bypasses the
  `validate-env` / `ALLOW_PROD_RESOURCES_IN_NONPROD` guards and the
  staging/production resource separation.
- **Mutating non-API form actions or session-cookie POST handlers without
  CSRF verification** via the helpers in `server/security/csrf.ts` /
  `lib/security/csrf.ts`.

## Known false-positives

- `src/app/(public)/**`, `src/app/guest/**`, `src/app/api/auth/**`,
  `src/app/api/lead/route.ts`, `src/app/api/v1/events/route.ts`,
  `src/app/api/health/**`, `src/app/api/client-error/route.ts` — intentionally
  unauthenticated (guest booking, lead capture, analytics ingest, health).
- `src/app/api/webhook/resend/**`, `src/app/api/webhook/twilio/**`,
  `src/app/api/cron/**` — auth is bearer-secret / signature, not session;
  no `requireOpsAuth` expected.
- `cloudflare/**` Workers — separate runtime; secrets bound via `wrangler.jsonc`
  and validated by `tests/cloudflare/**`. Don't expect Next.js auth helpers.
- `scripts/**` (esp. `scripts/db/safe-run.ts`, `scripts/booking-*`,
  `scripts/ops-auto-assign-*`) — operator-run, gated by env guards
  (`ALLOW_PROD_DB_WIPE`, TTY confirmation); service-role usage is intended.
- `reserve/**` — standalone Vite/Storybook package, no Next.js context.
- `/dev/**` and `__dev/**` harnesses — UI fixtures with in-memory mocks per
  root `AGENTS.md`; not user-reachable in production.
