---
task: resend-bimi-notifications
timestamp_utc: 2026-01-27T12:20:26Z
owner: github:@amankumarshrestha
reviewers: [github:@amankumarshrestha]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

- Not applicable: no UI changes in this task.

## DNS & Deliverability Verification

- CLI dry run: `BIMI_ASSET_BASE_URL=https://assets.nabatable.com/bimi/ RESEND_API_KEY=re_invalid pnpm -s email:setup:notifications-domain`
- Result: failed fast with `API key is invalid` as expected without valid credentials.
- CLI attempt without key: `BIMI_ASSET_BASE_URL=https://assets.nabatable.com/bimi/ DMARC_RUA_EMAIL=dmarc@nabatable.com pnpm -s email:setup:notifications-domain`
- Result: failed fast with missing `RESEND_API_KEY`, as designed.
- CLI attempt with `.env.local` key: `source .env.local && BIMI_ASSET_BASE_URL=https://assets.nabatable.com/bimi/ pnpm -s email:setup:notifications-domain`
- Result (earlier): Resend returned `This API key is restricted to only send emails` (cannot manage domains).
- CLI dry run after key update: `source .env.local && BIMI_ASSET_BASE_URL=https://assets.nabatable.com/bimi/ DMARC_RUA_EMAIL=dmarc@nabatable.com pnpm -s email:setup:notifications-domain`
- Result: Resend domain lookup succeeded and DNS commands were generated with correct subdomains (no duplicate `.notifications`).
- Vercel DNS apply (via CLI):
- Removed prior root DMARC (`p=none`) via `printf "y\n" | pnpm dlx vercel@latest dns rm rec_174e44036a6fa045a9163f65`
- Added `_dmarc` enforcement via `pnpm dlx vercel@latest dns add nabatable.com _dmarc TXT "...p=quarantine; sp=quarantine; pct=100..."`
- Added `_dmarc.notifications` enforcement via `pnpm dlx vercel@latest dns add nabatable.com _dmarc.notifications TXT "...p=quarantine; pct=100..."`
- Added BIMI via `pnpm dlx vercel@latest dns add nabatable.com default._bimi.notifications TXT "v=BIMI1; l=https://assets.nabatable.com/bimi/nabatable-bimi.svg; a="`
- Resend verification request: `node -e "...resend.domains.verify('104a38f9-b744-46be-b18a-3db984f93824')..."` returned success.
- DNS checks:
- `dig +short TXT _dmarc.nabatable.com` returns enforced DMARC.
- `dig +short TXT _dmarc.notifications.nabatable.com` returns enforced DMARC.
- `dig +short TXT default._bimi.notifications.nabatable.com` returns BIMI record.
- `dig +short TXT resend._domainkey.notifications.nabatable.com` returns DKIM key.
- `dig +short MX/TXT send.notifications.nabatable.com` returns MX/SPF as expected.
- Public hosting steps (Vercel CLI):
- Added assets subdomain DNS: `pnpm dlx vercel@latest dns add nabatable.com assets CNAME cname.vercel-dns.com.`
- Added domain to project: `pnpm dlx vercel@latest domains add assets.nabatable.com`
- Deployed production: `pnpm dlx vercel@latest deploy --prod --yes` (completed successfully).
- Public asset check: `curl -I https://assets.nabatable.com/bimi/nabatable-bimi.svg` returned `HTTP/2 200`.
- Vercel DNS check: `pnpm dlx vercel@latest dns ls nabatable.com | rg "assets|_bimi|_dmarc"` shows the expected records present.
- Lint: `pnpm -s lint` completed with 0 errors and 15 pre-existing warnings outside this change.

## Artifacts

- BIMI SVG (Tiny-PS static): `public/brand/nabatable-bimi.svg`
- DNS dig outputs: to be captured once records propagate.

## Known Issues

- BIMI display in Gmail likely requires a VMC/CMC.
- The automation script still requires `VERCEL_TOKEN` for non-interactive auto-apply, but manual CLI apply succeeded.

## Sign-off

- [ ] Engineering
- [ ] QA
