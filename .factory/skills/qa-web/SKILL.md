---
name: qa-web
description: >
  QA tests for the main Nabatable web app, covering guest/public flows and the
  ops application through real browser interaction.
---

# QA Web

## Testing Target

This repo does not have a checked-in preview-deployment workflow to resolve branch-specific web URLs automatically.

Use the local branch code by starting the Next.js dev server:

1. Start `pnpm dev`
2. Poll `http://localhost:3000` until ready
3. Use:
   - guest/public root-host routes at `http://localhost:3000`
   - ops routes at `http://app.localhost:3000` when local subdomain routing is available
   - single-host fallback routes under `http://localhost:3000/app/**` when needed

If the local server cannot be started or the target URL is unavailable, report all affected web checks as `BLOCKED`.

**Never fall back to a remote dev/staging/prod deployment when verifying a branch diff.**

## Authentication in CI / Automation

Required baseline env vars for meaningful auth flows:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_APP_URL`

Flow-specific extras:

- Guest magic-link / CAPTCHA: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_EXPECTED_HOSTNAME`
- Email assertions: `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_WEBHOOK_SECRET`
- SMS assertions: `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`
- Google Business Profile: `GOOGLE_BUSINESS_PROFILE_CLIENT_ID`, `GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET`, `GOOGLE_BUSINESS_PROFILE_REDIRECT_URI`, `GOOGLE_BUSINESS_PROFILE_TOKEN_ENCRYPTION_KEY`

Personas are currently configured as manual placeholders:

- guest: `<provide-guest-test-email>`
- ops owner: `<provide-ops-owner-test-email>`

Do not invent credentials. If the needed persona or secret is unavailable, report `BLOCKED`.

## App-Specific Notes

- Guest sign-in on the root host is magic-link-first and redirects to `/guest/dashboard` by default.
- Ops sign-in lives on the app host and requires a valid `restaurant_memberships` record.
- Host split matters: guest/public routes belong on the root host; ops routes belong on the app host or `/app/**` single-host transport.
- `/dev/**` and other harness routes are supplemental only; use real shipped routes first.
- Google Business Profile flows require both environment credentials and a linked restaurant/account context.

## Flow Menu

Choose only the flows relevant to the diff.

### 1. Guest auth and redirect handling

- `/auth/signin`
- magic-link request flow
- redirected return path handling
- negative check: guest must not land on ops-only destinations without the correct host/auth context

### 2. Public restaurant discovery and booking

- `/restaurants`
- `/restaurants/[slug]`
- `/restaurants/[slug]/book`
- booking success/thank-you state
- negative check: validation or unavailable-slot state

### 3. Guest dashboard, bookings, and profile

- `/guest/dashboard`
- `/guest/bookings`
- `/guest/bookings/[bookingId]`
- `/guest/profile`
- negative check: unauthenticated redirect or protected-state guard

### 4. Ops auth and navigation shell

- app-host `/auth/signin`
- `/app/dashboard` or app-host `/dashboard`
- sidebar/navigation access for bookings, customers, email/SMS delivery, settings
- negative check: unauthenticated access redirects correctly

### 5. Ops dashboard, bookings, and customers

- dashboard summary/change views
- bookings list/detail/edit flows
- customers list/detail flows
- negative check: hidden/blocked state without proper membership

### 6. Onboarding

- `/onboarding`
- profile, hours, services, tables, review progression
- negative check: cannot skip required earlier steps without valid state

### 7. Restaurant settings

- profile
- availability / operating hours / service periods / occasions
- tables
- team
- menu and email templates when relevant
- negative check: save validation and required fields

### 8. Email and SMS delivery

- ops email delivery
- ops SMS delivery
- retry/send-test actions only in safe non-production targets
- negative check: delivery or retry error messaging

### 9. Google Business Profile

- connect state
- location linking
- compare/review workflow
- publish confirmation gating
- negative check: missing credentials, missing link, or password confirmation

### 10. Host-split and permission boundaries

- guest routes should not stay on app host
- ops routes should not resolve for unauthenticated guest users
- a guest persona must not be able to edit ops settings

## Persona Variations

- **guest**: prioritize public booking, guest sign-in, booking management, profile, and guest-only redirects.
- **ops owner**: prioritize dashboard, bookings, customers, restaurant settings, delivery tools, team, and GBP flows.
- **new_user**: prioritize onboarding, empty states, and first-run navigation.

## Error Handling

- If auth cannot complete because secrets/accounts are missing, mark the affected flow `BLOCKED`.
- If Turnstile or mail delivery prevents guest auth, note whether the block is configuration-related or product-related.
- If a route only works on the correct host context, verify the host behavior rather than forcing the wrong hostname.

## Known Failure Modes

1. **Local app-host routing may require explicit `app.localhost` support.** If the app subdomain is unavailable locally, use `/app/**` transport and note the limitation.
2. **Guest magic-link sign-in may be blocked by Turnstile configuration.** Missing or mismatched Turnstile keys/hostnames can block the flow before mail delivery.
3. **Ops access depends on restaurant membership.** A valid Supabase user without membership is expected to fail ops authorization.
4. **Dev harnesses are not shipped routes.** `/dev/**` can help reproduce state but cannot replace real-route proof.
5. **Google Business Profile flows require both env creds and linked data.** Missing credentials or an unlinked restaurant should be reported as `BLOCKED`, not `FAIL`.
6. **Notification flows may need manual inbox/phone verification.** Resend/Twilio assertions are limited unless a dedicated sink is provided.
