# Jobs and queues

Active contributors: amanshresthaa, lapeninns

## Purpose

Jobs and queues process email intents, booking side effects, auto-complete bookings, dual-sync auto-export, queue workers, health checks, request-log retention, capacity holds, allocation pruning, table scarcity, and outbox-style work.

## Directory layout

```text
server/jobs/
server/queue/
server/dual-sync/queue/
src/app/api/cron/
vercel.json
```

## Key abstractions

| Symbol or file                          | Description             |
| --------------------------------------- | ----------------------- |
| `vercel.json`                           | Cron schedule.          |
| `server/queue/email-processing.ts`      | Email processing.       |
| `server/jobs/auto-complete-bookings.ts` | Auto-completion job.    |
| `server/dual-sync/queue/worker.ts`      | Dual-sync queue worker. |

## How it works

Vercel cron invokes process-emails, auto-complete-bookings, dual-sync auto-export, dual-sync queue, dual-sync health, and request-log retention routes. Cron routes are security-sensitive and covered by background-worker QA packs.

## Integration points

This topic links to [Deployment](../deployment.md), [Communications](communications.md), [Google Business and dual sync](google-business-dual-sync.md), and [Webhooks and cron](../api/webhooks-cron.md).

## Entry points for modification

Start with the file closest to the behavior being changed, then follow imports to the route, hook, or domain module. For route, API, auth, proxy, Supabase, shared UI, or browser changes, follow `docs/sdlc/**` before editing.

## Key source files

| File                                        | Purpose               |
| ------------------------------------------- | --------------------- |
| `vercel.json`                               | Cron definitions.     |
| `src/app/api/cron/process-emails/route.ts`  | Email cron.           |
| `src/app/api/cron/dual-sync/queue/route.ts` | Dual-sync queue cron. |
| `server/jobs/allocations-pruner.ts`         | Pruner.               |
