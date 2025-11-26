---
task: lint-hook-cleanup
timestamp_utc: 2025-11-26T16:01:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Lint hook and type cleanups

## Requirements

- Functional: resolve current eslint failures blocking pre-commit.
- Non-functional: keep behavior unchanged; maintain type safety; no new warnings.

## Existing Patterns & Reuse

- React components use custom hook `useGlobalShortcuts`; hooks must be unconditionally invoked.
- Utility `debounceThrottle.ts` follows debounce/throttle pattern but lacks typed generics.

## External Resources

- N/A (eslint rule enforcement only).

## Constraints & Risks

- Avoid altering runtime behavior of booking/restaurant settings flows.
- Keep changes minimal to satisfy lint rules without refactors.

## Open Questions (owner, due)

- None identified.

## Recommended Direction (with rationale)

- Remove unused variables flagged by eslint.
- Ensure `useGlobalShortcuts` is called unconditionally at top of component render paths.
- Add type parameters to `debounce`/`throttle` helpers to eliminate `any` warnings while preserving existing API shape.
