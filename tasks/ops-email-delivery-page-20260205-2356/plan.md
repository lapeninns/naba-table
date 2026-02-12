---
task: ops-email-delivery-page
timestamp_utc: 2026-02-05T23:56:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Ops Email Delivery Page

See user-approved plan in the chat transcript. Implementation includes:

- Sidebar nav item linking to `/app/email-delivery`.
- New ops page route under `src/app/app/(app)/email-delivery/page.tsx`.
- New API route `GET /api/ops/email-delivery` enforcing session + membership.
- Server helper `listEmailDeliveryEventsForRestaurant` querying `email_delivery_log` with filters/pagination.
- Client feature component with filters + grouped accordion results.
- Service method + hook for data fetching.
- Unit tests for search parsing helper.
- Chrome DevTools MCP manual QA with artifacts.
