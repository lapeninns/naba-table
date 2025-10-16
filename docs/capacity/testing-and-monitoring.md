# Capacity Engine Testing & Monitoring

## Load Testing

1. Set environment variables:
   - `LOAD_TEST_BASE_URL` – target deployment URL (e.g. https://staging.sajiloreservex.com)
   - `LOAD_TEST_RESTAURANT_ID` – test restaurant UUID
   - `LOAD_TEST_SUPABASE_URL` and `LOAD_TEST_SUPABASE_SERVICE_KEY` – service credentials for fixture setup
2. Run the Artillery scenario:
   ```bash
   npx artillery run tests/load/capacity-load.yml --output reports/load-tests/$(date -u +%Y%m%d-%H%M)-capacity.json
   ```
3. Inspect the output report for latency buckets and HTTP status distribution. Verify total successes do not exceed configured capacity.

## Metrics & Dashboards

- Every booking attempt records counters via `increment_capacity_metrics`, aggregated hourly per restaurant.
- Table: `capacity_metrics_hourly` (use Supabase SQL editor or BI tool).
- Key columns:
  - `success_count`: bookings created successfully (duplicates included).
  - `conflict_count`: retryable conflicts detected.
  - `capacity_exceeded_count`: attempts blocked by capacity rules.
- Suggested dashboard visualisations:
  - Stacked bar chart per hour comparing success vs conflict vs capacity exceeded.
  - Alert thresholds (examples):
    - Conflict rate > 5% of total attempts per hour.
    - Capacity exceeded spikes across multiple consecutive hours.

## Alerts

- `server/alerts/capacity.ts` encapsulates threshold checks.
- Trigger via scheduled job or the secure endpoint `/api/internal/capacity/check-alerts` (requires internal auth header).
- Configure notification target using environment variables:
  - `CAPACITY_ALERT_WEBHOOK_URL` (Slack/MS Teams) **or**
  - `CAPACITY_ALERT_EMAIL` for email notifications.

## QA Checklist

- [ ] Unit tests (`pnpm test server/capacity`) cover overrides, unlimited capacity, retry exhaustion.
- [ ] Integration tests (`pnpm test --filter capacity-api`) confirm overrides stored and metrics RPC works.
- [ ] Load test executed against staging; report archived in `reports/load-tests/`.
- [ ] Metrics table populated and visible in dashboard.
- [ ] Alerts validated (simulate overbooking/conflict spikes) and reach on-call channel.
