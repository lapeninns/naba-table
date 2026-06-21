---
name: qa-cloudflare-workers
description: >
  QA tests for Nabatable Cloudflare workers, using HTTP smoke checks for public
  worker surfaces and configuration-aware blocking for non-public worker flows.
---

# QA Cloudflare Workers

## Testing Target

Use configured worker URLs only when they are explicitly available.

Expected URL/token inputs:

- `CLOUDFLARE_EMAIL_QUEUE_GATEWAY_URL`
- `CLOUDFLARE_EMAIL_QUEUE_GATEWAY_TOKEN`
- `BOOKING_SHORT_LINKS_BASE_URL`
- `BOOKING_SHORT_LINKS_INTERNAL_URL`
- `BOOKING_SHORT_LINKS_INTERNAL_TOKEN`

If a worker has no reachable URL or safe trigger in the current environment, report the relevant flow as `BLOCKED`.

## Authentication in CI / Automation

- Email queue gateway requests may require `CLOUDFLARE_EMAIL_QUEUE_GATEWAY_TOKEN`
- Internal booking-short-link checks may require `BOOKING_SHORT_LINKS_INTERNAL_TOKEN`
- SMS summary worker currently has queue/cron semantics and may not expose a safe public QA endpoint

## App-Specific Notes

- `cloudflare/email-queue-gateway/**` is a worker with durable objects.
- `cloudflare/booking-short-links/**` serves public short-link redirects and internal link-resolution behavior.
- `cloudflare/sms-summary-gateway/**` is queue/cron driven and may need a dedicated trigger before QA can exercise it safely.

## Flow Menu

Choose only flows relevant to the diff.

### 1. Email queue gateway

- health/smoke request path if documented by the environment
- auth/token rejection path
- negative check: missing token or missing configured gateway URL

### 2. Booking short links

- public redirect resolution from short link to allowed booking destination
- internal resolution flow when internal URL/token are available
- negative check: invalid token, invalid slug, or disallowed destination host

### 3. SMS summary gateway

- verify deployability assumptions or safe trigger availability
- if no safe trigger exists, report `BLOCKED` with the missing prerequisite

## Persona Variations

- Most worker checks are service-level rather than persona-level.
- When a worker affects guest links or notifications, note which user flow it supports in the report.

## Error Handling

- Use trimmed request/response evidence with status codes.
- Do not fabricate worker endpoints.
- If only deployment scripts exist and no safe QA endpoint is exposed, report `BLOCKED`.

## Known Failure Modes

1. **Worker URLs may be absent locally.** Without configured worker URLs/tokens, HTTP verification is not possible.
2. **Booking short links enforce allowed destination hosts.** Redirect targets outside the configured host list should be treated as expected failures.
3. **SMS summary gateway is not a simple public HTTP surface.** Queue/cron-only behavior may require an explicit smoke hook before QA can exercise it.
