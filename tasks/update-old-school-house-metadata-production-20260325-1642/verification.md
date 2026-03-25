---
task: update-old-school-house-metadata-production
timestamp_utc: 2026-03-25T16:42:56Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

### Google Maps verification

- [x] Verified the live Google Maps place page for The Old School House.
- [x] Confirmed the venue name, address, phone number, and review presence on the place page.

## Test Outcomes

- [x] Dry-run script succeeded.
- [x] Applied script succeeded.
- [x] Readback row matches expected slug and review URL.

### Production readback

- [x] Restaurant ID `a120da71-ba6d-446f-a33a-2e78787abcb0` now resolves at slug `the-old-school-house`.
- [x] Previous slug `the-old-school-house-stony-stratford` no longer resolves to a restaurant row.
- [x] `google_review_url` now points to the verified Google Maps place page for The Old School House.

## Artifacts

- Update summary: `artifacts/production-update-summary.json`

## Known Issues

- [x] No known issues recorded.

## Sign-off

- [x] Engineering
