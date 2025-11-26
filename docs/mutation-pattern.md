# Mutation Pattern — Optimistic UI (Sprint 1)

## Goals

- Instant UI feedback on toggles and booking status changes.
- Deterministic rollback on failure.
- Targeted cache invalidation to avoid over-fetching.

## Standard Pattern (TanStack Query v5)

```ts
const mutation = useMutation({
  mutationFn: submitFn,
  onMutate: async (variables) => {
    await queryClient.cancelQueries({ queryKey: targetKeyRoot });
    const snapshot = {
      lists: queryClient.getQueriesData<ListType>({ queryKey: targetKeyRoot }),
      detail: queryClient.getQueryData<DetailType>(detailKey),
    };
    queryClient.setQueryData(detailKey, (prev) => (prev ? patch(prev, variables) : prev));
    snapshot.lists.forEach(([key, data]) => {
      if (!data) return;
      queryClient.setQueryData(key, (prev) => patchList(prev, variables));
    });
    return snapshot;
  },
  onError: (_error, _vars, snapshot) => {
    snapshot?.lists?.forEach(([key, data]) => queryClient.setQueryData(key, data));
    if (snapshot?.detail) queryClient.setQueryData(detailKey, snapshot.detail);
    toast.error('Failed to save');
  },
  onSettled: (_data, _error, variables) => {
    queryClient.invalidateQueries({ queryKey: targetKeyRoot });
    queryClient.invalidateQueries({ queryKey: detailKey });
    extraInvalidations?.(variables);
  },
});
```

### Do

- Cancel queries before mutating the cache.
- Return a snapshot from `onMutate` and use it in `onError` to rollback.
- Invalidate the minimal set of query keys in `onSettled`.
- Show pending UI (`isPending`) to disable buttons/switches.

### Don’t

- Invalidate everything (causes over-fetching).
- Forget to return the snapshot.
- Swallow errors; always surface a toast.

## Invalidation Checklist (by area)

- **Bookings (guest)**: `queryKeys.bookings.all`, `queryKeys.bookings.detail(id)`, `reservationKeys.detail(id)`.
- **Bookings (ops)**: `queryKeys.opsBookings.list(...)`, `queryKeys.opsDashboard.summary(restId, date)`, dashboard heatmap, booking timeline if present.
- **Tables/Zones/Occasions/Settings toggles**: relevant `queryKeys.opsTables.*`, `queryKeys.opsRestaurants.servicePeriods/hours`, `queryKeys.opsOccasions.list`, settings detail.
- **Schedules/availability**: `['reservations','schedule', slug, date]`.

## Example Refactor (applied in repo)

- `hooks/useUpdateBooking.ts`: now uses the pattern above—optimistic list/detail update, rollback on error, targeted invalidation on settle.

## Testing Checklist

- Run mutation offline/error path: UI rolls back and toast shows “Failed to save”.
- Concurrent mutations on same entity keep their own snapshots.
- After settle, data matches server (manual refetch or targeted invalidation completes).
