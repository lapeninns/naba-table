# Research: Optimize Table Assignment Performance

## Requirements

- Functional: Implement additional speedups in Booking Details dialog (table assignment).
- Non-functional: Reduced render cost in table grid; no UX regression.
- Constraints: Shadcn-only; Keep props API stable; No new dependencies.

## Existing Patterns & Reuse

- `TableAssignmentPanel` renders a grid of `SelectableTableCard`s.
- `SelectableTableCard` displays table info and potentially a timeline of conflicts.

## Performance Analysis (Hypothesis)

- `TableAssignmentPanel` likely filters or maps over bookings for every table, causing O(n\*m) complexity where n=tables and m=bookings.
- `SelectableTableCard` might be doing expensive date parsing/formatting on every render even if data hasn't changed.
- Lack of memoization (`React.memo`, `useMemo`) could lead to excessive re-renders of the entire grid when one state changes.

## Constraints & Risks

- Must preserve exact UI behavior.
- Risk of breaking conflict detection logic if optimization is incorrect.

## Recommended Direction

1. Pre-calculate table availability/conflicts in `TableAssignmentPanel` using a Map/Set lookup (O(1) access).
2. Memoize `SelectableTableCard` to prevent re-renders if props are identical.
3. Move expensive date operations out of the render loop or memoize them.
