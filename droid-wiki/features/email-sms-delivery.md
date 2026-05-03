# Email and SMS delivery

Active contributors: amanshresthaa

## Purpose

Email and SMS delivery dashboards expose provider delivery state, retries, queue health, and booking notification outcomes.

## Directory layout

```text
src/app/app/(app)/email-delivery/page.tsx
src/app/app/(app)/sms-delivery/page.tsx
server/emails/
server/sms/
```

## Key abstractions

| Symbol or file                        | Description      |
| ------------------------------------- | ---------------- |
| `OpsEmailDeliveryClient`              | Email dashboard. |
| `server/emails/email-delivery-log.ts` | Email log.       |
| `server/sms/delivery-log.ts`          | SMS log.         |

## How it works

The files above form the main boundary for this topic. Route/page files collect inputs, domain modules enforce business rules, and shared helpers in `lib/**` or `server/**` keep cross-cutting behavior out of components.

## Integration points

This topic links to [Communications](../systems/communications.md), [Delivery health](../how-to-monitor/delivery-health.md). It also uses shared configuration from `lib/env.ts` and project validation rules from `docs/sdlc/verification.md` when changes affect runtime behavior.

## Entry points for modification

Start with the first source file in the table below, then follow imports to the route, hook, or domain file closest to the behavior being changed.

## Key source files

| File                                                                | Purpose    |
| ------------------------------------------------------------------- | ---------- |
| `src/components/features/email-delivery/OpsEmailDeliveryClient.tsx` | Email UI.  |
| `server/emails/email-delivery-log.ts`                               | Email log. |
| `server/sms/delivery-log.ts`                                        | SMS log.   |
| `src/app/api/ops/email-delivery/retry/route.ts`                     | Retry API. |

Related: [Communications](../systems/communications.md), [Delivery health](../how-to-monitor/delivery-health.md)
