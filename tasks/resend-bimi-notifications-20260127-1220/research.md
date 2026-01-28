---
task: resend-bimi-notifications
timestamp_utc: 2026-01-27T12:20:26Z
owner: github:@amankumarshrestha
reviewers: [github:@amankumarshrestha]
risk: medium
flags: []
related_tickets: []
---

# Research: Resend + Vercel DNS + DMARC + BIMI for notifications.nabatable.com

## Requirements

- Functional:
- Configure Resend sending domain identity for `notifications.nabatable.com`.
- Publish Resend-required SPF/DKIM records in Vercel DNS.
- Publish DMARC enforcement for both `_dmarc.nabatable.com` and `_dmarc.notifications.nabatable.com`.
- Publish BIMI TXT for `default._bimi.notifications.nabatable.com` using a single brand logo.
- Convert animated SVG logo at `public/brand/nabatable-logo.svg` into BIMI-compliant static SVG Tiny-PS.
- Provide verification checklist, `dig` commands, and minimal test plan.

- Non-functional (a11y, perf, security, privacy, i18n):
- Security: no secrets in code; use placeholders for API keys/tokens.
- Reliability: fail-fast DNS/DMARC alignment guidance before strict `p=reject`.
- Maintainability: single canonical DMARC and BIMI policy per domain/subdomain.

## Existing Patterns & Reuse

- Existing brand SVG at `public/brand/nabatable-logo.svg` can be simplified into BIMI-compatible Tiny-PS.
- Task artifacts follow root `AGENTS.md` SDLC requirements.

## External Resources

- Resend domain verification API/docs (official) — needed to add correct SPF/DKIM entries.
- BIMI group requirements (official) — Tiny-PS SVG constraints and DMARC enforcement rules.
- Provider documentation (Gmail/Yahoo/Fastmail) — BIMI display behavior and VMC/CMC impact.

## Constraints & Risks

- Resend DKIM/SPF records are provider-specific; must be fetched via API for exact values.
- BIMI display in Gmail typically requires a VMC/CMC; without it, BIMI may not render.
- DMARC enforcement at `p=reject` can break deliverability if SPF/DKIM alignment is not verified first.

## Open Questions (owner, due)

- Exact Resend DKIM/SPF values are unknown until the domain is created (owner: github:@amankumarshrestha, due: 2026-01-27).
- VMC/CMC PEM URL availability is unknown; response will include placeholder and behavior notes (owner: github:@amankumarshrestha, due: 2026-01-27).

## Recommended Direction (with rationale)

- Use Resend API to create the domain, fetch required DNS records, and verify after publishing.
- Set DMARC to `p=quarantine; pct=100` first with monitoring, then optionally move to `p=reject` once alignment is confirmed.
- Publish BIMI for the subdomain with HTTPS-hosted Tiny-PS SVG and VMC/CMC PEM (placeholder if not available).
