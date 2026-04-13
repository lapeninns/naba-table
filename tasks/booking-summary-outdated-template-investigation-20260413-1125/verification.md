---
task: booking-summary-outdated-template-investigation
timestamp_utc: 2026-04-13T11:25:40Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Investigation Proof

- Root cause confirmed: the compact manager-summary formatter landed in git on April 12, 2026 at 10:19:21 BST (`commit 3b562879fd02e308b5a6bf6a182ae1db2b7a16c1`), but `nabatable-sms-summary-gateway` had not been redeployed since April 11, 2026 at 14:01:48Z (`version 7415583d-e9b9-4643-bde7-f5be407de04f`).
- Because the reported stale SMS was received around 10:00 on April 13, 2026, production was still running the pre-copy-change worker bundle at send time.
- The worker was redeployed on April 13, 2026 at 11:28:38Z as `version 734b010e-ec61-433f-a84d-02872d97d750`.
- A live production-data preview rendered from the current canonical code now produces:
  - `The Old Crown Girton: Today 1 bkgs, 2 covers. Lunch 0/0. Dinner 1/2.`
- Health check after deploy remained green at `https://nabatable-sms-summary-gateway.amanshresthaaaaa.workers.dev/health`.

## Commands

- `git log --date=iso -- 'lib/ops/daily-booking-summary.ts' | head -n 80`
- `git show 3b562879fd02e308b5a6bf6a182ae1db2b7a16c1^:'lib/ops/daily-booking-summary.ts' | sed -n '90,170p'`
- `npx wrangler deployments list --config 'cloudflare/sms-summary-gateway/wrangler.jsonc'`
- `pnpm vitest run tests/cloudflare/sms-summary-gateway.test.ts tests/utils/dashboardSummary.test.ts`
- `bash ./scripts/cloudflare/deploy-sms-summary-gateway.sh`
- `pnpm exec dotenv -e .env.tmp.production -- tsx -e "import { buildDailySummaryPreview } from './cloudflare/sms-summary-gateway/src/supabase'; (async () => { const env = { SUPABASE_URL: process.env.PRODUCTION_SUPABASE_URL || process.env.SUPABASE_URL || '', SUPABASE_SERVICE_ROLE_KEY: process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '' }; const preview = await buildDailySummaryPreview(env, { restaurantId: 'a050d1ad-1ee0-4ea0-abc2-22c3778aa52c', localDate: '2026-04-13', timezone: 'Europe/London' }); console.log(JSON.stringify({ date: preview.date, restaurantId: preview.restaurantId, message: preview.message }, null, 2)); })().catch((error) => { console.error(error); process.exit(1); });"`
- `curl -sS 'https://nabatable-sms-summary-gateway.amanshresthaaaaa.workers.dev/health'`

## Artifacts

- Deployment evidence is recorded inline in this report from Wrangler output.
- Live preview evidence is recorded inline in this report from the production-data preview run.

## Known Issues

- The user-reported 10:00 SMS was generated before the April 13, 2026 redeploy, so one stale production message did go out before this fix.

## Sign-off

- [x] Engineering
