---
task: sms-summary-worker-node-compat
timestamp_utc: 2026-04-18T16:27:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: low
flags: []
related_tickets: []
---

# Research: SMS Summary Worker Node Compat

## Requirements

- Unblock deployment of `nabatable-sms-summary-gateway` from the CLI.
- Keep the manager daily summary SMS copy change deployable without altering unrelated worker behavior.

## Existing Patterns & Reuse

- Worker config lives in `cloudflare/sms-summary-gateway/wrangler.jsonc`.
- Deployment path is the existing CLI script `scripts/cloudflare/deploy-sms-summary-gateway.sh`.
- The worker currently imports `lib/twilio/sms.ts`, which pulls in `node:crypto`.

## External Resources

- [Cloudflare Workers Node.js compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/) — confirms `nodejs_compat` is required for Node built-ins such as `node:crypto`.
- [Cloudflare compatibility flags](https://developers.cloudflare.com/workers/configuration/compatibility-flags/) — documents `compatibility_flags` in Wrangler config.

## Constraints & Risks

- This worker is production-facing and cron/queue backed, so the config change should stay minimal.
- The current deploy blocker is at upload validation time, not runtime, so proof must include a successful CLI deploy.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Add `"compatibility_flags": ["nodejs_compat"]` to the worker `wrangler.jsonc`.
- Verify by redeploying via the existing CLI command and recording the resulting version and health check.
