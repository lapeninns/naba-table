---
task: restaurant-email-template-management
timestamp_utc: 2026-04-01T19:36:44Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Verification Report

## Automated verification

- [x] `pnpm typecheck`
- [x] `pnpm exec vitest run tests/lib/restaurant-email-templates.test.ts tests/server/restaurant-email-template-routes.test.ts`

## Route and runtime coverage

- Unit coverage verifies:
  - legacy `restaurants.email_templates` normalization into the new versioned document
  - fallback to system defaults when custom overrides have no active variants
  - deterministic rotation across active variants only
- Route coverage verifies:
  - GET returns grouped snapshot data for untouched and customized templates
  - PATCH rejects invalid payloads and persists valid variant sets
  - DELETE resets a single template cleanly
  - preview returns rendered preview payloads
  - test-send validates the request path and delegates to the locked send helper

## Manual QA — Chrome DevTools MCP

Tool: Chrome DevTools MCP
Route: `http://localhost:3001/dev/ops-settings-restaurant`

### Verified behaviors

- [x] `Email Templates` appears in the restaurant settings navigation and harness view selector
- [x] Gallery renders grouped template cards by booking journey
- [x] Customized/default states and active variant counts render correctly
- [x] Split editor supports variant add, rename, activate/deactivate, reorder, and delete flows
- [x] Unsaved state appears after edits and Save / Discard actions respond correctly
- [x] Desktop and mobile preview tabs switch correctly
- [x] Test-send succeeds through the dev mock flow and surfaces feedback in the UI

### Console and accessibility notes

- No feature-owned console errors were observed.
- One persistent browser issue, `No label associated with a form field`, remains in the dev harness environment. The email template screen controls introduced for this task expose labels in the accessibility tree; the remaining issue appears to come from surrounding dev-only tooling/harness chrome and is documented here as a pre-existing environment warning.

### Preview note

- The dev harness preview now posts to a dev-only server route that calls the same `renderRestaurantBookingEmailPreview` path as the real ops preview endpoint. The iframe HTML is now 1:1 with the real booking email renderer output for the selected template/variant.

## Artifacts

- Screenshot: `artifacts/email-templates-dev-harness.png`
