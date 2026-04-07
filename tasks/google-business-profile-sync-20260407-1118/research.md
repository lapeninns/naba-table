---
task: google-business-profile-sync
timestamp_utc: 2026-04-07T11:18:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Research: Google Business Profile Sync

## Requirements

- Functional:
  - Let Ops users connect a restaurant in Nab a Table to its Google Business Profile.
  - Fetch the available Google Business Profile data for the connected location.
  - Persist the imported data so Nab a Table can build a curated public restaurant landing page from it.
  - Keep the Google sync attached to the canonical restaurant settings/profile workflow.
- Non-functional (a11y, perf, security, privacy, i18n):
  - OAuth credentials and refresh tokens must never be stored in plaintext or exposed to the client.
  - UI must remain keyboard accessible and verifiable through the required DevTools harness.
  - Remote-only Supabase workflow; schema changes need migration artifacts and rollback notes.
  - Imported profile data should tolerate partial availability because Google Business Profile data is fragmented across multiple APIs/resources.

## Existing Patterns & Reuse

- Canonical Ops restaurant settings route lives under `src/app/app/(app)/settings/restaurant/profile/page.tsx`.
- Profile settings UI is rendered through `src/components/features/restaurant-settings/RestaurantProfileSection.tsx`.
- Restaurant profile editing uses:
  - `components/ops/restaurants/RestaurantDetailsForm.tsx`
  - `src/hooks/ops/useOpsRestaurantDetails.ts`
  - `src/services/ops/restaurants.ts`
  - `src/app/api/ops/restaurants/[id]/details/route.ts`
  - `server/restaurants/details.ts`
  - `server/restaurants/update.ts`
- Public restaurant landing pages already enrich live restaurant data with curated overlays via `src/data/restaurant-directory.ts`.
- Existing restaurant records already store a few Google-facing URLs directly on `restaurants` (`google_map_url`, `google_review_url`), which suggests GBP-derived data should remain tied to restaurant identity rather than a detached subsystem.
- Repo has no existing third-party OAuth integration pattern beyond Supabase auth and no existing encryption helper for app-managed external tokens.

## External Resources

- [Google Business Profile APIs overview](https://developers.google.com/my-business/content/locations) — confirms location management, attributes, and verification constraints, and notes that agencies must be added to client accounts rather than impersonating them.
- [Google Business Profile API docs (official)](https://developers.google.com/my-business/) — primary source for current endpoint families, OAuth requirements, and resource model.

## Constraints & Risks

- Google Business Profile data is not a single resource:
  - core location/business info
  - category-based attributes
  - profile/review/media/performance surfaces
- Restaurants must authorize access to their own GBP account/location; Nab a Table cannot assume global API access to all venues.
- The repo currently lacks a secure external-token storage helper, so adding one safely is part of the task.
- “Fetch all possible information” needs a practical interpretation:
  - fetch and persist the union of supported fields from the approved GBP endpoints we can access for a chosen location
  - store raw snapshots plus a normalized landing-page projection
- Schema additions will require regenerated `types/supabase.ts` eventually; local code can be prepared first, but runtime deployment depends on the remote migration being applied.

## Open Questions (owner, due)

- Q: Should the landing page update automatically after each sync, or should Ops explicitly choose what gets published?
  A: For this iteration, safest default is auto-import into a draft/internal snapshot and use curated projection rules on the public page without exposing unpublished Google text verbatim. Owner: engineering. Due: during implementation.
- Q: Which Google surfaces are available under the project/app credentials once OAuth is configured?
  A: We should implement the connection + sync pipeline against the officially documented Business Profile APIs and degrade gracefully when a field family is unavailable. Owner: engineering. Due: during implementation.

## Recommended Direction (with rationale)

- Add a first-class restaurant-linked Google Business Profile integration:
  - new server-side OAuth connect/callback flow
  - encrypted token storage
  - a dedicated sync record with raw JSON snapshots and normalized summary fields
- Keep manual restaurant profile fields as the canonical editable fallback, but enrich them from GBP where available.
- Expose a new section inside restaurant profile settings for:
  - connect/disconnect Google Business Profile
  - choose or confirm the linked Google location
  - run sync
  - review what data is currently imported
- Use the imported snapshot to feed the public restaurant landing page via the existing directory enrichment layer, preserving Nabatable’s curated presentation rather than dumping raw Google content directly.
