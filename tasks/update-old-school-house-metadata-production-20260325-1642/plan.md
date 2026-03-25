---
task: update-old-school-house-metadata-production
timestamp_utc: 2026-03-25T16:42:56Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Update Old School House Production Metadata

## Objective

We will update The Old School House production profile so that the venue uses a cleaner slug and a verified Google review destination.

## Success Criteria

- [ ] Production restaurant `a120da71-ba6d-446f-a33a-2e78787abcb0` has slug `the-old-school-house`.
- [ ] Production restaurant `a120da71-ba6d-446f-a33a-2e78787abcb0` has the verified Google Maps place URL in `google_review_url`.
- [ ] Readback verification confirms the new slug and review URL after the write.

## Architecture & Components

- `scripts/update-restaurant-metadata.ts`: guarded production metadata updater keyed by restaurant ID.
- Task artifacts: capture rationale, execution, and readback evidence.

## Data Flow & API Contracts

Target row: `public.restaurants`

Update payload:

```json
{
  "slug": "the-old-school-house",
  "google_review_url": "https://www.google.com/maps/place/The+Old+School+House/@52.0557627,-0.8504611,17z/data=!3m1!4b1!4m6!3m5!1s0x487701c45888b76d:0xaeebe77da7ae4e4e!8m2!3d52.0557627!4d-0.8504611!16s%2Fg%2F11sn_2wv7s?hl=en-GB&entry=ttu"
}
```

Validation:

- Confirm production project ref matches `vrdiqfudmwydclqpydee`.
- Confirm restaurant ID exists.
- Confirm proposed slug is not already used by another restaurant.

## UI/UX States

- Not applicable; production data change only.

## Edge Cases

- Slug already taken.
- Restaurant ID not found.
- Wrong environment or missing service-role credentials.

## Testing Strategy

- Dry-run script output before apply.
- Applied script output and readback verification after apply.

## Rollout

- No feature flag.
- Single production metadata update with explicit confirmation guard.
- Monitoring: verify returned row values immediately after update.

## DB Change Plan (if applicable)

- No schema change.
- Direct row update only.
- Rollback plan: re-run the same updater with the previous slug and previous review URL if needed.
