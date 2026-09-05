# KV rebuild: `BOOKING_SHORT_LINKS_CACHE`

Worker: `cloudflare/booking-short-links`. Script: `scripts/cloudflare/recovery/kv-rebuild.ts`.

## Classification

`BOOKING_SHORT_LINKS_CACHE` is a **rebuildable cache**. D1 (`BOOKING_SHORT_LINKS_DB`, table `booking_short_links`) is the only authoritative store for short links; the Worker resolves every token from D1 and treats the KV namespace as an optional accelerator plus the readiness sentinel (`readiness:sentinel`, read by `/ready`). Losing or corrupting the namespace loses no data. A stale or poisoned namespace can, however, serve a wrong destination or a revoked link, which is why the rebuild always **invalidates first** and only then rewarms.

## Procedure

1. Confirm the D1 backup for the same environment is fresh (`tsx scripts/cloudflare/recovery/d1-backup.ts --env <env>` passed within the last 24 h). Never rewarm KV from a D1 database whose integrity check failed.
2. Plan: `tsx scripts/cloudflare/recovery/kv-rebuild.ts --env staging` (or `production`). Without `--confirm` the script lists how many keys would be deleted and how many entries would be written and exits 0. A `REPLACE_ME_*` namespace id in `wrangler.jsonc` makes the environment "unconfigured" and the script refuses (exit 2).
3. Apply: add `--confirm`. The script
   - lists every key (`wrangler kv key list --namespace-id <id>`),
   - deletes them in one bulk operation (`wrangler kv bulk delete … --force`),
   - selects active links from D1 (`revoked_at IS NULL AND expires_at > now`),
   - writes `readiness:sentinel` plus one `link:<token>` entry per active link with `expiration` equal to the link's `expires_at` (`wrangler kv bulk put`).
4. Verify: `GET /ready` on the Worker must report the KV check as ready; spot-check one short link end to end in a browser.

The bulk files are written to a private temp directory that is removed in `finally`. Cloudflare credentials come from wrangler's own environment (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`); the script never places them in argv or logs.

## When not to run it

- During an active D1 incident: rebuild KV **after** D1 is restored and verified.
- To "fix" a wrong destination: revoke the link in D1 first (the Worker's API), then rebuild.
