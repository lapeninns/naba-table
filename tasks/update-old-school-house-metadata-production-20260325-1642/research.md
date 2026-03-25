---
task: update-old-school-house-metadata-production
timestamp_utc: 2026-03-25T16:42:56Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Update Old School House Production Metadata

## Requirements

- Functional:
  - Update the production restaurant record for The Old School House.
  - Set a production-safe Google review URL.
  - Rename the restaurant slug to a cleaner public-facing value.
- Non-functional:
  - Use the same guarded production-write pattern as the earlier clone task.
  - Verify slug uniqueness before mutation.
  - Record before/after evidence in task artifacts.

## Existing Patterns & Reuse

- `scripts/clone-restaurant-config.ts` already uses the correct production env loading, project ref guard, and service-role write path.
- `scripts/update-railway-details.ts` provides a smaller example of direct restaurant metadata updates.
- `server/restaurants/update.ts` is the canonical app-side validation and uniqueness behavior for restaurant updates.

## External Resources

- [The Old School House Google Maps place page](https://www.google.com/maps/place/The+Old+School+House/@52.0557627,-0.8504611,17z/data=!3m1!4b1!4m6!3m5!1s0x487701c45888b76d:0xaeebe77da7ae4e4e!8m2!3d52.0557627!4d-0.8504611!16s%2Fg%2F11sn_2wv7s?hl=en-GB&entry=ttu) — verified live via Chrome DevTools as the canonical public place page for this venue.
- [Old School House contact page](https://oldschoolhousestony.co.uk/contact-us/) — confirms the same venue identity and linked Google Maps business surface.

## Constraints & Risks

- Google does not expose a direct anonymous write-review deep link from the public place page without sign-in context; using the canonical place page is the most stable Google-owned review destination we could verify live.
- Slug changes can affect booking links and any marketing links that already use the previous slug.
- Production write must remain explicitly guarded against the wrong project.

## Open Questions (owner, due)

- None. Proceeding under the assumption that the shorter slug is desired.

## Recommended Direction (with rationale)

- Update the restaurant by stable restaurant ID, not current slug, so the rename is atomic and not lookup-dependent.
- Set `google_review_url` to the canonical Google Maps place URL for The Old School House because it is verified, stable, and lands users on the venue page with reviews visible.
- Rename the slug to `the-old-school-house` if it is unique in production.
