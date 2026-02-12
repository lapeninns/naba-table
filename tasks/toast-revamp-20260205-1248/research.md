---
task: toast-revamp
timestamp_utc: 2026-02-05T12:48:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Toast Removal (Global)

## Requirements

- Functional:
  - Remove all toast notifications across the app.
  - Remove toast infrastructure and any toast-triggering logic.
  - Keep primary flows functional without toast dependencies.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Ensure removal does not regress a11y or performance.
  - No PII leakage in user-facing feedback.

## Existing Patterns & Reuse

- Shadcn toast stack was present and used in ops dashboards:
  - `components/ui/toast.tsx` (Radix Toast, classnames, animations)
  - `components/ui/toaster.tsx` (stack rendering)
  - `hooks/use-toast.ts` (state, dismiss, remove delay)
- Legacy react-hot-toast was mounted globally in `components/LayoutClient.tsx`.

## External Resources

- None required for removal.

## Constraints & Risks

- Remove toast calls carefully to avoid breaking flows.
- Ensure no lingering references in hooks/tests.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Remove Shadcn/Radix toast base and legacy toast provider.
- Remove toast usage from hooks/components and tests.
- Validate core flows still function without toast dependencies.
