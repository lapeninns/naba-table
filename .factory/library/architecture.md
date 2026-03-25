# Architecture

Architectural decisions, patterns discovered, and conventions.

---

## Email Delivery Page Architecture

### Component Hierarchy (Target)

```
page.tsx (Server Component — parses URL search params)
└── OpsEmailDeliveryClient (Client Component — orchestrator)
    ├── OpsPageHeader (title, restaurant badge, timezone, actions)
    ├── Auto-refresh controls + manual refresh button
    ├── Tabs (Delivery Log | Queue | Analytics)
    │   ├── Delivery Log Tab
    │   │   ├── Filter bar (field-select search, status multi-select, range toggle, template/email type dropdowns)
    │   │   ├── Data table (sortable columns, expandable rows)
    │   │   └── Pagination bar (total count, page size, prev/next)
    │   ├── Queue Tab
    │   │   ├── KPI tiles
    │   │   ├── Status filter buttons
    │   │   ├── Queue table
    │   │   └── Pagination
    │   └── Analytics Tab
    │       ├── KPI tiles (Total, Delivered %, Delayed, Failures %)
    │       ├── Status distribution bar
    │       └── Secondary metrics (p50/p95, top failures, unique counts)
    └── Retry confirmation dialog
```

### Data Flow

- API routes in `src/app/api/ops/email-delivery/` → server functions in `server/emails/email-delivery-log.ts`
- Server uses Supabase RPCs (`ops_email_delivery_attempts_feed`, `ops_email_delivery_attempts_summary`) with fallback to direct queries
- Client uses TanStack React Query hooks (`useOpsEmailDeliveryFeed`)
- Service layer accessed via `OpsServicesProvider` context with factory functions

### Key Files

- Page: `src/app/app/(app)/email-delivery/page.tsx`
- Client: `src/components/features/email-delivery/OpsEmailDeliveryClient.tsx`
- Components: `src/components/features/email-delivery/components/`
- Hooks: `src/hooks/ops/useOpsEmailDeliveryFeed.ts`
- API: `src/app/api/ops/email-delivery/route.ts`
- Server: `server/emails/email-delivery-log.ts`
- Types: `types/emailDelivery.ts`
- Dev harness: `src/app/(public)/dev/ops-email-delivery/`

### Canonical Filter Option Sources

- Delivery Log template/email dropdowns must stay aligned with known values used across:
  - `src/app/(public)/dev/_mocks/services/devEmailDelivery.ts`
  - `src/components/features/email-delivery/components/OpsEmailQueuePanel.tsx`
  - `server/queue/email.ts`
- When adding/removing queue email types or delivery templates, update filter options and filter-bar tests together.

### Validation Surface Caveat

- Prefer `/dev/ops-email-delivery` when it renders full UI.
- If dev harness is unavailable or shell-only under current `APP_ENV`, use authenticated `http://app.localhost:3000/email-delivery`.

- Email Delivery retry flow currently exposes `messageId` in UI DTOs separately from delivery-log row `id`; any retry API keyed by `deliveryLogId` must surface the row id through feed DTOs instead of reusing provider message identifiers.
