---
name: qa-backend
description: >
  QA tests for Nabatable backend and API behavior through HTTP requests against
  the Next.js server and related integrations.
---

# QA Backend

## Testing Target

Use the local branch code through the Next.js server:

1. Start `pnpm dev`
2. Poll `http://localhost:3000` until ready
3. Use HTTP requests against:
   - root-host APIs: `http://localhost:3000/api/**`
   - ops APIs: `http://localhost:3000/api/ops/**` or app-host equivalents when host behavior matters

If the local server cannot start, report backend checks as `BLOCKED`.

## Authentication in CI / Automation

Common required env vars:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Flow-specific env vars:

- Auth / magic-link / CAPTCHA: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_EXPECTED_HOSTNAME`, `AUTH_AUDIT_HASH_SECRET`
- Email: `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_WEBHOOK_SECRET`
- SMS: `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`
- GBP: `GOOGLE_BUSINESS_PROFILE_CLIENT_ID`, `GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET`, `GOOGLE_BUSINESS_PROFILE_REDIRECT_URI`, `GOOGLE_BUSINESS_PROFILE_TOKEN_ENCRYPTION_KEY`
- Crons / protected jobs: `CRON_SECRET`

If authenticated endpoints require cookies or bearer/session context that is unavailable, report `BLOCKED`.

## App-Specific Notes

- Root and app-host routing rules are enforced by `src/proxy.ts`.
- Ops APIs require authenticated membership context through `requireOpsAuth`.
- Some APIs are intentionally public, such as certain auth, booking, and Google Business Profile callback paths.
- Cloudflare workers are tested separately in `qa-cloudflare-workers`.

## Flow Menu

Choose only flows relevant to the diff.

### 1. Auth endpoints

- `/api/auth/signin`
- `/api/auth/signup`
- `/api/auth/signout`
- `/api/auth/callback`
- negative checks: throttling, invalid credentials, expired/invalid magic-link handling

### 2. Public booking APIs

- `/api/restaurants`
- `/api/restaurants/[slug]`
- `/api/restaurants/[slug]/schedule`
- `/api/restaurants/[slug]/calendar-mask`
- `/api/bookings`
- `/api/bookings/[id]`
- negative checks: invalid payloads, unavailable slot validation, guest lookup protections

### 3. Guest profile and booking-management APIs

- `/api/profile`
- `/api/bookings/[id]/history`
- `/api/reservations/[id]/confirmation`
- negative checks: unauthenticated or unauthorized access

### 4. Ops APIs

- `/api/ops/dashboard/**`
- `/api/ops/bookings/**`
- `/api/ops/customers/**`
- `/api/ops/restaurants/**`
- `/api/ops/team/**`
- negative checks: membership/auth blocks and validation errors

### 5. Onboarding APIs

- `/api/onboarding/restaurant`
- `/api/onboarding/restaurant/[id]/hours`
- `/api/onboarding/restaurant/[id]/service-periods`
- `/api/onboarding/restaurant/[id]/zones`
- `/api/onboarding/restaurant/[id]/tables`
- `/api/onboarding/restaurant/[id]/complete`

### 6. Delivery and webhook flows

- `/api/ops/email-delivery`
- `/api/ops/sms-delivery`
- `/api/webhook/resend`
- `/api/webhook/twilio/sms-status`
- negative checks: missing signatures, missing secrets, unsupported retries

### 7. Google Business Profile APIs

- connect/link endpoints
- workflow/drafts/publish endpoints
- callback handling
- negative checks: missing creds, missing link, password-confirmation failure

### 8. Cron and service-policy endpoints

- `/api/cron/process-emails`
- `/api/cron/auto-complete-bookings`
- `/api/config/**`
- only run in safe non-production targets with required secrets present

## Persona Variations

- **guest**: use public and guest-scoped APIs only; confirm they cannot use ops APIs.
- **ops owner**: validate ops endpoints, settings mutations, and management flows.
- **new_user**: focus on signup and onboarding endpoints.

## Error Handling

- Prefer direct status-code and response-body assertions.
- If an endpoint depends on unavailable secrets, external services, or auth context, mark it `BLOCKED`.
- Do not brute-force protected endpoints with fake auth; note the missing prerequisite clearly.

## Known Failure Modes

1. **Ops APIs require valid membership context.** A valid session without `restaurant_memberships` is expected to fail.
2. **Guest auth flows may depend on Turnstile.** Missing CAPTCHA config can block magic-link requests before email generation.
3. **Webhook routes need signatures/secrets.** Missing `RESEND_WEBHOOK_SECRET` or `TWILIO_AUTH_TOKEN` should produce configuration blocks, not product failures.
4. **GBP routes are credential-gated.** Missing Google credentials or unlinked restaurants should be reported as `BLOCKED`.
5. **Cron endpoints may require `CRON_SECRET`.** If absent, do not treat the run as a product regression.
