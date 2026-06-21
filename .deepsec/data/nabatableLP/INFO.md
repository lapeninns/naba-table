# nabatableLP

> Project-specific context for deepsec. Keep findings focused on Nabatable's
> auth, tenant, route, and provider-callback shapes.

## What this codebase does

Nabatable is a restaurant reservations and capacity-management app for Lapen Inns,
built on Next.js App Router, React, TypeScript, Supabase Auth/Postgres/Storage, and
pnpm. It has two shipped surfaces: ops/admin on the app host under
`src/app/app/**`, and guest/public booking flows on the root host under
`src/app/(public)/**` and `src/app/guest/**`. API handlers live mainly in
`src/app/api/**`; server-side domain logic and Supabase helpers live in `server/**`.
The app is remote-Supabase only, so service-role use is common but must be paired
with explicit authorization and tenant predicates.

## Auth shape

- `src/proxy.ts` enforces the host split and guards app-host pages,
  `/api/ops/**`, and app-host ops API rewrites with `requireOpsAuth`.
- The proxy strips client-supplied `x-ops-user-id` and re-adds it only after
  Supabase session validation; safe-method route fast paths read it via
  `getOpsUserIdFromHeader`.
- Route handlers should use `withOpsMutation`, `withRestaurantAuthorization`,
  `withBookingAuthorization`, `withPlatformAdminAuthorization`, or `requireSession`
  rather than open-coding session checks.
- Tenant checks are membership based: `requireMembershipForRestaurant`,
  `requireAdminMembership`, and `fetchUserMemberships` validate roles in
  `restaurant_memberships`.
- Unsafe cookie-authenticated mutations need `validateCsrfProtectedMutation` or
  `withCsrfProtectedMutation`; cron jobs use `requireCronAuthAndRun`; provider
  callbacks use Twilio, Resend/Svix, or Google OAuth state verification.

## Threat model

Highest impact is cross-tenant restaurant access: reading or mutating bookings,
customers, capacity, Google Business Profile state, or settings for a restaurant
the signed-in user does not belong to. Public guest endpoints intentionally accept
unauthenticated booking creation, contact lookup, and one-time confirmation tokens,
so brute force, PII leakage, replay, and over-broad DTOs matter more than generic
"public route" alarms. Provider callbacks and cron routes are externally reachable;
their safety depends on shared verifier primitives and fail-closed missing-secret
behavior.

## Project-specific patterns to flag

- Service-role helpers (`getServiceSupabaseClient`, `getTenantServiceSupabaseClient`)
  used without a preceding membership/platform guard and explicit `restaurant_id`
  or booking-derived tenant predicate.
- `/api/ops/**` handlers that bypass proxy assumptions, trust a raw
  `x-ops-user-id`, or add to `PUBLIC_OPS_API_PATHS` without an OAuth/webhook-style
  verifier.
- Session-cookie POST/PUT/PATCH/DELETE handlers missing `withCsrfProtectedMutation`
  or `withOpsMutation({ csrf: true })`, especially under profile, team, settings,
  and restaurant mutation routes.
- Public booking APIs (`/api/bookings`, `/api/bookings/confirm`,
  `/api/restaurants/[slug]/schedule`) returning full DB rows, unmasked contact data,
  or token/contact lookups without rate limits.
- Cron/webhook handlers that perform work without `requireCronAuthAndRun`,
  `validateTwilioWebhookSignature`, Resend `webhooks.verify`, Google OAuth state
  cookies/records, body-size limits, or content-type checks.

## Known false-positives

- `getServiceSupabaseClient` is expected in server-only routes because Supabase RLS
  is bypassed deliberately; the bug is missing guard/predicate, not the helper call.
- `getTenantServiceSupabaseClient` adds tenant context headers for logging/RPCs but
  is not an isolation boundary; still require membership and restaurant filters.
- `/api/ops/google-business-profile/callback` and
  `/api/ops/restaurants/[id]/google-business/callback` are intentionally public at
  the proxy so Google can redirect back; state cookie, DB state record, and session
  validation are the relevant guards.
- `/dev/**`, app-host `/app/dev/**`, and `__dev/**` harnesses are QA-only fixture
  surfaces. They do not represent shipped guest or ops behavior.
- The `restaurant-branding` public storage bucket is intentional for restaurant
  logos; scrutinize upload gates, MIME/size checks, SVG handling, and tenant
  membership rather than treating public read access alone as the issue.
