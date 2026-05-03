# Webhooks and cron

Active contributors: amanshresthaa

## Purpose

Webhooks and cron routes receive provider callbacks and scheduled job invocations for delivery, booking completion, and dual-sync export.

## Directory layout

```text
src/app/api/webhook/
src/app/api/cron/
vercel.json
```

## Key abstractions

| Symbol or file                                   | Description      |
| ------------------------------------------------ | ---------------- |
| `src/app/api/webhook/resend/route.ts`            | Resend callback. |
| `src/app/api/webhook/twilio/sms-status/route.ts` | Twilio callback. |
| `vercel.json`                                    | Cron schedule.   |

## How it works

The files above form the main boundary for this topic. Route/page files collect inputs, domain modules enforce business rules, and shared helpers in `lib/**` or `server/**` keep cross-cutting behavior out of components.

## Integration points

This topic links to [Jobs and queues](../systems/jobs-queues.md). It also uses shared configuration from `lib/env.ts` and project validation rules from `docs/sdlc/verification.md` when changes affect runtime behavior.

## Entry points for modification

Start with the first source file in the table below, then follow imports to the route, hook, or domain file closest to the behavior being changed.

## Key source files

| File                                             | Purpose      |
| ------------------------------------------------ | ------------ |
| `src/app/api/webhook/resend/route.ts`            | Resend.      |
| `src/app/api/webhook/twilio/sms-status/route.ts` | Twilio.      |
| `src/app/api/cron/process-emails/route.ts`       | Email cron.  |
| `vercel.json`                                    | Cron config. |

Related: [Jobs and queues](../systems/jobs-queues.md)
