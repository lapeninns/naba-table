---
task: update-old-school-house-google-links-production
timestamp_utc: 2026-03-25T17:22:46Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Update Old School House Google Links in Production

## Requirements

- Functional:
  - Update `google_review_url` for The Old School House to the exact review link provided by the user.
  - Update `google_map_url` for The Old School House to the exact customer-location directions link provided by the user.
- Non-functional:
  - Keep the existing production slug unchanged.
  - Use a guarded production metadata update path with readback verification.

## Existing Patterns & Reuse

- `scripts/update-restaurant-metadata.ts` already handles guarded production metadata updates by stable restaurant ID.
- The same task family already verified this restaurant ID and slug in production.

## External Resources

- User-provided review URL:
  - `https://search.google.com/local/writereview?placeid=ChIJbbeIWMQBd0gRTk6up33n664`
- User-provided directions URL:
  - `https://www.google.com/maps/dir/52.2425722,0.0814095/The+Old+School+House,+London+Rd,+Stony+Stratford,+Milton+Keynes+MK11+1JA/@52.1793596,-0.7110939,10z/data=!3m1!4b1!4m10!4m9!1m1!4e1!1m5!1m1!1s0x487701c45888b76d:0xaeebe77da7ae4e4e!2m2!1d-0.8504611!2d52.0557627!3e0?entry=ttu&g_ep=EgoyMDI2MDMyMy4xIKXMDSoASAFQAw%3D%3D`

## Constraints & Risks

- The directions URL includes a concrete origin coordinate; this is intentional per the user request, even though many map links are usually destination-only.
- We should not re-touch slug or access data in this follow-up.

## Open Questions (owner, due)

- None. The user provided the exact links to store.

## Recommended Direction (with rationale)

- Extend the existing production metadata updater to support `google_map_url`.
- Update only the two Google URLs while preserving the current slug `the-old-school-house`.
