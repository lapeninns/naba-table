# Delivery health

Delivery health is tracked through email/SMS delivery logs, provider webhooks, queue APIs, Cloudflare gateways, and ops dashboards.

## Key files

| File                                             | Purpose                  |
| ------------------------------------------------ | ------------------------ |
| `src/app/app/(app)/email-delivery/page.tsx`      | Email delivery page.     |
| `src/app/app/(app)/sms-delivery/page.tsx`        | SMS delivery page.       |
| `src/app/api/ops/email-delivery/**`              | Ops email delivery APIs. |
| `src/app/api/ops/email-queue/route.ts`           | Email queue API.         |
| `src/app/api/webhook/resend/route.ts`            | Resend callback.         |
| `src/app/api/webhook/twilio/sms-status/route.ts` | Twilio status callback.  |
| `cloudflare/email-queue-gateway/src/index.mjs`   | Email queue gateway.     |
| `cloudflare/sms-summary-gateway/src/job.ts`      | SMS summary gateway job. |

Related: [Communications](../systems/communications.md), [Email and SMS delivery](../features/email-sms-delivery.md).
