# Plan: Optimize Table Assignment

## Objective

Reduce render cost and remove O(N^2) complexity in `TableAssignmentPanel` and `SelectableTableCard` to improve performance in the Booking Details dialog.

## Success Criteria

- [ ] Removed `tables.find` O(N^2) loop in `TableAssignmentPanel`.
- [ ] Moved time string parsing out of `SelectableTableCard` render loop.
- [ ] `SelectableTableCard` accepts pre-parsed time numbers.
- [ ] UI behavior remains exactly the same.
- [ ] No new dependencies or breaking API changes.

## Architecture & Components

### `SelectableTableCard.tsx`

- **Change**: Add optional props `parsedBookingStart`, `parsedBookingEnd`, `parsedServiceStart`, `parsedServiceEnd` (type `number | null`).
- **Logic**: Use these if provided; otherwise fall back to internal `parseTimeMinutes`.

### `TableAssignmentPanel.tsx`

- **Change**: In `filteredTables`, remove `isAvailable` helper that searches `tables` array. Instead, check properties on the current `table` object directly.
- **Change**: Compute `parsedBookingStart` (etc.) once using `useMemo` at the top level.
- **Change**: Pass these parsed values to `SelectableTableCard`.

## Testing Strategy

- Manual verification via code review (since I can't run the app).
- Ensure TypeScript compiles.
- Verify logic equivalence (e.g. `isAvailable` check is identical but faster).

## Rollout

- Direct code update.
