---
task: fix-wizard-draft-expiry
timestamp_utc: 2026-04-05T15:50:00Z
owner: github:@amankumarshresthaa
reviewers: [github:@amankumarshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Reservation wizard early draft expiry

## Objective

We will tighten reservation draft loading so that restaurant-specific booking flows only restore drafts scoped to that restaurant, preventing unrelated legacy drafts from triggering false expiry resets.

## Success Criteria

- [ ] A restaurant-specific wizard route does not read an unrelated legacy/global draft.
- [ ] The `"Draft expired—let’s refresh availability."` alert only appears when the active draft for the current flow is actually expired.
- [ ] Generic reserve routes without a slug can still restore the legacy/global draft behavior.

## Architecture & Components

- `useWizardDraftStorage.ts`: source of truth for draft key selection, fallback rules, and contact merge behavior.
- `useReservationWizard.ts`: existing mount flow that consumes `loadWizardDraft`; no behavior expansion expected beyond the corrected storage result.
- Tests: add focused coverage around the storage helper rather than duplicating wizard UI behavior.

## Data Flow & API Contracts

No API contract changes.

Browser storage flow:

- Restaurant-scoped flow:
  - Read `reserve.wizard.draft.<slug>`
  - Do not fall back to `reserve.wizard.draft` when `<slug>` is known and no matching scoped draft exists
- Generic flow:
  - Read `reserve.wizard.draft`

## UI/UX States

- Loading / Empty / Error / Success:
  - Unchanged UI states.
  - Plan-step alert should only render for the active draft’s real expiry condition.

## Edge Cases

- Legacy global draft exists and current route has a different restaurant slug.
- Legacy global draft exists with no stored restaurant slug.
- Restaurant-scoped draft exists and should still hydrate contacts from session storage.
- Browser clock skew remains possible; this change narrows false positives caused by wrong-key restores, not all clock issues.

## Testing Strategy

- Unit / Integration / E2E / Accessibility
- Add focused Vitest coverage for `loadWizardDraft` behavior across scoped and unscoped routes.
- Run targeted reservation wizard tests.

## Rollout

- Feature flag: none
- Exposure: immediate code fix
- Monitoring: local targeted tests in this task; existing analytics event `wizard.reset.triggered`
- Kill-switch: revert the storage fallback change if legacy draft restoration breaks

## DB Change Plan (if applicable)

- No database changes.
