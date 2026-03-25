---
task: old-school-house-access-followup-production
timestamp_utc: 2026-03-25T17:13:28Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA

- [x] Confirmed the stored review URL already matches the verified canonical Google Maps place page for The Old School House.

## Test Outcomes

- [x] Dry-run access bootstrap succeeded.
- [x] Applied access bootstrap succeeded.
- [x] Membership readback confirms `manager` access for `oldschoolhouse@lapeninns.com`.

### Production readback

- [x] Auth user `073c7a02-b935-48fc-b4d7-1f85b6d649ff` resolves for `oldschoolhouse@lapeninns.com`.
- [x] The user now has `manager` access for restaurant `a120da71-ba6d-446f-a33a-2e78787abcb0`.
- [x] The restaurant still stores the verified canonical Google Maps place URL in `google_review_url`.

## Artifacts

- Access summary: `artifacts/production-access-summary.json`

## Known Issues

- [x] No known issues recorded.

## Sign-off

- [x] Engineering
