---
task: fix-profile-avatar-tone
timestamp_utc: 2025-12-09T14:37:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Fix avatar error status tone

## Requirements

- Functional: Resolve the type error in `components/profile/ProfileManageForm.tsx` so the build succeeds; keep the avatar error message visible when upload fails.
- Non-functional: No UI/UX regressions; maintain accessibility of status messaging.

## Existing Patterns & Reuse

- `GuestStatus` in `src/components/design-system/guest/primitives.tsx` supports `tone` values `info | success | warning | danger`.
- Current usage in ProfileManageForm passes `tone="error"`, which is outside the allowed union and causes the typecheck failure during `next build`.

## External Resources

- None required; types are defined locally.

## Constraints & Risks

- Changing the tone string could slightly adjust the semantic color (danger vs. error), but expected visual intent is an error/danger style. Risk is minimal.

## Open Questions (owner, due)

- None identified.

## Recommended Direction (with rationale)

- Align the avatar error status with the supported `tone` values by switching `tone="error"` to `tone="danger"`, matching the existing palette and eliminating the type error without altering behavior.
