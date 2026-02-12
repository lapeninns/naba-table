# Ops Dashboard Perceived Latency Pattern

This doc explains how `/app/dashboard` avoids loader flashes by delaying short-lived loading states while keeping content visible during refetches.

## When to Use

- Any dashboard loading indicator that can complete in <200ms (summary, list refresh, heatmap, dialog load).
- Booking card lifecycle action overlays (seat/finish/no-show) to avoid instant flash (200/400ms).
- Inline refresh indicators that should not “blink” on rapid refetches.

## Hook API

`useMinimumDelay(isLoading, { delayMs, minDurationMs, enabled })`

- `delayMs` (default 120): wait this long before showing a loader.
- `minDurationMs` (default 300): once visible, keep loader for at least this long.
- `enabled` (default true): bypass delay and show loader immediately when false.

## Recommended Thresholds

- Summary/list refresh: `delayMs: 120`, `minDurationMs: 250`.
- Full summary skeleton: `delayMs: 120`, `minDurationMs: 300`.
- Dialog loading: `delayMs: 120`, `minDurationMs: 250`.
- Booking card actions: `delayMs: 200`, `minDurationMs: 400`.

## Examples

### Summary Skeleton Gate

```tsx
const showSummarySkeleton = useMinimumDelay(!summary || isInitialLoading, {
  delayMs: 120,
  minDurationMs: 300,
});

return showSummarySkeleton ? <DashboardSummarySkeleton /> : <SummarySection />;
```

### Refresh Indicator

```tsx
const showRefetching = useMinimumDelay(isRefetching, {
  delayMs: 120,
  minDurationMs: 250,
});

return showRefetching ? <UpdatingPill /> : null;
```

### Heatmap Calendar Busy State

```tsx
const showLoading = useMinimumDelay(Boolean(isLoading), {
  delayMs: 120,
  minDurationMs: 250,
});

return <button aria-busy={showLoading} className={showLoading ? 'opacity-70' : ''} />;
```

### Booking Card Action Overlay

```tsx
const showLoading = useMinimumDelay(Boolean(pendingAction), {
  delayMs: 200,
  minDurationMs: 400,
});

return showLoading ? <CardOverlay /> : null;
```

## Accessibility Notes

- Keep `aria-busy` on containers when loading.
- Use `role="status"` or a semantic equivalent for inline refresh indicators.
- Use motion-safe classes; reduced motion is globally respected in `src/app/globals.css`.
