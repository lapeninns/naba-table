---
task: fix-profile-avatar-tone
timestamp_utc: 2025-12-09T14:37:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix avatar error status tone

## Objective

Ensure the profile management form builds successfully by aligning the avatar error message with the supported `GuestStatus` tone values.

## Success Criteria

- `pnpm run build` (includes Next.js typecheck) passes without errors.
- Avatar upload errors still display a danger/error style message to the user.
- No visual or functional regressions in the profile form.

## Architecture & Components

- `components/profile/ProfileManageForm.tsx`: Change the `GuestStatus` `tone` prop for avatar error display to a supported value (`danger`).
- `src/components/design-system/guest/primitives.tsx`: Permit `GuestStatus` refs (for focus/a11y) and allow `GuestCard` inline `style` to match current usages.

## Data Flow & API Contracts

- No API changes; purely a UI prop correction.

## UI/UX States

- Avatar error: message renders with danger styling using `GuestStatus`.
- No error: status component remains hidden.

## Edge Cases

- Avatar error string present/absent handled as before; only tone literal changes.

## Testing Strategy

- Run `pnpm run build` to ensure TypeScript/Next.js compile without errors.

## Rollout

- No feature flags; change is scoped and safe to ship once build passes.

## DB Change Plan

- Not applicable.
