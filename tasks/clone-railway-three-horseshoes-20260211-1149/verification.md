---
task: clone-railway-three-horseshoes
timestamp_utc: 2026-02-11T11:49:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

- Not applicable: no UI changes were made.

## Data Verification

- Source clone dry-run executed successfully with expected table counts.
- Production clone apply succeeded for new restaurant:
- `id`: `3a300e1c-5b91-4637-ae27-514863cad5ad`
- `slug`: `three-horseshoes`

- Restaurant profile overwritten and verified:
- `name`: Three Horseshoes
- `address`: Church Street, Stapleford, Cambridge CB22 5DS
- `contact_phone`: 01223 503 402
- `contact_email`: hello@threehorseshoes-pub.com
- `google_map_url`: provided Google Maps URL

- Booking seed verification:
- Date range: `2026-02-12` to `2026-02-26` (15 days)
- Total bookings: `661`
- Total customers: `661` (synthetic)
- Total table assignments: `661`
- Per-day counts bounded in `[40, 50]`

## Test Outcomes

- [x] Clone operation dry-run + apply completed.
- [x] Profile overwrite query completed.
- [x] Seed run completed with target daily bounds.
- [x] Post-seed aggregate checks passed.

## Artifacts

- Command transcript summary: `artifacts/commands.md`
- Booking daily distribution: `artifacts/booking-counts.json`

## Known Issues

- PostgREST schema cache does not currently expose `bookings.assignment_state` and `bookings.table_id` for insert payloads.

## Sign-off

- [x] Engineering
- [ ] Design/PM
- [ ] QA
