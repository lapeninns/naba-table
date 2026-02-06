---
task: ops-responsive-breakpoints
timestamp_utc: 2026-02-06T13:35:06Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

### Matrix

Primary widths: 320, 375, 414, 640, 768, 1024, 1280, 1536
Boundary widths: 639/640, 767/768
Landscape sanity: 812x375

### Pass/Fail Criteria

- No unintended horizontal scroll
- No clipped primary UI
- Clean breakpoint transitions
- Touch targets >= 44px on phone widths
- Mobile-safe inputs (>=16px where applicable)

### Results (To Be Filled)

| Page                         | 320  | 375  | 414  | 640  | 768  | 1024 | 1280 | 1536 | 639/640 | 767/768 | Landscape | Notes                                                                               | Artifacts                                                                                          |
| ---------------------------- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ------- | ------- | --------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| /dev/ops-bookings-list       | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS    | n/a     | PASS      | Clean at 639/640 and no unintended overflow.                                        | `artifacts/dev-ops-bookings-list-*.png`, `artifacts/dev-ops-bookings-list-landscape-812x375.png`   |
| /dev/ops-booking-dialog      | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | n/a     | PASS    | PASS      | Sheet/Dialog boundary verified at 767/768; no overflow.                             | `artifacts/dev-ops-booking-dialog-*.png`, `artifacts/dev-ops-booking-dialog-landscape-812x375.png` |
| /dev/ops-dashboard           | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | n/a     | n/a     | n/a       | Mock dashboard header + list; no overflow.                                          | `artifacts/dev-ops-dashboard-*.png`                                                                |
| /dev/ops-customers           | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | n/a     | n/a     | n/a       | Query param syncing stays on `/dev/ops-customers` route; no overflow.               | `artifacts/dev-ops-customers-*.png`                                                                |
| /dev/ops-email-delivery      | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | n/a     | n/a     | n/a       | Fixed 320px horizontal overflow caused by long recipient emails and header actions. | `artifacts/dev-ops-email-delivery-*.png` (use `dev-ops-email-delivery-320-v2.png`)                 |
| /dev/ops-new-booking         | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | n/a     | n/a     | n/a       | Wizard container + header renders correctly at phone widths.                        | `artifacts/dev-ops-new-booking-*.png`                                                              |
| /dev/ops-settings-restaurant | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | n/a     | n/a     | n/a       | Local view selector used; subnav rendered for layout verification.                  | `artifacts/dev-ops-settings-restaurant-*.png`                                                      |
| /dev/ops-settings-tables     | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | n/a     | n/a     | n/a       | Table inventory list + dialogs fit at phone widths.                                 | `artifacts/dev-ops-settings-tables-*.png`                                                          |
| /dev/ops-floor-plan          | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | n/a     | n/a     | PASS      | Realtime disabled via `NEXT_PUBLIC_FEATURE_REALTIME_FLOORPLAN=false`; no overflow.  | `artifacts/dev-ops-floor-plan-*.png`, `artifacts/dev-ops-floor-plan-landscape-812x375.png`         |

## Automated

- [x] pnpm lint (warnings only; no errors)
- [x] pnpm typecheck
- [x] pnpm vitest run
- [x] pnpm build

## Artifacts

- Stored under `tasks/ops-responsive-breakpoints-20260206-1335/artifacts/`.

## Notes

- Dev server used: `NEXT_PUBLIC_FEATURE_REALTIME_FLOORPLAN=false` with `pnpm dev --port 3001`.
