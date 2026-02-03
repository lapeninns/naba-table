---
task: update-railway-details
timestamp_utc: 2026-02-03T14:17:04Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Update Railway Pub Details

## Requirements

- Functional:
  - Overwrite The Railway Pub details in production where fields exist.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No UI changes.
  - Production only.

## Existing Patterns & Reuse

- Use Supabase service-role scripts for production updates.

## External Resources

- N/A

## Constraints & Risks

- Only update columns that exist (no website/opening date column currently).
- Supabase is remote-only.

## Open Questions (owner, due)

- Q: Where should the website URL and opening date be stored? (owner: github:@amankumarshrestha, due: 2026-02-03)

## Recommended Direction (with rationale)

- Update name/address/contact phone and google review URL. Optionally set google_map_url using address.
