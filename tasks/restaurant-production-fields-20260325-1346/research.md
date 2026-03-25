---
task: restaurant-production-fields
timestamp_utc: 2026-03-25T13:46:15Z
owner: github:@openai
reviewers: [github:@openai]
risk: low
flags: []
related_tickets: []
---

# Research: Production restaurant creation fields

## Requirements

- Functional:
  - Identify the exact fields required to create a restaurant record in production.
  - Distinguish between server-required fields, onboarding-form-required fields, and later operational setup fields.
- Non-functional:
  - Use current repository code as the source of truth.
  - Avoid assumptions that are not enforced in code.

## Existing Patterns & Reuse

- The canonical create contract is defined by `createRestaurantSchema` in `src/app/api/ops/restaurants/schema.ts`.
- Both onboarding and ops restaurant creation routes use that same schema.
- The onboarding wizard imposes additional UI requirements in `src/components/features/onboarding/OnboardingWizard.tsx`.

## External Resources

- None. Local codebase inspection was sufficient.

## Constraints & Risks

- The onboarding UI currently requires `slug`, while the server API can auto-generate a slug from `name`.
- The `/complete` onboarding endpoint is a placeholder, so “launch readiness” is driven more by practical operational setup than by a final hard server gate.
- Some defaults differ between onboarding state and server-side fallback values, so required vs defaulted fields must be described carefully.

## Open Questions (owner, due)

- Q: Does the requester want only the bare minimum API fields or a launch checklist?
  A: UNCONFIRMED. Provide both in the handoff.

## Recommended Direction (with rationale)

- Answer in three tiers:
  - Minimum API-required fields
  - Fields required by the current onboarding UI flow
  - Recommended production-ready information for operational launch
- This best matches the codebase because create-time validation and go-live readiness are enforced in different places.
