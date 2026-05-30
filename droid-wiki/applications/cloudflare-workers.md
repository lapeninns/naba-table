# Cloudflare Workers

Active contributors: amanshresthaa

## Purpose

Cloudflare Workers handle edge tasks that should not live inside the Next runtime: booking short links, an email queue gateway, and daily SMS summary dispatch.

## Directory layout

```text
cloudflare/
|-- booking-short-links/src/
|-- email-queue-gateway/src/
`-- sms-summary-gateway/src/
```

## Key abstractions

| Symbol or file                                 | Description                |
| ---------------------------------------------- | -------------------------- |
| `cloudflare/booking-short-links/src/index.ts`  | Short-link worker entry.   |
| `cloudflare/email-queue-gateway/src/index.mjs` | Email queue gateway entry. |
| `cloudflare/sms-summary-gateway/src/job.ts`    | SMS summary job.           |

## How it works

Workers are deployed with their own `wrangler.jsonc` files and helper scripts under `scripts/cloudflare/**`. Tests live under `tests/cloudflare/**`.

## Integration points

This topic links to [Deployment](../deployment.md), [Communications](../systems/communications.md), and [Jobs and queues](../systems/jobs-queues.md).

## Entry points for modification

Start with the file closest to the behavior being changed, then follow imports to the route, hook, or domain module. For route, API, auth, proxy, Supabase, shared UI, or browser changes, follow `docs/sdlc/**` before editing.

## Key source files

| File                                                    | Purpose               |
| ------------------------------------------------------- | --------------------- |
| `cloudflare/booking-short-links/src/core.ts`            | Short-link logic.     |
| `cloudflare/email-queue-gateway/src/gateway-router.mjs` | Email gateway router. |
| `cloudflare/sms-summary-gateway/src/scheduling.ts`      | Summary scheduling.   |
