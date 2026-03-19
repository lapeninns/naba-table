---
task: magic-link-incident-audit
timestamp_utc: 2026-02-19T14:34:32Z
owner: github:@amankumarshrestha
reviewers: [github:@amankumarshrestha]
risk: medium
flags: []
related_tickets: []
---

# Research: Production Magic-Link Request Spike Triage

## Requirements

- Functional:
  - Determine whether recent production magic-link activity indicates a cyber attack or ordinary/low-risk traffic.
  - Correlate magic-link recipients with customer/booking context to validate the "no bookings but requesting magic link" signal.
  - Identify concrete root-cause signals from request logs and email-delivery traces.
- Non-functional:
  - Keep investigation read-only and production-safe.
  - Avoid exposing secrets in outputs.
  - Produce evidence artifacts that can be re-run during future incidents.

## Existing Patterns & Reuse

- Canonical sign-in route is `POST /api/auth/signin` in `src/app/api/auth/signin/route.ts`.
- Magic-link transport is centralized in `server/auth/magic-link-email.ts` and uses `supabase.auth.admin.generateLink({ type: 'magiclink' })` + Resend send.
- Existing memory from 2026-02-17 indicates this email subject is user-triggered from route handlers (not cron/background).
- Operational log source available via `vercel logsv2` and Resend list API.

## External Resources

- Vercel `logsv2` CLI output for `POST /api/auth/signin` in production.
- Resend `emails.list` data for subject `Your Nab a Table magic sign-in link`.

## Constraints & Risks

- `SUPABASE_DB_URL` credentials in `.env.vercel-production` are not directly usable for DB login in this environment (auth failure), so auth-user correlation must avoid direct SQL auth schema reads.
- `supabase.auth.admin.listUsers` paging can fail mid-pagination (`Database error finding users`), making full auth-user presence checks partial.
- Vercel log retention window can be shorter than requested lookback.

## Open Questions (owner, due)

- Q: Do we want to immediately harden `/api/auth/signin` to avoid status-based account enumeration (`202` vs `500`) for unknown emails?
  - Owner: engineering
  - Due: immediate (incident hardening)
- Q: Should we add CAPTCHA/bot challenge on public sign-in to reduce scripted email spraying?
  - Owner: product + engineering
  - Due: short term

## Recommended Direction (with rationale)

- Treat this as low-volume but suspicious email spraying/enumeration behavior, not high-volume infra attack.
- Prioritize auth-flow hardening:
  - normalize client-facing response for unknown-user magic-link attempts,
  - strengthen anti-automation controls (IP/global limits + CAPTCHA),
  - add durable request fingerprint audit logging (hashed email/IP/UA + outcome).
