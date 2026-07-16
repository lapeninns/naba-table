# Delivery health

Delivery health is tracked through email/SMS/WhatsApp delivery logs, provider webhooks, queue APIs, Cloudflare gateways, and ops dashboards.

## Ops dashboards

| Dashboard               | Route                                                                                          | What to check                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Communications Overview | `/app/communications-delivery`                                                                 | Combined email/message summary cards and channel entry points         |
| Email Delivery          | `/app/communications-delivery/email` (alias `/app/email-delivery`)                             | Attempt log, stuck-in-flight summary, queue cancel/requeue, analytics |
| Message Delivery        | `/app/communications-delivery/messages` (aliases `/app/sms-delivery`, `/app/message-delivery`) | SMS + WhatsApp attempts, channel filter, fallback badges, stuck alert |

## Key files

| File                                                          | Purpose                                                          |
| ------------------------------------------------------------- | ---------------------------------------------------------------- |
| `src/app/app/(app)/communications-delivery/page.tsx`          | Unified Communications Delivery overview.                        |
| `src/app/app/(app)/communications-delivery/email/page.tsx`    | Email Delivery page.                                             |
| `src/app/app/(app)/communications-delivery/messages/page.tsx` | Message Delivery page (SMS + WhatsApp).                          |
| `src/app/app/(app)/email-delivery/page.tsx`                   | Compatibility alias for Email Delivery.                          |
| `src/app/app/(app)/sms-delivery/page.tsx`                     | Compatibility alias for Message Delivery.                        |
| `src/app/app/(app)/message-delivery/page.tsx`                 | Compatibility alias for Message Delivery.                        |
| `src/app/api/ops/email-delivery/**`                           | Ops email delivery APIs.                                         |
| `src/app/api/ops/email-queue/route.ts`                        | Email queue read API.                                            |
| `src/app/api/ops/email-queue/[jobId]/cancel/route.ts`         | Cancel scheduled email job.                                      |
| `src/app/api/ops/email-queue/[jobId]/requeue/route.ts`        | Requeue failed email job.                                        |
| `src/app/api/ops/sms-delivery/route.ts`                       | Message Delivery feed API.                                       |
| `src/app/api/ops/message-delivery/route.ts`                   | Naming alias for Message Delivery feed API.                      |
| `src/app/api/webhook/resend/route.ts`                         | Resend callback.                                                 |
| `src/app/api/webhook/twilio/sms-status/route.ts`              | Twilio SMS status callback.                                      |
| `src/app/api/webhook/twilio/whatsapp-status/route.ts`         | Twilio WhatsApp status callback.                                 |
| `server/observability/delivery-reconciler.ts`                 | Stuck in-flight email/SMS scan (no raw recipient email in logs). |
| `cloudflare/email-queue-gateway/src/index.mjs`                | Email queue gateway.                                             |
| `cloudflare/sms-summary-gateway/src/job.ts`                   | Manager SMS/WhatsApp summary gateway job.                        |

## Monitoring notes

- Email stuck metrics come from `ops_email_delivery_attempts_summary.stuckInFlight` (12h in-flight threshold).
- WhatsApp lifecycle failures auto-fall back to SMS; Message Delivery shows channel badges including fallbacks.
- Manual ops retry exists for email (`failed` / `bounced`) only — not for WhatsApp/SMS.

Related: [Communications](../systems/communications.md), [Email and message delivery](../features/email-sms-delivery.md).
