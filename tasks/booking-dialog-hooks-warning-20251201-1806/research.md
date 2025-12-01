---
task: booking-dialog-hooks-warning
timestamp_utc: 2025-12-01T18:06:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Fix useMemo dependency warning in BookingDetailsDialogWrapper

## Requirements

- Functional: eliminate ESLint react-hooks/exhaustive-deps warning for `BookingDetailsDialogWrapper` so pre-commit passes; keep dialog summary recomputing when booking start time changes.
- Non-functional (a11y, perf, security, privacy, i18n): no UI/a11y change expected; avoid unnecessary re-renders; keep lint with zero warnings.

## Existing Patterns & Reuse

- Component already uses `useMemo` with explicit dependency arrays; similar pattern can be kept while ensuring dependencies include derived values.
- No shared helper needed; minimal change within component is sufficient.

## External Resources

- None required; lint rule from eslint-plugin-react-hooks guides dependency completeness.

## Constraints & Risks

- Adding dependencies could cause extra recomputes; ensure dependency uses stable primitive (start ISO string) to avoid needless reruns.
- Should not alter data shape passed to `BookingDetailsDialog`.

## Open Questions (owner, due)

- None identified.

## Recommended Direction (with rationale)

- Derive `startIso` once (from `initialData` or `fetchedBooking`) and include it in the summary `useMemo` dependency list. Keeps lint satisfied and avoids referencing optional values not in deps.
