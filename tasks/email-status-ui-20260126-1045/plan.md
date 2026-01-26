---
task: email-status-ui
timestamp_utc: 2026-01-26T10:45:15Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Email Status UI

## Objective

We will enable ops staff to review and filter email job statuses for active bookings so that they can quickly identify missing, delayed, or failed customer emails.

## Success Criteria

- [ ] Ops can view a table of active bookings with email status per job type.
- [ ] Filters for time window, email type, and state return correct data.
- [ ] API returns stable pagination and validation errors for invalid inputs.

## Architecture & Components

- `src/app/api/ops/email-status/route.ts`: API endpoint for ops email status.
- `src/services/ops/email-status.ts`: service for fetching email status.
- `src/hooks/ops/useOpsEmailStatus.ts`: query hook.
- `src/components/features/email-status/OpsEmailStatusClient.tsx`: UI.
- `src/app/app/(app)/email-status/page.tsx`: page entry.
- `src/components/features/ops-shell/navigation.tsx`: nav link.

## Data Flow & API Contracts

Endpoint: `GET /api/ops/email-status`
Request params: `restaurantId`, `page`, `pageSize`, `windowMinutes`
Response: `{ items, pageInfo, generatedAt, windowMinutes }`
Errors: `400` invalid params, `401/403` authz failures.

## UI/UX States

- Loading / Empty / Error / Success
- Status badges: waiting, active, delayed, failed, none, unknown

## Edge Cases

- Bookings without corresponding email jobs show `none` state.
- Delayed jobs show process time in the UI.
- Large pages should be capped (pageSize validation).

## Testing Strategy

- Unit tests for API route (validation + status mapping).
- Component-level sanity checks (render filters, empty state).
- Manual Chrome DevTools MCP QA for UI.

## Rollout

- Feature flag: none (ops-only route + nav); optionally gate if requested.
- Monitoring: API error rates and response times.
- Kill-switch: remove nav link if needed.

## DB Change Plan (if applicable)

- None.
