# Metrics

Metrics and analytics use `lib/analytics.ts`, `lib/analytics/emit.ts`, `server/analytics.ts`, `server/capacity/metrics.ts`, `server/observability.ts`, `server/dual-sync/observability/**`, and scripts under `scripts/observability/**`.

## Important areas

- Capacity metrics and rejection analytics help explain assignment outcomes.
- Dual-sync operational alerts and metrics track publish and queue health.
- PostHog client setup lives in the app provider stack and related config variables.
- Observability and privacy checks are grouped under `pnpm run qa:observability-privacy`.

Related: [Capacity and table assignment](../systems/capacity-table-assignment.md), [Google Business and dual sync](../systems/google-business-dual-sync.md).
