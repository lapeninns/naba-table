# Deployment

Nabatable deploys the Next app with `next.config.js` and `vercel.json`, Reserve with `reserve/vite.config.ts`, and workers with `cloudflare/**/wrangler.jsonc` plus `scripts/cloudflare/**`. Cron entries in `vercel.json` call `src/app/api/cron/process-emails/route.ts`, `src/app/api/cron/auto-complete-bookings/route.ts`, and `src/app/api/cron/dual-sync/auto-export/route.ts`.

Related: [Jobs and queues](systems/jobs-queues.md), [Configuration](reference/configuration.md).
