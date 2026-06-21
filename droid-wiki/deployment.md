# Deployment

Nabatable deploys the Next app with `next.config.js` and `vercel.json`, Reserve with `reserve/vite.config.ts`, and workers with `cloudflare/**/wrangler.jsonc` plus `scripts/cloudflare/**`.

## Scheduled routes

| Cron path                                   | Schedule       |
| ------------------------------------------- | -------------- |
| `/api/cron/process-emails`                  | `*/5 * * * *`  |
| `/api/cron/auto-complete-bookings`          | `*/15 * * * *` |
| `/api/cron/dual-sync/auto-export`           | `*/30 * * * *` |
| `/api/cron/dual-sync/queue`                 | `*/5 * * * *`  |
| `/api/cron/dual-sync/health`                | `0 * * * *`    |
| `/api/cron/dual-sync/request-log-retention` | `30 2 * * *`   |

Supabase is remote-only; staging-first is mandatory unless production work is explicitly requested. Cloudflare worker deploy, rollback, version, and smoke scripts are grouped in `package.json` under `cloudflare:*`.

Related: [Jobs and queues](systems/jobs-queues.md), [Configuration](reference/configuration.md).
