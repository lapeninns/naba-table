---
task: email-deliverability
timestamp_utc: 2026-03-25T07:23:00Z
owner: github:@amankumarshrestha
reviewers: [github:@amankumarshrestha]
risk: high
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

- Not applicable: no UI changes in this task.

## Deliverability Verification

- `pnpm exec dotenv -e .env.local -- tsx scripts/email/check-resend-status.ts`
- Result (before Cloudflare update): failed with 5 public-DNS mismatches while showing the same records present on Vercel nameservers.
- `pnpm exec dotenv -e .env.local -- bash -lc 'BIMI_ASSET_BASE_URL=https://assets.nabatable.com/bimi/ DMARC_RUA_EMAIL=dmarc@nabatable.com pnpm -s email:setup:notifications-domain'`
- Result: setup script now detects that `nabatable.com` is delegated to Cloudflare and prints the exact records to publish there instead of Vercel CLI commands.
- `pnpm exec eslint scripts/email/check-resend-status.ts scripts/email/setup-notifications-domain.ts`
- Result: passed.
- Initial `dig` validation:
- Public resolvers (`1.1.1.1`) returned no TXT/MX data for the `notifications.nabatable.com` sender-auth records.
- `ns1.vercel-dns.com` returned the expected DKIM/SPF/DMARC/BIMI records.
- `dig +short NS nabatable.com` returned `damien.ns.cloudflare.com` and `emerie.ns.cloudflare.com`.
- Cloudflare access validation:
- `npx wrangler whoami`
- Result: authenticated against the Cloudflare account that owns `nabatable.com`.
- `curl https://api.cloudflare.com/client/v4/zones?name=nabatable.com` using the Wrangler session token
- Result: zone lookup succeeds and confirms zone id `795c0547f44ef3379798337aba2224bd`.
- `curl https://api.cloudflare.com/client/v4/zones/<zone_id>/dns_records?...` using the same Wrangler session token
- Result: fails with `HTTP 403` / `Authentication error`, so the available CLI session cannot perform DNS record reads/writes through the REST API.
- Cloudflare DNS apply:
- Added `TXT resend._domainkey.notifications.nabatable.com` (`3e94439422f086c467e80360209c2e51`)
- Added `MX send.notifications.nabatable.com` (`4bc7adf9be8ad952680a847d1678781e`)
- Added `TXT send.notifications.nabatable.com` (`9926afe311ec956f6d9057398f016949`)
- Added `TXT _dmarc.notifications.nabatable.com` (`a32b19e9c1e47a66d4d4719843102e50`)
- Added `TXT default._bimi.notifications.nabatable.com` (`1aabb77ece389f571cafbf1ace57528b`)
- Public DNS verification after apply:
- Public resolvers now return the expected DKIM/SPF/DMARC/BIMI records for `notifications.nabatable.com`.
- `pnpm exec dotenv -e .env.local -- tsx scripts/email/check-resend-status.ts`
- Result (after Cloudflare update): passed.

## Artifacts

- Deliverability audit: `artifacts/email-check.txt`
- Setup dry run: `artifacts/setup-notifications-domain.txt`
- DNS comparison: `artifacts/dns-evidence.txt`

## Known Issues

- Resend still reports `notifications.nabatable.com` as `verified`, so operator checks must use public DNS rather than provider status alone.
- The Wrangler OAuth session remains insufficient for DNS REST calls; the successful apply depended on a separate Cloudflare API token.
- Rotate the Cloudflare API token used for this one-off change because it was shared directly in chat.

## Sign-off

- [ ] Engineering
- [ ] QA
