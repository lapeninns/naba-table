# Jobs and queues

Active contributors: amanshresthaa

## Purpose

Jobs and queues process email intents, auto-complete bookings, run dual-sync auto-export, sweep holds, prune allocations, and manage outbox-style work.

## Directory layout

```text
server/jobs/
server/queue/
src/app/api/cron/
vercel.json
```

## Key abstractions

| Symbol or file                          | Description          |
| --------------------------------------- | -------------------- |
| `vercel.json`                           | Cron schedule.       |
| `server/queue/email-processing.ts`      | Email processing.    |
| `server/jobs/auto-complete-bookings.ts` | Auto-completion job. |

## How it works

The files above form the main boundary for this topic. Route/page files collect inputs, domain modules enforce business rules, and shared helpers in `lib/**` or `server/**` keep cross-cutting behavior out of components.

## Integration points

This topic links to [Deployment](../deployment.md), [Communications](communications.md). It also uses shared configuration from `lib/env.ts` and project validation rules from `docs/sdlc/verification.md` when changes affect runtime behavior.

## Entry points for modification

Start with the first source file in the table below, then follow imports to the route, hook, or domain file closest to the behavior being changed.

## Key source files

| File                                       | Purpose           |
| ------------------------------------------ | ----------------- |
| `vercel.json`                              | Cron definitions. |
| `src/app/api/cron/process-emails/route.ts` | Email cron.       |
| `server/jobs/allocations-pruner.ts`        | Pruner.           |
| `server/outbox.ts`                         | Outbox helper.    |

Related: [Deployment](../deployment.md), [Communications](communications.md)
